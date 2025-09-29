import { useState } from 'react';
import { Header } from './Header';
import { SurveyCreate } from './SurveyCreate';
import { SurveyBrowse } from './SurveyBrowse';
import '../styles/Header.css';

export function SurveyApp() {
  const [activeTab, setActiveTab] = useState<'create' | 'browse'>('browse');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Header />
      <main className="main-content">
        <div className="tab-navigation">
          <nav className="tab-nav">
            <button onClick={() => setActiveTab('browse')} className={`tab-button ${activeTab === 'browse' ? 'active' : 'inactive'}`}>
              Browse Surveys
            </button>
            <button onClick={() => setActiveTab('create')} className={`tab-button ${activeTab === 'create' ? 'active' : 'inactive'}`}>
              Create Survey
            </button>
          </nav>
        </div>

        {activeTab === 'browse' && <SurveyBrowse />}
        {activeTab === 'create' && <SurveyCreate />}
      </main>
    </div>
  );
}

