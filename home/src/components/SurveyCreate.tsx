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
    <div className="status-card">
      <h2 className="status-title">Create Survey</h2>
      <form onSubmit={onSubmit} className="form">
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="text-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="form-group" style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="form-label">Question {qi + 1}</label>
              {questions.length > 1 && (
                <button type="button" onClick={() => removeQuestion(qi)} className="refresh-button">Remove</button>
              )}
            </div>
            <input className="text-input" placeholder="Question text" value={q.text} onChange={(e) => setQText(qi, e.target.value)} />
            <div style={{ marginTop: 8 }}>
              <label className="form-label">Options</label>
              {q.options.map((o, oi) => (
                <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input className="text-input" placeholder={`Option ${oi + 1}`} value={o} onChange={(e) => setQOpt(qi, oi, e.target.value)} />
                  {q.options.length > 1 && (
                    <button type="button" onClick={() => rmOpt(qi, oi)} className="refresh-button">-</button>
                  )}
                  <button type="button" onClick={() => addOpt(qi)} className="refresh-button">+</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={addQuestion} className="submit-button" style={{ width: 'auto' }}>Add Question</button>
          <button type="submit" disabled={submitting} className="submit-button" style={{ width: 'auto' }}>{submitting ? 'Creating...' : 'Create Survey'}</button>
        </div>
      </form>
    </div>
  );
}
