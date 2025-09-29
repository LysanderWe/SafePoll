import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

import { config } from './config/wagmi';
import { SurveyApp } from './components/SurveyApp';
import { Survey } from './components/Survey';
import { useEffect, useState } from 'react';

const queryClient = new QueryClient();

function App() {
  const [path, setPath] = useState<string>(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const match = path.match(/^\/survey\/(\d+)$/i);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider locale="en">
          <div style={{ minHeight: '100vh' }}>
            {match ? <Survey /> : <SurveyApp />}
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App
