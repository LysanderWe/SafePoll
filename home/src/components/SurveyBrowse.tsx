import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { Contract } from 'ethers';

type SurveyInfo = {
  id: bigint; title: string; description: string; creator: `0x${string}`; isActive: boolean; resultsDecrypted: boolean; questionCount: bigint; totalVotes: bigint; createdAt: bigint;
};

export function SurveyBrowse() {
  const { address } = useAccount();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const { data: totalSurveys } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getTotalSurveys' });
  const [surveyId, setSurveyId] = useState<string>('1');
  const parsedId = useMemo(() => { const n = Number(surveyId); return Number.isFinite(n) && n > 0 ? BigInt(n) : undefined; }, [surveyId]);

  const { data: info } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getSurveyInfo', args: parsedId ? [parsedId] : undefined, query: { enabled: !!parsedId } }) as { data?: SurveyInfo };

  const [questions, setQuestions] = useState<{ text: string, options: string[] }[]>([]);
  const [choices, setChoices] = useState<number[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [results, setResults] = useState<number[][] | null>(null);

  // removed unused stub loader

  // Lightweight question loader using viem read calls sequentially
  useEffect(() => {
    const load = async () => {
      if (!parsedId || !info) return;
      setLoadingQs(true);
      try {
        const arr: { text: string; options: string[] }[] = [];
        for (let i = 0; i < Number(info.questionCount); i++) {
          const res = await (window as any).wagmi?.getPublicClient?.(); // avoid lints
          // Instead of above, call through wagmi's viem client via public client
          const { getPublicClient } = await import('wagmi/actions');
          const client = getPublicClient();
          // @ts-ignore chain is set by provider
          const [text, options] = await client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getQuestion', args: [parsedId, BigInt(i)] }) as [string, string[]];
          arr.push({ text, options });
        }
        setQuestions(arr);
        setChoices(new Array(arr.length).fill(-1));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingQs(false);
      }
    };
    load();
  }, [parsedId, info]);

  const submitVotes = async () => {
    if (!instance) return alert('Loading Zama');
    if (!signerPromise) return alert('Connect wallet');
    if (!parsedId || !info) return;
    if (choices.some((c) => c < 0)) return alert('Select all answers');

    setSubmitting(true);
    try {
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      for (const c of choices) input.add32(c);
      const encrypted = await input.encrypt();
      const signer = await signerPromise;
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      await (await c.submitVotes(parsedId, encrypted.handles, encrypted.inputProof)).wait();
      alert('Votes submitted');
    } catch (e) {
      console.error(e);
      alert('Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const endSurvey = async () => {
    if (!signerPromise || !parsedId) return;
    try {
      const signer = await signerPromise;
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      await (await c.endSurvey(parsedId)).wait();
    } catch (e) {
      console.error(e);
      alert('End failed');
    }
  };

  const requestDecryption = async () => {
    if (!signerPromise || !parsedId) return;
    try {
      const signer = await signerPromise;
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      await (await c.requestDecryption(parsedId)).wait();
      alert('Decryption requested');
    } catch (e) {
      console.error(e);
      alert('Request failed');
    }
  };

  const publicDecryptResults = async () => {
    if (!instance || !parsedId || !info) return;
    setDecrypting(true);
    try {
      // collect handles for all option counts
      const handles: string[] = [];
      for (let qi = 0; qi < Number(info.questionCount); qi++) {
        const { getPublicClient } = await import('wagmi/actions');
        const client = getPublicClient();
        const [_, options] = await client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getQuestion', args: [parsedId, BigInt(qi)] }) as [string, string[]];
        for (let oi = 0; oi < options.length; oi++) {
          const h = await client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getEncryptedOptionCount', args: [parsedId, BigInt(qi), BigInt(oi)] }) as `0x${string}`;
          handles.push(h);
        }
      }
      const map = await instance.publicDecrypt(handles);
      // rebuild grid
      const out: number[][] = [];
      let k = 0;
      for (let qi = 0; qi < questions.length; qi++) {
        const row: number[] = [];
        for (let oi = 0; oi < questions[qi].options.length; oi++, k++) {
          const h = handles[k] as string;
          const v = map[h];
          row.push(Number(v));
        }
        out.push(row);
      }
      setResults(out);
    } catch (e) {
      console.error(e);
      alert('Decrypt failed. Ensure creator requested decryption.');
    } finally {
      setDecrypting(false);
    }
  };

  const isCreator = info && address && info.creator.toLowerCase() === address.toLowerCase();

  return (
    <div className="status-card">
      <h2 className="status-title">Browse & Vote</h2>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label className="form-label">Survey ID</label>
        <input className="text-input" style={{ maxWidth: 140 }} value={surveyId} onChange={(e) => setSurveyId(e.target.value)} />
        <div style={{ color: '#6b7280' }}>Total: {String(totalSurveys || 0n)}</div>
      </div>

      {info && (
        <div style={{ marginTop: 8 }}>
          <div className="status-item">
            <div className="status-label">Title</div>
            <div className="status-value">{info.title}</div>
          </div>
          <div className="status-item" style={{ marginTop: 8 }}>
            <div className="status-label">Description</div>
            <div className="status-value">{info.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div className="status-item" style={{ flex: 1 }}>
              <div className="status-label">Status</div>
              <div className="status-value">{info.isActive ? 'Active' : 'Ended'}</div>
            </div>
            <div className="status-item" style={{ flex: 1 }}>
              <div className="status-label">Votes</div>
              <div className="status-value">{String(info.totalVotes)}</div>
            </div>
          </div>

          {isCreator && (
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              {info.isActive && <button onClick={endSurvey} className="submit-button" style={{ width: 'auto' }}>End Survey</button>}
              {!info.isActive && <button onClick={requestDecryption} className="submit-button" style={{ width: 'auto' }}>Request Decryption</button>}
            </div>
          )}

          {!loadingQs && questions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {questions.map((q, qi) => (
                <div key={qi} className="status-item" style={{ marginBottom: 8 }}>
                  <div className="status-label">Q{qi + 1}: {q.text}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {q.options.map((opt, oi) => (
                      <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="radio" name={`q-${qi}`} checked={choices[qi] === oi} onChange={() => setChoices((c) => c.map((v, idx) => idx === qi ? oi : v))} disabled={!info.isActive} />
                        <span>{opt}</span>
                        {results && <span style={{ marginLeft: 'auto', color: '#6b7280' }}>{results[qi][oi]}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {info.isActive && (
                <button onClick={submitVotes} disabled={submitting} className="submit-button" style={{ width: 'auto' }}>
                  {submitting ? 'Submitting...' : 'Submit Votes'}
                </button>
              )}

              {!info.isActive && (
                <button onClick={publicDecryptResults} disabled={decrypting} className="submit-button" style={{ width: 'auto', marginTop: 8 }}>
                  {decrypting ? 'Decrypting...' : 'Decrypt Public Results'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
