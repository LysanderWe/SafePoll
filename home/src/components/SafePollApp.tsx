import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { CreateSurvey } from './CreateSurvey';
import { SurveyList } from './SurveyList';
import { SurveyDetail } from './SurveyDetail';
import { FhevmInstance } from '../hooks/useFhevm';

type View = 'list' | 'create' | 'detail';

interface AppState {
  view: View;
  selectedSurveyId: number | null;
  fhevmInstance: FhevmInstance | null;
}

export function SafePollApp() {
  const { isConnected } = useAccount();
  const [state, setState] = useState<AppState>({
    view: 'list',
    selectedSurveyId: null,
    fhevmInstance: null,
  });

  const navigateToCreate = () => {
    setState(prev => ({ ...prev, view: 'create' }));
  };

  const navigateToList = () => {
    setState(prev => ({ ...prev, view: 'list', selectedSurveyId: null }));
  };

  const navigateToDetail = (surveyId: number) => {
    setState(prev => ({ ...prev, view: 'detail', selectedSurveyId: surveyId }));
  };

  const renderContent = () => {
    if (!isConnected) {
      return (
        <div className="card">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to participate in encrypted surveys.</p>
        </div>
      );
    }

    switch (state.view) {
      case 'create':
        return <CreateSurvey onBack={navigateToList} />;
      case 'detail':
        return state.selectedSurveyId ? (
          <SurveyDetail
            surveyId={state.selectedSurveyId}
            onBack={navigateToList}
          />
        ) : null;
      case 'list':
      default:
        return (
          <SurveyList
            onCreateSurvey={navigateToCreate}
            onViewSurvey={navigateToDetail}
          />
        );
    }
  };

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1>SafePoll</h1>
          <ConnectButton />
        </div>
        <p>Create and participate in fully encrypted surveys using FHEVM technology.</p>
      </header>

      <nav style={{ marginBottom: '2rem' }}>
        <button
          onClick={navigateToList}
          style={{
            marginRight: '1rem',
            backgroundColor: state.view === 'list' ? '#646cff' : undefined
          }}
        >
          Surveys
        </button>
        {isConnected && (
          <button
            onClick={navigateToCreate}
            style={{
              backgroundColor: state.view === 'create' ? '#646cff' : undefined
            }}
          >
            Create Survey
          </button>
        )}
      </nav>

      <main>
        {renderContent()}
      </main>

      <footer style={{ marginTop: '4rem', textAlign: 'center', color: '#666' }}>
        <p>Powered by Zama FHEVM - Your votes remain encrypted and private</p>
      </footer>
    </div>
  );
}