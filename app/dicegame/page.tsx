"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Ghost, Zap, Sun, Moon } from "lucide-react";
import { Randomness } from 'randomness-js';
import { ethers, getBytes } from 'ethers';
import { useAccount, useWriteContract, useConfig } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/app/config';
import { waitForTransactionReceipt } from "@wagmi/core";
import kohli from '../characters/kohli.png';
import messi from '../characters/messi.png';
import batman from '../characters/batman.png';
import Image from "next/image";
import Header from "./header";
import Wallet from "../wallet";

export default function FlowingPathBall() {
    const { isConnected } = useAccount();
    const [isAnimating, setIsAnimating] = useState(false);
    const [ballPosition, setBallPosition] = useState({ x: 0, y: 0 });
    const [currentProgress, setCurrentProgress] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [shadowPosition, setShadowPosition] = useState({ x: 0, y: 0 });
    const [showEffect, setShowEffect] = useState<{ type: string, message: string } | null>(null);
    const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
    const [showCharacterSelect, setShowCharacterSelect] = useState(true);
    const [isRolling, setIsRolling] = useState(false);
    // const [diceValue, setDiceValue] = useState(1);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const pathRef = useRef<SVGSVGElement | null>(null);
    const animationRef = useRef<number | null>(null);
    // const [pathLength, setPathLength] = useState(0);

    // VRF Integration
    const [vrfResult, setVrfResult] = useState<number | null>(null);
    const [vrfError, setVrfError] = useState<string | null>(null);
    const [isVrfProcessing, setIsVrfProcessing] = useState(false);

    // Read function that doesn't need args
    // const { data: readData } = useReadContract({
    //     address: CONTRACT_ADDRESS,
    //     abi: CONTRACT_ABI,
    //     functionName: 'randomness',
    // }) as { data: bigint | undefined };

    // Write function setup
    const { writeContract } = useWriteContract();
    const config = useConfig();

    // Game settings - reduced complexity for 4 peaks
    const pathComplexity = 6;
    const curveAmplitude = 70;
    const pathWidth = 800;
    const pathHeight = 400;
    const ballSize = 16;

    // Checkpoints with exact matching
    const checkpoints = {
        20: { type: "boost", value: 8, message: "+8%" },
        35: { type: "ghost", value: -6, message: "-6%" },
        55: { type: "boost", value: 10, message: "+10%" },
        75: { type: "ghost", value: -8, message: "-8%" },
        90: { type: "boost", value: 5, message: "+5%" },
    };

    const generatePath = () => {
        const startX = 50;
        const startY = pathHeight - 50;
        const endX = pathWidth - 50;
        const endY = 50;

        const segmentWidth = (endX - startX) / pathComplexity;
        const totalYChange = endY - startY;
        const yChangePerSegment = totalYChange / pathComplexity;

        let path = `M ${startX} ${startY}`;
        let currentY = startY;

        for (let i = 1; i <= pathComplexity; i++) {
            const segmentEndX = startX + i * segmentWidth;
            const segmentEndY = startY + i * yChangePerSegment;
            const controlX = startX + (i - 0.5) * segmentWidth;

            const direction = i % 2 === 0 ? 1 : -1;
            const controlY =
                currentY + yChangePerSegment / 2 + direction * curveAmplitude;

            path += ` Q ${controlX} ${controlY}, ${segmentEndX} ${segmentEndY}`;
            currentY = segmentEndY;
        }

        return path;
    };

    const pathData = generatePath();

    const getPointAtLength = (percentage: number) => {
        if (!pathRef.current) return { x: 0, y: 0 };

        // Handle starting position (0%)
        if (percentage === 0) {
            return { x: 50, y: pathHeight - 50 };
        }

        const pathElement = pathRef.current as unknown as SVGPathElement;
        const totalLength = pathElement.getTotalLength();
        const targetLength = totalLength * (percentage / 100);
        const point = pathElement.getPointAtLength(targetLength);

        return { x: point.x, y: point.y };
    };

    // Show effect animation
    const showEffectAnimation = (type: string, message: string) => {
        setShowEffect({ type, message });
        setTimeout(() => {
            setShowEffect(null);
        }, 2500); // Increased from 1500 to 2500 for longer visibility
    };

    // Two-phase animation: shadow first, then ball
    const animateToPosition = (targetProgress: number, diceRoll: number) => {
        // Phase 1: Show shadow moving to target
        const shadowDuration = 600;
        const startTime = Date.now();
        const startProgress = currentProgress;
        const progressDiff = targetProgress - startProgress;

        // Animate shadow first
        const animateShadow = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / shadowDuration, 1);

            const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
            const easedProgress = easeOutQuart(progress);
            const newProgress = startProgress + progressDiff * easedProgress;
            const shadowPos = getPointAtLength(newProgress);

            setShadowPosition(shadowPos);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animateShadow);
            } else {
                // Phase 2: Move ball to shadow position
                setTimeout(() => {
                    animateBall(targetProgress, diceRoll);
                }, 150);
            }
        };

        animateShadow();
    };

    // Ball follows shadow
    const animateBall = (targetProgress: number, diceRoll: number) => {
        const duration = 800;
        const startTime = Date.now();
        const startProgress = currentProgress;
        const progressDiff = targetProgress - startProgress;

        // Show dice roll effect
        showEffectAnimation("dice", `+${diceRoll}%`);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easeInOutCubic = (t: number) => {
                return t < 0.5
                    ? 4 * t * t * t
                    : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            };

            const easedProgress = easeInOutCubic(progress);
            const newProgress = startProgress + progressDiff * easedProgress;
            const position = getPointAtLength(newProgress);
            setBallPosition(position);
            setCurrentProgress(newProgress);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                // Check for checkpoint effects EXACTLY
                checkForSpecialEffects(Math.round(newProgress));
            }
        };

        animate();
    };

    // Check for special effects at checkpoints - EXACT match only
    const checkForSpecialEffects = (currentPos: number) => {
        const roundedPos = Math.round(currentPos);
        const checkpoint = checkpoints[roundedPos as keyof typeof checkpoints];

        if (checkpoint) {
            // Show effect animation first
            showEffectAnimation(checkpoint.type, checkpoint.message);

            // Apply effect after showing animation - but don't animate backwards
            setTimeout(() => {
                const newProgress = Math.max(
                    0,
                    Math.min(100, currentProgress + checkpoint.value)
                );

                // Only animate if moving forward, otherwise just update position
                if (newProgress > currentProgress) {
                    // Animate to new position smoothly
                    const effectDuration = 800;
                    const startTime = Date.now();
                    const startPos = currentProgress;
                    const posDiff = newProgress - startPos;

                    const animateEffect = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / effectDuration, 1);
                        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

                        const easedProgress = easeOutCubic(progress);
                        const currentPos = startPos + posDiff * easedProgress;
                        const position = getPointAtLength(currentPos);

                        setBallPosition(position);
                        setCurrentProgress(currentPos);

                        if (progress < 1) {
                            animationRef.current = requestAnimationFrame(animateEffect);
                        } else {
                            setIsAnimating(false);
                            if (currentPos >= 100) {
                                setGameOver(true);
                            }
                        }
                    };

                    animateEffect();
                } else {
                    // For negative effects, just update position without animation
                    setCurrentProgress(newProgress);
                    const position = getPointAtLength(newProgress);
                    setBallPosition(position);
                    setIsAnimating(false);

                    if (newProgress >= 100) {
                        setGameOver(true);
                    }
                }
            }, 1200); // Increased delay for better effect visibility
        } else {
            setIsAnimating(false);
            if (currentPos >= 100) {
                setGameOver(true);
            }
        }
    };

    const rollDice = async () => {
        if (isAnimating || gameOver || isVrfProcessing) return;

        try {
            setIsRolling(true);
            setVrfError(null);
            setVrfResult(null);

            const callbackGasLimit = 700_000;
            const jsonProvider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`);

            const randomness = Randomness.createBaseSepolia(jsonProvider);
            console.log("Randomness instance:", randomness);

            const [requestCallBackPrice] = await randomness.calculateRequestPriceNative(BigInt(callbackGasLimit));

            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'generateWithDirectFunding',
                args: [callbackGasLimit],
                value: requestCallBackPrice,
            }, {
                onSuccess: handleVrfTransactionSubmitted,
            });

        } catch (error) {
            console.error('VRF request failed:', error);
            setVrfError('Failed to request VRF. Please try again.');
            setIsRolling(false);
        }
    };

    const handleRoll = (diceRoll: number) => {
        if (isAnimating || gameOver) return;

        const newProgress = Math.min(currentProgress + diceRoll, 100);

        setIsAnimating(true);
        animateToPosition(newProgress, diceRoll);
    };

    const handleCharacterSelect = (character: string) => {
        setSelectedCharacter(character);
        setShowCharacterSelect(false);
    };

    // const handleExit = () => {
    //     if (animationRef.current) {
    //         cancelAnimationFrame(animationRef.current);
    //     }
    //     setIsAnimating(false);
    //     setCurrentProgress(0);
    //     setGameOver(false);
    //     setShowEffect(null);
    //     setShowCharacterSelect(true);
    //     setSelectedCharacter(null);
    //     const initialPosition = getPointAtLength(0);
    //     setBallPosition(initialPosition);
    //     setShadowPosition(initialPosition);
    // };

    // useEffect(() => {
    //     if (pathRef.current) {
    //         const length = (pathRef.current as unknown as SVGPathElement).getTotalLength();
    //         setPathLength(length);
    //     }
    // }, [pathData]);

    // Set initial ball and shadow position
    useEffect(() => {
        // Use exact START point coordinates
        const startX = 50;
        const startY = pathHeight - 50;
        const startPosition = { x: startX, y: startY };
        setBallPosition(startPosition);
        setShadowPosition(startPosition);
    }, [pathHeight]);

    // Generate smooth progress path that follows the curve
    const generateSmoothProgressPath = () => {
        if (!pathRef.current || currentProgress === 0) return "";

        const pathElement = pathRef.current as unknown as SVGPathElement;
        const totalLength = pathElement.getTotalLength();
        const targetLength = totalLength * (currentProgress / 100);

        // Create a smooth path up to current progress
        let progressPath = "";
        const segmentCount = 100; // More segments for smoother curve

        for (let i = 0; i <= segmentCount; i++) {
            const progress = i / segmentCount;
            const length = progress * targetLength;

            if (length <= targetLength) {
                const point = pathElement.getPointAtLength(length);

                if (i === 0) {
                    progressPath = `M ${point.x} ${point.y}`;
                } else {
                    progressPath += ` L ${point.x} ${point.y}`;
                }
            }
        }

        return progressPath;
    };

    const smoothProgressPath = generateSmoothProgressPath();

    // VRF Transaction Handler
    const handleVrfTransactionSubmitted = useCallback(async (txHash: string) => {
        try {
            setIsVrfProcessing(true);
            const transactionReceipt = await waitForTransactionReceipt(config, {
                hash: txHash as `0x${string}`,
            });

            if (transactionReceipt.status === "success") {
                // Wait a bit for the randomness to be updated
                setTimeout(async () => {
                    // Read the updated randomness directly from contract
                    try {
                        const provider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`);
                        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
                        const updatedRandomness = await contract.randomness();

                        if (updatedRandomness) {
                            const bytes = getBytes(updatedRandomness.toString());
                            console.log("Updated VRF randomness:", updatedRandomness);

                            if (bytes.length > 0) {
                                // Convert VRF result to dice roll (1-6)
                                const diceRoll = (bytes[0] % 6) + 1;
                                setVrfResult(diceRoll);
                                // setDiceValue(diceRoll);
                                setIsRolling(false);

                                // Start the game with the VRF result
                                handleRoll(diceRoll);
                            } else {
                                setVrfError("Failed to generate random dice roll. Please try again.");
                                setIsRolling(false);
                            }
                        } else {
                            setVrfError("Failed to get random dice roll. Please try again.");
                            setIsRolling(false);
                        }
                    } catch (readError) {
                        console.error("Error reading VRF randomness:", readError);
                        setVrfError("Failed to read random dice roll. Please try again.");
                        setIsRolling(false);
                    }
                    setIsVrfProcessing(false);
                }, 2000); // Wait 2 seconds for randomness to be updated
            } else {
                setVrfError("VRF transaction failed. Please try again.");
                setIsRolling(false);
                setIsVrfProcessing(false);
            }
        } catch (error) {
            console.error("Error in VRF transaction:", error);
            setVrfError("VRF transaction failed. Please try again.");
            setIsRolling(false);
            setIsVrfProcessing(false);
        }
    }, [config]);

    return (
        <>
            {isConnected ? (
                <div className={`w-full h-screen flex flex-col overflow-hidden ${isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
                    {/* Header - Fixed at top */}
                    <div className="flex-shrink-0 z-40">
                        <Header darkMode={isDarkMode} />
                    </div>

                    {/* Dark/Light Mode Toggle - Fixed at top right */}
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`absolute top-4 right-4 z-50 p-2 rounded-full transition-all duration-200 ${isDarkMode
                            ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                    >
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    {/* Character Selection Overlay */}
                    {showCharacterSelect && (
                        <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
                            <div className={`relative p-8 rounded-lg border-2 max-w-4xl flex flex-col items-center justify-center gap-8 ${isDarkMode ? 'bg-gray-900' : 'bg-white'
                                }`}>
                                <h2 className={`text-3xl font-bold text-center ${isDarkMode ? 'text-white' : 'text-black'
                                    }`}>
                                    Choose Your Character
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Kohli */}
                                    <div
                                        className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform duration-200"
                                        onClick={() => handleCharacterSelect('kohli')}
                                    >
                                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-green-500 hover:border-green-400 transition-colors">
                                            <Image
                                                src={kohli}
                                                alt="Virat Kohli"
                                            />
                                        </div>
                                        <h3 className={`text-xl font-bold mt-4 ${isDarkMode ? 'text-white' : 'text-black'
                                            }`}>Virat Kohli</h3>
                                        <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                            }`}>The King of Cricket</p>
                                    </div>

                                    {/* Messi */}
                                    <div
                                        className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform duration-200"
                                        onClick={() => handleCharacterSelect('messi')}
                                    >
                                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-500 hover:border-blue-400 transition-colors">
                                            <Image
                                                src={messi}
                                                alt="Lionel Messi"
                                            />
                                        </div>
                                        <h3 className={`text-xl font-bold mt-4 ${isDarkMode ? 'text-white' : 'text-black'
                                            }`}>Lionel Messi</h3>
                                        <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                            }`}>The GOAT of Football</p>
                                    </div>

                                    {/* Batman */}
                                    <div
                                        className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform duration-200"
                                        onClick={() => handleCharacterSelect('batman')}
                                    >
                                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-purple-500 hover:border-purple-400 transition-colors">
                                            <Image
                                                src={batman}
                                                alt="Batman"
                                            />
                                        </div>
                                        <h3 className={`text-xl font-bold mt-4 ${isDarkMode ? 'text-white' : 'text-black'
                                            }`}>Batman</h3>
                                        <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                            }`}>The Dark Knight</p>
                                    </div>
                                </div>
                                <button
                                    className={`absolute top-2 right-2 px-3 py-1 rounded-md transition-colors ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-black hover:bg-gray-300'
                                        }`}
                                    onClick={() => setShowCharacterSelect(false)}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main Game Area - Flexible height */}
                    <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                        <div className="w-full h-full max-w-6xl relative">
                            <svg
                                width="100%"
                                height="100%"
                                viewBox={`0 0 ${pathWidth} ${pathHeight}`}
                                className="w-full h-full"
                                preserveAspectRatio="xMidYMid meet"
                            >
                                <defs>
                                    <linearGradient
                                        id="pathGradient"
                                        x1="0%"
                                        y1="100%"
                                        x2="100%"
                                        y2="0%"
                                    >
                                        <stop offset="0%" stopColor="#374151" />
                                        <stop offset="50%" stopColor="#4B5563" />
                                        <stop offset="100%" stopColor="#6B7280" />
                                    </linearGradient>

                                    <linearGradient
                                        id="progressGradient"
                                        x1="0%"
                                        y1="100%"
                                        x2="100%"
                                        y2="0%"
                                    >
                                        <stop offset="0%" stopColor="#22C55E" />
                                        <stop offset="50%" stopColor="#16A34A" />
                                        <stop offset="100%" stopColor="#15803D" />
                                    </linearGradient>

                                    <radialGradient id="ballGradient" cx="30%" cy="30%">
                                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                                        <stop offset="70%" stopColor="#3B82F6" />
                                        <stop offset="100%" stopColor="#1E40AF" />
                                    </radialGradient>

                                    {/* boost gradient */}
                                    <radialGradient id="boostGradient" cx="30%" cy="30%">
                                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                                        <stop offset="70%" stopColor="#16A34A" />
                                        <stop offset="100%" stopColor="#15803D" />
                                    </radialGradient>

                                    {/* ghost gradient */}
                                    <radialGradient id="ghostGradient" cx="30%" cy="30%">
                                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                                        <stop offset="70%" stopColor="#B91C1C" />
                                        <stop offset="100%" stopColor="#991B1B" />
                                    </radialGradient>

                                    <radialGradient id="shadowGradient" cx="50%" cy="50%">
                                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
                                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
                                    </radialGradient>
                                </defs>

                                {/* Start point */}
                                <circle
                                    cx="50"
                                    cy={pathHeight - 50}
                                    r="8"
                                    fill="#22C55E"
                                    opacity="0.8"
                                >
                                    <animate
                                        attributeName="r"
                                        values="8;12;8"
                                        dur="2s"
                                        repeatCount="indefinite"
                                    />
                                </circle>
                                <text
                                    x="50"
                                    y={pathHeight - 16}
                                    textAnchor="middle"
                                    fill="#22C55E"
                                    fontSize="12"
                                    fontWeight="bold"
                                >
                                    START
                                </text>

                                {/* End point */}
                                <circle
                                    cx={pathWidth - 50}
                                    cy="50"
                                    r="8"
                                    fill="#22C55E"
                                    opacity="0.8"
                                >
                                    <animate
                                        attributeName="r"
                                        values="8;12;8"
                                        dur="2s"
                                        repeatCount="indefinite"
                                    />
                                </circle>
                                <text
                                    x={pathWidth - 50}
                                    y="25"
                                    textAnchor="middle"
                                    fill="RED"
                                    fontSize="12"
                                    fontWeight="bold"
                                >
                                    END
                                </text>

                                {/* The main path - wider */}
                                <path
                                    ref={pathRef as unknown as React.RefObject<SVGPathElement> | undefined}
                                    d={pathData}
                                    fill="none"
                                    stroke="url(#pathGradient)"
                                    strokeWidth="35"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {/* Progress path - using small line segments to follow the curve */}
                                {smoothProgressPath && (
                                    <path
                                        d={smoothProgressPath}
                                        fill="none"
                                        stroke="url(#progressGradient)"
                                        strokeWidth="28"
                                        strokeLinecap="round"
                                    />
                                )}

                                {/* Checkpoints - high z-index */}
                                {Object.keys(checkpoints).map((checkpoint) => {
                                    const checkpointNum = Number(checkpoint) as keyof typeof checkpoints;
                                    const pos = getPointAtLength(Number(checkpoint));
                                    const effect = checkpoints[checkpointNum];
                                    return (
                                        <g key={checkpoint} style={{ zIndex: 1000 }}>
                                            <circle
                                                cx={pos.x}
                                                cy={pos.y}
                                                r="18"
                                                // stroke="white"
                                                fill={effect.type === "boost" ? "url(#boostGradient)" : "url(#ghostGradient)"}
                                                fillOpacity="0.8"
                                                // display={currentProgress >= parseInt(checkpoint) ? "none" : "block"}
                                                className={`${currentProgress >= parseInt(checkpoint) ? "opacity-0" : "opacity-100"}`}
                                            >
                                                {/* <animate attributeName="r" values="18;22;18" dur="2s" repeatCount="indefinite" /> */}
                                            </circle>

                                            <text
                                                x={effect.type !== "boost" ? pos.x - 25 : pos.x}
                                                y={effect.type !== "boost" ? pos.y - 20 : pos.y + 35}
                                                textAnchor="middle"
                                                fill={effect.type === "boost" ? "#22C55E" : "#DC2626"}
                                                fontSize="10"
                                                fontWeight="bold"
                                                // display={currentProgress >= parseInt(checkpoint) ? "none" : "block"}
                                                className={`${currentProgress >= parseInt(checkpoint) ? "opacity-0" : "opacity-100"}`}
                                            >
                                                {effect.message}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* Shadow (target position) */}
                                {isAnimating && (
                                    <circle
                                        cx={shadowPosition.x}
                                        cy={shadowPosition.y}
                                        r={ballSize + 6}
                                        fill="url(#shadowGradient)"
                                        className="animate-pulse"
                                    />
                                )}

                                {/* The ball/character */}
                                {selectedCharacter ? (
                                    <image
                                        href={selectedCharacter === 'kohli' ? kohli.src : selectedCharacter === 'messi' ? messi.src : batman.src}
                                        x={ballPosition.x - (ballSize * 3)}
                                        y={ballPosition.y - (ballSize * 3)}
                                        width={ballSize * 6}
                                        height={ballSize * 6}
                                    />
                                ) : (
                                    <circle
                                        cx={ballPosition.x}
                                        cy={ballPosition.y}
                                        r={ballSize}
                                        fill="url(#ballGradient)"
                                    >
                                        <animate
                                            attributeName="opacity"
                                            values="0.9;1;0.9"
                                            dur="1s"
                                            repeatCount="indefinite"
                                        />
                                    </circle>
                                )}
                            </svg>

                            {/* Effect animations overlay */}
                            {showEffect && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div
                                        className={`flex flex-col items-center transform transition-all duration-1500 ${showEffect.type === "boost"
                                            ? "text-white"
                                            : showEffect.type === "ghost"
                                                ? "text-red-400"
                                                : isDarkMode ? "text-white" : "text-black"
                                            }`}
                                        style={{
                                            animation: "effectShow 1.5s ease-out forwards",
                                        }}
                                    >
                                        {showEffect.type === "boost" && (
                                            <Zap className="w-16 h-16 mb-2" />
                                        )}
                                        {showEffect.type === "ghost" && (
                                            <Ghost className="w-16 h-16 mb-2" />
                                        )}
                                        <div className="text-9xl font-bold">{showEffect.message}</div>
                                    </div>
                                </div>
                            )}

                            {/* Win Celebration Message */}
                            {gameOver && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 bg-slate-900 bg-opacity-70">
                                    <div
                                        className="flex flex-col items-center transform transition-all duration-2000"
                                        style={{
                                            animation: "winCelebration 3s ease-out forwards",
                                        }}
                                    >
                                        <div className="text-8xl mb-4">🎉</div>
                                        <div className="text-7xl font-bold text-yellow-400 mb-2">YOU WON!</div>
                                        <div className="text-2xl text-white opacity-90">Congratulations! 🎊</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer - Fixed at bottom */}
                    <div className={`flex-shrink-0 border-t p-4 px-6 ${isDarkMode ? 'border-green-600' : 'bg-gray-100 border-green-600'
                        }`}>
                        <div className="flex justify-between items-center mx-auto">
                            {/* Game Status Row */}
                            <div className="flex flex-col justify-between items-start">
                                <div className="text-sm sm:text-lg font-bold">
                                    Progress:{" "}
                                    <span className="text-yellow-500">
                                        {currentProgress.toFixed(1)}%
                                    </span>
                                </div>
                                {gameOver ? (
                                    <div className="text-lg sm:text-xl font-bold text-yellow-500 animate-pulse">
                                        YOU WON! 🎉
                                    </div>
                                ) : (
                                    <div className="text-sm sm:text-lg font-bold">
                                        Next Checkpoint:{" "}
                                        <span className="text-yellow-500">
                                            {Object.keys(checkpoints).find(
                                                (cp) => parseInt(cp) > currentProgress
                                            ) || "Finish"}
                                            %
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons Row */}
                            <div className="flex justify-center gap-4 sm:gap-8">
                                <div className="relative group">
                                    <button
                                        onClick={rollDice}
                                        disabled={isAnimating || gameOver || isRolling || isVrfProcessing}
                                        className={`flex items-center px-8 sm:px-10 py-2 sm:py-3 text-lg sm:text-xl font-bold rounded-lg transition-all duration-200 transform shadow-lg ${isAnimating || gameOver || isRolling || isVrfProcessing
                                            ? "bg-gray-600 cursor-not-allowed text-gray-400"
                                            : "bg-green-600 hover:bg-green-500 hover:scale-105 text-white"
                                            }`}
                                    >
                                        {isVrfProcessing ? (
                                            "Requesting VRF..."
                                        ) : isRolling ? (
                                            "Rolling..."
                                        ) : gameOver ? "Game Over" : "Roll Dice"}
                                    </button>

                                    {/* VRF Error Display */}
                                    {vrfError && (
                                        <div className="mt-2 text-red-500 text-sm text-center">
                                            {vrfError}
                                        </div>
                                    )}

                                    {/* VRF Result Display */}
                                    {vrfResult && (
                                        <div className="mt-2 text-green-500 text-sm text-center">
                                            VRF Result: {vrfResult}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <style jsx>{`
          @keyframes effectShow {
            0% {
              opacity: 0;
              transform: scale(0.5);
            }
            50% {
              opacity: 1;
              transform: scale(1.2);
            }
            100% {
              opacity: 0;
              transform: scale(1.2);
            }
          }

          @keyframes winCelebration {
            0% {
              opacity: 0;
              transform: scale(0.3) rotate(-10deg);
            }
            20% {
              opacity: 1;
              transform: scale(1.1) rotate(5deg);
            }
            40% {
              transform: scale(1.2) rotate(-3deg);
            }
            60% {
              transform: scale(1.1) rotate(2deg);
            }
            80% {
              transform: scale(1.2) rotate(-1deg);
            }
            100% {
              opacity: 1;
              transform: scale(1.2) rotate(0deg);
            }
          }
        `}</style>
                </div>
            ) : (
                <Wallet />
            )}
        </>
    );
}
