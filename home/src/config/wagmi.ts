import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'SafePoll',
  projectId: 'YOUR_PROJECT_ID', // Replace with your actual project ID from WalletConnect Cloud
  chains: [sepolia],
  ssr: false,
});