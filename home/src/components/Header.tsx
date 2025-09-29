import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <div className="header-logo">
              🔒
            </div>
            <h1 className="header-title">
              SafePoll
            </h1>
            <span className="header-badge">
              Beta
            </span>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
