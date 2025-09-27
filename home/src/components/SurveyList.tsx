import React, { useState, useEffect } from 'react';
import { useContract, Survey } from '../hooks/useContract';

interface SurveyListProps {
  onCreateSurvey: () => void;
  onViewSurvey: (surveyId: number) => void;
}

export function SurveyList({ onCreateSurvey, onViewSurvey }: SurveyListProps) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getSurveyInfo, getTotalSurveys } = useContract();

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const totalSurveys = await getTotalSurveys();

      if (totalSurveys === 0) {
        setSurveys([]);
        return;
      }

      const surveyPromises = [];
      for (let i = 1; i <= totalSurveys; i++) {
        surveyPromises.push(getSurveyInfo(i));
      }

      const surveyResults = await Promise.all(surveyPromises);
      const validSurveys = surveyResults.filter((survey): survey is Survey => survey !== null);

      // Sort by creation date, newest first
      validSurveys.sort((a, b) => b.createdAt - a.createdAt);

      setSurveys(validSurveys);
    } catch (err) {
      console.error('Failed to load surveys:', err);
      setError('Failed to load surveys. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading" style={{ marginBottom: '1rem' }}></div>
          <p>Loading surveys...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="error">
          {error}
          <button
            onClick={loadSurveys}
            style={{ marginLeft: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Available Surveys</h2>
        <button
          onClick={onCreateSurvey}
          style={{ backgroundColor: '#51cf66' }}
        >
          Create New Survey
        </button>
      </div>

      {surveys.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h3>No surveys found</h3>
            <p>Be the first to create an encrypted survey!</p>
            <button
              onClick={onCreateSurvey}
              style={{ backgroundColor: '#51cf66', marginTop: '1rem' }}
            >
              Create First Survey
            </button>
          </div>
        </div>
      ) : (
        <div className="survey-list">
          {surveys.map((survey) => (
            <div key={survey.id} className="survey-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3>{survey.title}</h3>
                  {survey.description && <p>{survey.description}</p>}

                  <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: '#999', marginTop: '1rem' }}>
                    <span>Questions: {survey.questionCount}</span>
                    <span>Votes: {survey.totalVotes}</span>
                    <span>Created: {formatDate(survey.createdAt)}</span>
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        backgroundColor: survey.isActive ? '#51cf66' : '#666',
                        color: 'white'
                      }}
                    >
                      {survey.isActive ? 'Active' : 'Ended'}
                    </span>
                    {survey.resultsDecrypted && (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          backgroundColor: '#646cff',
                          color: 'white',
                          marginLeft: '0.5rem'
                        }}
                      >
                        Results Available
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
                    Creator: {survey.creator.slice(0, 6)}...{survey.creator.slice(-4)}
                  </div>
                </div>

                <button
                  onClick={() => onViewSurvey(survey.id)}
                  style={{ marginLeft: '1rem' }}
                >
                  {survey.isActive ? 'View & Vote' : 'View Results'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button onClick={loadSurveys}>
          Refresh Surveys
        </button>
      </div>
    </div>
  );
}