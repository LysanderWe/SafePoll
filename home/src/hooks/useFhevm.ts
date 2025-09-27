import { useState, useEffect } from 'react';
import { createInstance, initSDK, SepoliaConfig } from '@zama-fhe/relayer-sdk';
import { useAccount } from 'wagmi';

export interface FhevmInstance {
  createEncryptedInput: (contractAddress: string, userAddress: string) => any;
  userDecrypt: (
    handleContractPairs: Array<{ handle: string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimeStamp: string,
    durationDays: string
  ) => Promise<Record<string, any>>;
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimeStamp: string,
    durationDays: string
  ) => any;
}

export function useFhevm() {
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();

  useEffect(() => {
    const initFhevm = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Initialize the SDK
        await initSDK();

        // Create instance with Sepolia configuration
        const config = {
          ...SepoliaConfig,
          network: window.ethereum
        };

        const fhevmInstance = await createInstance(config);
        setInstance(fhevmInstance);
      } catch (err) {
        console.error('Failed to initialize FHEVM:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize FHEVM');
      } finally {
        setIsLoading(false);
      }
    };

    if (address) {
      initFhevm();
    }
  }, [address]);

  return { instance, isLoading, error };
}