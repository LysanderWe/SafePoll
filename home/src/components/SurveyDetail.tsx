import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useContract, Survey, Question } from '../hooks/useContract';
import { useFhevm } from '../hooks/useFhevm';
import { SAFEPOLL_CONTRACT_ADDRESS } from '../config/contracts';

interface SurveyDetailProps {
  surveyId: number;
  onBack: () => void;
}

export function SurveyDetail({ surveyId, onBack }: SurveyDetailProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { address } = useAccount();
  const { getSurveyInfo, getQuestion, hasUserVoted, submitVotes, endSurvey } = useContract();
  const { instance: fhevmInstance, isLoading: fhevmLoading } = useFhevm();

  useEffect(() => {
    loadSurveyDetails();
  }, [surveyId, address]);

  const loadSurveyDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const surveyInfo = await getSurveyInfo(surveyId);
      if (!surveyInfo) {
        setError('Survey not found');
        return;
      }

      setSurvey(surveyInfo);

      // Load all questions
      const questionPromises = [];
      for (let i = 0; i < surveyInfo.questionCount; i++) {
        questionPromises.push(getQuestion(surveyId, i));
      }

      const questionResults = await Promise.all(questionPromises);
      const validQuestions = questionResults.filter((q): q is Question => q !== null);
      setQuestions(validQuestions);

      // Initialize selected answers array
      setSelectedAnswers(new Array(validQuestions.length).fill(-1));

      // Check if user has voted
      if (address) {
        const voted = await hasUserVoted(surveyId, address);
        setHasVoted(voted);
      }

    } catch (err) {
      console.error('Failed to load survey details:', err);
      setError('Failed to load survey details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex: number, optionIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[questionIndex] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleSubmitVotes = async () => {
    if (!fhevmInstance) {
      setError('FHEVM not initialized');
      return;
    }

    if (!address) {
      setError('Wallet not connected');
      return;
    }

    if (selectedAnswers.some(answer => answer === -1)) {
      setError('Please answer all questions');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      // Create encrypted input for all votes
      const input = fhevmInstance.createEncryptedInput(SAFEPOLL_CONTRACT_ADDRESS, address);

      // Add each vote as encrypted input
      selectedAnswers.forEach(answer => {
        input.add32(answer);
      });

      const encryptedInput = await input.encrypt();

      // Submit votes to contract
      const txHash = await submitVotes(surveyId, encryptedInput.handles, encryptedInput.inputProof);

      setSuccess(`Votes submitted successfully! Transaction: ${txHash}`);
      setHasVoted(true);

      // Reload survey details to update vote count
      setTimeout(() => {
        loadSurveyDetails();
      }, 2000);

    } catch (err) {
      console.error('Failed to submit votes:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit votes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndSurvey = async () => {
    if (!address || !survey) return;

    try {
      setIsEnding(true);
      setError(null);

      const txHash = await endSurvey(surveyId);
      setSuccess(`Survey ended successfully! Transaction: ${txHash}`);

      // Reload survey details
      setTimeout(() => {
        loadSurveyDetails();
      }, 2000);

    } catch (err) {
      console.error('Failed to end survey:', err);
      setError(err instanceof Error ? err.message : 'Failed to end survey');
    } finally {
      setIsEnding(false);
    }
  };

  const canVote = survey?.isActive && !hasVoted && address;
  const isCreator = survey?.creator.toLowerCase() === address?.toLowerCase();
  const canEndSurvey = isCreator && survey?.isActive;

  if (isLoading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading" style={{ marginBottom: '1rem' }}></div>
          <p>Loading survey details...</p>
        </div>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="card">
        <div className="error">
          {error}
          <button onClick={onBack} style={{ marginLeft: '1rem' }}>
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="card">
        <div className="error">
          Survey not found
          <button onClick={onBack} style={{ marginLeft: '1rem' }}>
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>{survey.title}</h2>
        <button onClick={onBack}>Back to Surveys</button>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div style={{ marginBottom: '2rem' }}>
        {survey.description && <p>{survey.description}</p>}

        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: '#999', marginTop: '1rem' }}>
          <span>Questions: {survey.questionCount}</span>
          <span>Total Votes: {survey.totalVotes}</span>
          <span>Created: {new Date(survey.createdAt * 1000).toLocaleDateString()}</span>
        </div>

        <div style={{ marginTop: '1rem' }}>
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
      </div>

      {questions.map((question, questionIndex) => (
        <div key={questionIndex} className="question">
          <h4>Question {questionIndex + 1}: {question.text}</h4>

          <div className="options">
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="option">
                <input
                  type="radio"
                  id={`q${questionIndex}_o${optionIndex}`}
                  name={`question_${questionIndex}`}
                  value={optionIndex}
                  checked={selectedAnswers[questionIndex] === optionIndex}
                  onChange={() => handleAnswerChange(questionIndex, optionIndex)}
                  disabled={!canVote}
                />
                <label htmlFor={`q${questionIndex}_o${optionIndex}`}>
                  {option}
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        {canVote && (
          <button
            onClick={handleSubmitVotes}
            disabled={isSubmitting || fhevmLoading || selectedAnswers.some(answer => answer === -1)}
            style={{
              backgroundColor: '#51cf66',
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              flex: 1
            }}
          >
            {isSubmitting ? (
              <>
                <span className="loading" style={{ marginRight: '0.5rem' }}></span>
                Submitting Encrypted Votes...
              </>
            ) : (
              'Submit Encrypted Votes'
            )}
          </button>
        )}

        {canEndSurvey && (
          <button
            onClick={handleEndSurvey}
            disabled={isEnding}
            style={{
              backgroundColor: '#ff6b6b',
              padding: '1rem 2rem',
              fontSize: '1.1rem'
            }}
          >
            {isEnding ? (
              <>
                <span className="loading" style={{ marginRight: '0.5rem' }}></span>
                Ending Survey...
              </>
            ) : (
              'End Survey'
            )}
          </button>
        )}
      </div>

      {hasVoted && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#1a2a1a', border: '1px solid #51cf66', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#51cf66' }}>
            ✓ You have already voted in this survey. Your votes are encrypted and private.
          </p>
        </div>
      )}

      {!survey.isActive && !hasVoted && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#2a1a1a', border: '1px solid #666', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#999' }}>
            This survey has ended and is no longer accepting votes.
          </p>
        </div>
      )}

      {!address && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#2a1a1a', border: '1px solid #646cff', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#646cff' }}>
            Connect your wallet to participate in this survey.
          </p>
        </div>
      )}
    </div>
  );
}