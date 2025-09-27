import React, { useState } from 'react';
import { useContract } from '../hooks/useContract';

interface CreateSurveyProps {
  onBack: () => void;
}

interface Question {
  text: string;
  options: string[];
}

export function CreateSurvey({ onBack }: CreateSurveyProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', options: ['', ''] }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const { createSurvey, error } = useContract();

  const addQuestion = () => {
    setQuestions([...questions, { text: '', options: ['', ''] }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, text: string) => {
    const newQuestions = [...questions];
    newQuestions[index].text = text;
    setQuestions(newQuestions);
  };

  const addOption = (questionIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options.push('');
    setQuestions(newQuestions);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...questions];
    if (newQuestions[questionIndex].options.length > 2) {
      newQuestions[questionIndex].options.splice(optionIndex, 1);
      setQuestions(newQuestions);
    }
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a survey title');
      return;
    }

    if (questions.some(q => !q.text.trim())) {
      alert('Please fill in all question texts');
      return;
    }

    if (questions.some(q => q.options.some(opt => !opt.trim()))) {
      alert('Please fill in all option texts');
      return;
    }

    try {
      setIsSubmitting(true);
      setSuccess(null);

      const surveyId = await createSurvey(title, description, questions);
      setSuccess(`Survey created successfully! Survey ID: ${surveyId}`);

      // Reset form
      setTitle('');
      setDescription('');
      setQuestions([{ text: '', options: ['', ''] }]);

      // Go back to list after 2 seconds
      setTimeout(() => {
        onBack();
      }, 2000);

    } catch (err) {
      console.error('Failed to create survey:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Create New Survey</h2>
        <button onClick={onBack} type="button">Back to Surveys</button>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Survey Title *</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter survey title"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter survey description (optional)"
            rows={3}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Questions</h3>
            <button type="button" onClick={addQuestion}>Add Question</button>
          </div>

          {questions.map((question, questionIndex) => (
            <div key={questionIndex} className="question">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4>Question {questionIndex + 1}</h4>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(questionIndex)}
                    style={{ backgroundColor: '#ff6b6b' }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="form-group">
                <label>Question Text *</label>
                <input
                  type="text"
                  value={question.text}
                  onChange={(e) => updateQuestion(questionIndex, e.target.value)}
                  placeholder="Enter question text"
                  required
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label>Options *</label>
                  <button
                    type="button"
                    onClick={() => addOption(questionIndex)}
                  >
                    Add Option
                  </button>
                </div>

                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      required
                      style={{ flex: 1 }}
                    />
                    {question.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(questionIndex, optionIndex)}
                        style={{ backgroundColor: '#ff6b6b' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            backgroundColor: '#51cf66',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            width: '100%'
          }}
        >
          {isSubmitting ? (
            <>
              <span className="loading" style={{ marginRight: '0.5rem' }}></span>
              Creating Survey...
            </>
          ) : (
            'Create Survey'
          )}
        </button>
      </form>
    </div>
  );
}