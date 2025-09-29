import { useState } from 'react';
import { Header } from './Header';
import { SurveyCreate } from './SurveyCreate';
import { SurveyBrowse } from './SurveyBrowse';
import '../styles/Header.css';

export function SurveyApp() {
  const [activeTab, setActiveTab] = useState<'create' | 'browse'>('browse');

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header />
      <main className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
        <div className="mb-8">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Secure Anonymous Voting Platform
            </h2>
            <p className="text-lg text-gray-600">
              Create and participate in surveys with fully encrypted, private voting
            </p>
          </div>

          <div className="flex justify-center">
            <nav className="flex gap-2 p-2 bg-white rounded-lg shadow-md border border-gray-200">
              <button
                onClick={() => setActiveTab('browse')}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  activeTab === 'browse'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Browse Surveys
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  activeTab === 'create'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Create Survey
              </button>
            </nav>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {activeTab === 'browse' && <SurveyBrowse />}
          {activeTab === 'create' && <SurveyCreate />}
        </div>
      </main>
    </div>
  );
}

