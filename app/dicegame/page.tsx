"use client";
import React, { useState, useEffect, useRef } from "react";
import { Ghost, Zap } from "lucide-react";

export default function FlowingPathBall() {
    const [isAnimating, setIsAnimating] = useState(false);
    const [ballPosition, setBallPosition] = useState({ x: 0, y: 0 });
    const [currentProgress, setCurrentProgress] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [shadowPosition, setShadowPosition] = useState({ x: 0, y: 0 });
    const [showEffect, setShowEffect] = useState(null);
    const pathRef = useRef(null);
    const animationRef = useRef(null);
    const [pathLength, setPathLength] = useState(0);

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

    const getPointAtLength = (percentage) => {
        if (!pathRef.current) return { x: 0, y: 0 };

        const pathElement = pathRef.current;
        const totalLength = pathElement.getTotalLength();
        const targetLength = totalLength * (percentage / 100);
        const point = pathElement.getPointAtLength(targetLength);

        return { x: point.x, y: point.y };
    };

    // Show effect animation
    const showEffectAnimation = (type, message) => {
        setShowEffect({ type, message });
        setTimeout(() => {
            setShowEffect(null);
        }, 2500); // Increased from 1500 to 2500 for longer visibility
    };

    // Two-phase animation: shadow first, then ball
    const animateToPosition = (targetProgress, diceRoll) => {
        // Phase 1: Show shadow moving to target
        const shadowDuration = 600;
        const startTime = Date.now();
        const startProgress = currentProgress;
        const progressDiff = targetProgress - startProgress;

        // Animate shadow first
        const animateShadow = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / shadowDuration, 1);

            const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
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
    const animateBall = (targetProgress, diceRoll) => {
        const duration = 800;
        const startTime = Date.now();
        const startProgress = currentProgress;
        const progressDiff = targetProgress - startProgress;

        // Show dice roll effect
        showEffectAnimation("dice", `+${diceRoll}%`);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easeInOutCubic = (t) => {
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
    const checkForSpecialEffects = (currentPos) => {
        const roundedPos = Math.round(currentPos);
        const checkpoint = checkpoints[roundedPos];

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
                        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

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

    const handleRoll = () => {
        if (isAnimating || gameOver) return;

        const diceRoll = Math.floor(Math.random() * 6) + 1;
        const newProgress = Math.min(currentProgress + diceRoll, 100);

        setIsAnimating(true);
        animateToPosition(newProgress, diceRoll);
    };

    const handleExit = () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
        setIsAnimating(false);
        setCurrentProgress(0);
        setGameOver(false);
        setShowEffect(null);
        const initialPosition = getPointAtLength(0);
        setBallPosition(initialPosition);
        setShadowPosition(initialPosition);
    };

    useEffect(() => {
        if (pathRef.current) {
            const length = pathRef.current.getTotalLength();
            setPathLength(length);
        }
    }, [pathData]);

    useEffect(() => {
        const initialPosition = getPointAtLength(0);
        setBallPosition(initialPosition);
        setShadowPosition(initialPosition);
    }, []);

    // Generate smooth progress path that follows the curve
    const generateSmoothProgressPath = () => {
        if (!pathRef.current || currentProgress === 0) return "";

        const pathElement = pathRef.current;
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

    return (
        <div className="w-full h-screen bg-black flex flex-col overflow-hidden">
            {/* Game Status Bar */}
            <div className="bg-gray-900 border-b border-green-600 p-3 sm:p-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center text-white">
                    <div className="text-sm sm:text-lg font-bold">
                        Progress:{" "}
                        <span className="text-yellow-400">
                            {currentProgress.toFixed(1)}%
                        </span>
                    </div>
                    {gameOver && (
                        <div className="text-lg sm:text-xl font-bold text-yellow-400 animate-pulse">
                            YOU WON! 🎉
                        </div>
                    )}
                    <div className="text-sm sm:text-lg font-bold">
                        Next Checkpoint:{" "}
                        <span className="text-yellow-400">
                            {Object.keys(checkpoints).find(
                                (cp) => parseInt(cp) > currentProgress
                            ) || "Finish"}
                            %
                        </span>
                    </div>
                </div>
            </div>

            {/* Main game area */}
            <div className="flex-1 flex items-center justify-center p-2 sm:p-4 relative">
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
                            fill="#22C55E"
                            fontSize="12"
                            fontWeight="bold"
                        >
                            END
                        </text>

                        {/* The main path - wider */}
                        <path
                            ref={pathRef}
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
                            const pos = getPointAtLength(parseInt(checkpoint));
                            const effect = checkpoints[checkpoint];
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
                                        x={pos.x}
                                        y={pos.y + 35}
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

                        {/* The ball */}
                        <circle
                            cx={ballPosition.x}
                            cy={ballPosition.y}
                            r={ballSize}
                            fill="url(#ballGradient)"
                        // stroke="white"
                        // strokeWidth="2"
                        >
                            <animate
                                attributeName="opacity"
                                values="0.9;1;0.9"
                                dur="1s"
                                repeatCount="indefinite"
                            />
                        </circle>
                    </svg>

                    {/* Effect animations overlay */}
                    {showEffect && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div
                                className={`flex flex-col items-center transform transition-all duration-1500 ${showEffect.type === "boost"
                                    ? "text-white"
                                    : showEffect.type === "ghost"
                                        ? "text-red-400"
                                        : "text-white"
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
                </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-900 border-t border-green-600 p-4 sm:p-6">
                <div className="max-w-4xl mx-auto flex justify-center gap-4 sm:gap-8">
                    <button
                        onClick={handleRoll}
                        disabled={isAnimating || gameOver}
                        className={`px-8 sm:px-12 py-3 sm:py-4 text-lg sm:text-xl font-bold rounded-lg transition-all duration-200 transform shadow-lg ${isAnimating || gameOver
                            ? "bg-gray-600 cursor-not-allowed text-gray-400"
                            : "bg-green-600 hover:bg-green-500 hover:scale-105 text-white"
                            }`}
                    >
                        {isAnimating ? "Rolling..." : gameOver ? "Game Over" : "Roll"}
                    </button>
                    <button
                        onClick={handleExit}
                        className="px-8 sm:px-12 py-3 sm:py-4 bg-red-600 hover:bg-red-500 text-white text-lg sm:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                        Exit
                    </button>
                </div>
            </div>

            <style jsx>{`
        @keyframes effectShow {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
        </div>
    );
}
