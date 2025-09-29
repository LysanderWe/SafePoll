import { useState } from 'react';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';

type NewQuestion = { text: string; options: string[] };

export function SurveyCreate() {
  const signerPromise = useEthersSigner();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<NewQuestion[]>([{ text: '', options: ['', ''] }]);
  const [submitting, setSubmitting] = useState(false);

  const addQuestion = () => setQuestions((q) => [...q, { text: '', options: ['', ''] }]);
  const removeQuestion = (i: number) => setQuestions((q) => q.filter((_, idx) => idx !== i));
  const setQText = (i: number, v: string) => setQuestions((q) => q.map((it, idx) => (idx === i ? { ...it, text: v } : it)));
  const setQOpt = (qi: number, oi: number, v: string) =>
    setQuestions((q) => q.map((it, idx) => (idx === qi ? { ...it, options: it.options.map((o, j) => (j === oi ? v : o)) } : it)));
  const addOpt = (qi: number) => setQuestions((q) => q.map((it, idx) => (idx === qi ? { ...it, options: [...it.options, ''] } : it)));
  const rmOpt = (qi: number, oi: number) => setQuestions((q) => q.map((it, idx) => (idx === qi ? { ...it, options: it.options.filter((_, j) => j !== oi) } : it)));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerPromise) return alert('Connect wallet');
    if (!title || questions.length === 0 || questions.some((q) => !q.text || q.options.length === 0 || q.options.some((o) => !o)))
      return alert('Fill all fields');

    setSubmitting(true);
    try {
      const signer = await signerPromise;
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const qTexts = questions.map((q) => q.text);
      const qOptions = questions.map((q) => q.options);
      const tx = await c.createSurvey(title, description, qTexts, qOptions);
      await tx.wait();
      setTitle('');
      setDescription('');
      setQuestions([{ text: '', options: ['', ''] }]);
      alert('Survey created');
    } catch (e) {
      console.error(e);
      alert('Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Create Survey</h2>
        <p className="card-description">
          Create a new survey with encrypted responses. All votes will be private and secure.
        </p>
      </div>

      <div className="card-body">
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="form-group">
            <label className="form-label">Survey Title *</label>
            <input
              className="form-input"
              placeholder="Enter a descriptive title for your survey"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input form-textarea"
              placeholder="Provide additional context about your survey (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Questions</h3>
              <button
                type="button"
                onClick={addQuestion}
                className="btn btn-outline"
              >
                + Add Question
              </button>
            </div>

            {questions.map((q, qi) => (
              <div key={qi} className="card bg-gray-50 border-gray-200">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Question {qi + 1}</h4>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(qi)}
                        className="btn btn-secondary text-red-600 hover:bg-red-50 hover:border-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Question Text *</label>
                    <input
                      className="form-input"
                      placeholder="Enter your question"
                      value={q.text}
                      onChange={(e) => setQText(qi, e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Answer Options *</label>
                    <div className="flex flex-col gap-2">
                      {q.options.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            className="form-input flex-1"
                            placeholder={`Option ${oi + 1}`}
                            value={o}
                            onChange={(e) => setQOpt(qi, oi, e.target.value)}
                          />
                          <div className="flex gap-1">
                            {q.options.length > 1 && (
                              <button
                                type="button"
                                onClick={() => rmOpt(qi, oi)}
                                className="btn btn-secondary w-10 h-10 p-0 text-red-600 hover:bg-red-50"
                                title="Remove option"
                              >
                                −
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => addOpt(qi)}
                              className="btn btn-secondary w-10 h-10 p-0 text-blue-600 hover:bg-blue-50"
                              title="Add option"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? 'Creating Survey...' : 'Create Survey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
