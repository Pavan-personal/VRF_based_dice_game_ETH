'use client';
import React, { useState, useCallback } from 'react';
import Image from "next/image";
import { Randomness } from 'randomness-js'
import { ethers, getBytes } from 'ethers'
import { useAccount, useWriteContract, useConfig } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/app/config';
import { waitForTransactionReceipt } from "@wagmi/core";
import Header from './header';
import Wallet from '../wallet';

export default function CoinFlip() {

    const { isConnected } = useAccount();
    const [result, setResult] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Read function that doesn't need args
    // const { data: readData } = useReadContract({
    //     address: CONTRACT_ADDRESS,
    //     abi: CONTRACT_ABI,
    //     functionName: 'randomness',
    // }) as { data: bigint | undefined };

    // Write function setup
    const { writeContract } = useWriteContract();
    const config = useConfig();

    const handleTransactionSubmitted = useCallback(async (txHash: string) => {
        try {
            setIsProcessing(true);
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
                            console.log("Updated randomness:", updatedRandomness);
                            
                            if (bytes.length > 0) {
                                setResult(bytes[0] % 2 === 0 ? 1 : 2);
                            } else {
                                setError("Failed to generate random number. Please try again.");
                            }
                        } else {
                            setError("Failed to get random number. Please try again.");
                        }
                    } catch (readError) {
                        console.error("Error reading randomness:", readError);
                        setError("Failed to read random number. Please try again.");
                    }
                    setIsProcessing(false);
                }, 2000); // Wait 2 seconds for randomness to be updated
            } else {
                setError("Transaction failed. Please try again.");
                setIsProcessing(false);
            }
        } catch (error) {
            console.error("Error in transaction:", error);
            setError("Transaction failed. Please try again.");
            setIsProcessing(false);
        }
    }, [config]);

    const generateRandomNumber = async () => {
        try {
            setResult(0); // Reset result to show loading state
            setError(null); // Clear any previous errors
            try {
                const callbackGasLimit = 700_000;
                const jsonProvider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`);

                const randomness = Randomness.createBaseSepolia(jsonProvider)
                console.log("Randomness : ", randomness)
                const [requestCallBackPrice] = await randomness.calculateRequestPriceNative(BigInt(callbackGasLimit))

                writeContract({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'generateWithDirectFunding',
                    args: [callbackGasLimit],
                    value: requestCallBackPrice,
                },
                    {
                        onSuccess: handleTransactionSubmitted,
                    });

            } catch (error) {
                console.error('Transfer failed:', error);
            }


        } catch (error) {
            console.error("Error in generateRandomNumber:", error)
            setError("Failed to generate random number. Please try again.");
        }
    }

    return (

        <>
            {isConnected ? <>
                <Header />
                <div className="min-h-screen bg-black-pattern flex flex-col relative">
                    <main className="flex-grow mt-8">
                        <div className="container mx-auto px-4 py-12">
                            {error && (
                                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                                    {error}
                                </div>
                            )}
                            <div className="flex flex-col lg:flex-row items-center lg:gap-64">
                                {/* Left Side - Text Content */}
                                <div className="w-full lg:w-1/2 space-y-8 text-wrap mt-24">
                                    <h1 className="font-funnel-display text-3xl md:text-4xl font-bold text-white">
                                        Heads or Tails? What&apos;s you call?
                                    </h1>
                                    <p className="font-funnel-display text-lg text-gray-500 font-funnel">
                                        Each coin flip uses a verifiable random number generated by a secure network of trusted nodes.
                                        It&apos;s cryptographically safe, tamperproof, and aligned with blockchain standards, so the result is always fair and provable.
                                    </p>

                                    <div>
                                        <button
                                            onClick={generateRandomNumber}
                                            disabled={isProcessing}
                                            className={`font-funnel-display flex flex-row gap-2 text-red-500 text-2xl font-medium py-3 transition duration-300 transform hover:scale-105 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <Image
                                                src="/assets/images/redarrow.svg"
                                                alt="Description"
                                                width={30}
                                                height={30}
                                                className=""
                                            />
                                            {isProcessing ? 'Processing...' : 'Spin The Coin'}
                                        </button>
                                    </div>
                                </div>

                                {/* Right Side - Graphic Area */}
                                <div className="w-full lg:w-1/2 justify-center items-center">
                                    <div className="w-full aspect-square max-w-md flex items-center justify-center">
                                        {result == 0 &&
                                            <Image
                                                src="/assets/images/question.png"
                                                alt="Description"
                                                width={400}
                                                height={400}
                                                className="animate-pulse"
                                            />
                                        }
                                        {result == 1 &&
                                            <Image
                                                src="/assets/images/heads.png"
                                                alt="Description"
                                                width={400}
                                                height={400}
                                                className=""
                                            />
                                        }
                                        {result == 2 &&
                                            <Image
                                                src="/assets/images/tails.png"
                                                alt="Description"
                                                width={400}
                                                height={400}
                                                className=""
                                            />
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </> : <>
                <Wallet />
            </>}
        </>

    );
}