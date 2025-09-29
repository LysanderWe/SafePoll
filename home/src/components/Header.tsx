import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/Header.css';

export function Header() {
  const { data: totalSurveys } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalSurveys'
  });

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div className="header-brand">
              <div className="header-logo">
                🗳️
              </div>
              <div>
                <h1 className="header-title">
                  SafePoll
                </h1>
                <div className="header-tagline">
                  Encrypted Anonymous Voting
                </div>
              </div>
            </div>
            <span className="header-badge">
              Beta v1.0
            </span>
          </div>

          <div className="header-right">
            <div className="header-stats">
              <div className="header-stat">
                <span className="header-stat-number">{String(totalSurveys || 0n)}</span>
                <span className="header-stat-label">Surveys</span>
              </div>
              <div className="header-stat">
                <span className="header-stat-number">🔐</span>
                <span className="header-stat-label">Encrypted</span>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
