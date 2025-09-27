import { useState } from 'react';
import { ethers } from 'ethers';
import { usePublicClient, useWalletClient } from 'wagmi';
import { SAFEPOLL_CONTRACT_ADDRESS, SAFEPOLL_ABI } from '../config/contracts';

export interface Survey {
  id: number;
  title: string;
  description: string;
  creator: string;
  isActive: boolean;
  resultsDecrypted: boolean;
  questionCount: number;
  totalVotes: number;
  createdAt: number;
}

export interface Question {
  text: string;
  options: string[];
}

export function useContract() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const createSurvey = async (
    title: string,
    description: string,
    questions: Array<{ text: string; options: string[] }>
  ) => {
    if (!walletClient) throw new Error('Wallet not connected');

    try {
      setIsLoading(true);
      setError(null);

      // Convert to ethers for transaction
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(SAFEPOLL_CONTRACT_ADDRESS, SAFEPOLL_ABI, signer);

      const questionTexts = questions.map(q => q.text);
      const questionOptions = questions.map(q => q.options);

      const tx = await contract.createSurvey(title, description, questionTexts, questionOptions);
      const receipt = await tx.wait();

      // Parse events to get survey ID
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'SurveyCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = contract.interface.parseLog(event);
        return Number(parsed?.args.surveyId);
      }

      throw new Error('Failed to get survey ID from transaction');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create survey';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitVotes = async (
    surveyId: number,
    encryptedVotes: any[],
    inputProof: string
  ) => {
    if (!walletClient) throw new Error('Wallet not connected');

    try {
      setIsLoading(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(SAFEPOLL_CONTRACT_ADDRESS, SAFEPOLL_ABI, signer);

      const tx = await contract.submitVotes(surveyId, encryptedVotes, inputProof);
      await tx.wait();

      return tx.hash;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit votes';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const endSurvey = async (surveyId: number) => {
    if (!walletClient) throw new Error('Wallet not connected');

    try {
      setIsLoading(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(SAFEPOLL_CONTRACT_ADDRESS, SAFEPOLL_ABI, signer);

      const tx = await contract.endSurvey(surveyId);
      await tx.wait();

      return tx.hash;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end survey';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getSurveyInfo = async (surveyId: number): Promise<Survey | null> => {
    if (!publicClient) return null;

    try {
      const result = await publicClient.readContract({
        address: SAFEPOLL_CONTRACT_ADDRESS as `0x${string}`,
        abi: SAFEPOLL_ABI,
        functionName: 'getSurveyInfo',
        args: [surveyId],
      }) as any[];

      return {
        id: Number(result[0]),
        title: result[1],
        description: result[2],
        creator: result[3],
        isActive: result[4],
        resultsDecrypted: result[5],
        questionCount: Number(result[6]),
        totalVotes: Number(result[7]),
        createdAt: Number(result[8]),
      };
    } catch (err) {
      console.error('Failed to get survey info:', err);
      return null;
    }
  };

  const getQuestion = async (surveyId: number, questionIndex: number): Promise<Question | null> => {
    if (!publicClient) return null;

    try {
      const result = await publicClient.readContract({
        address: SAFEPOLL_CONTRACT_ADDRESS as `0x${string}`,
        abi: SAFEPOLL_ABI,
        functionName: 'getQuestion',
        args: [surveyId, questionIndex],
      }) as [string, string[]];

      return {
        text: result[0],
        options: result[1],
      };
    } catch (err) {
      console.error('Failed to get question:', err);
      return null;
    }
  };

  const getTotalSurveys = async (): Promise<number> => {
    if (!publicClient) return 0;

    try {
      const result = await publicClient.readContract({
        address: SAFEPOLL_CONTRACT_ADDRESS as `0x${string}`,
        abi: SAFEPOLL_ABI,
        functionName: 'getTotalSurveys',
      }) as bigint;

      return Number(result);
    } catch (err) {
      console.error('Failed to get total surveys:', err);
      return 0;
    }
  };

  const hasUserVoted = async (surveyId: number, userAddress: string): Promise<boolean> => {
    if (!publicClient) return false;

    try {
      const result = await publicClient.readContract({
        address: SAFEPOLL_CONTRACT_ADDRESS as `0x${string}`,
        abi: SAFEPOLL_ABI,
        functionName: 'hasUserVoted',
        args: [surveyId, userAddress],
      }) as boolean;

      return result;
    } catch (err) {
      console.error('Failed to check if user voted:', err);
      return false;
    }
  };

  return {
    createSurvey,
    submitVotes,
    endSurvey,
    getSurveyInfo,
    getQuestion,
    getTotalSurveys,
    hasUserVoted,
    isLoading,
    error,
  };
}