import ABI from './SafePollABI.json';

// SafePoll contract configuration
export const SAFEPOLL_CONTRACT_ADDRESS = '0x88474C7e2f11F9Ca90f8b58c5773e1Ce1F55408e'

// Contract ABI imported from deployment artifacts
export const SAFEPOLL_ABI = ABI as const;

// Sepolia network configuration for FHEVM
export const SEPOLIA_CONFIG = {
  chainId: 11155111,
  aclContractAddress: "0x687820221192C5B662b25367F70076A37bc79b6c",
  kmsContractAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
  inputVerifierContractAddress: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
  verifyingContractAddressDecryption: "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
  verifyingContractAddressInputVerification: "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
  gatewayChainId: 55815,
  network: "https://eth-sepolia.public.blastapi.io",
  relayerUrl: "https://relayer.testnet.zama.cloud",
};