import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { Contract } from 'ethers';
import { Header } from './Header';

type SurveyInfo = {
  id: bigint; title: string; description: string; creator: `0x${string}`; isActive: boolean; resultsDecrypted: boolean; questionCount: bigint; totalVotes: bigint; createdAt: bigint;
};

function normalizeSurvey(d: any): SurveyInfo {
  return {
    id: BigInt(d?.id ?? d?.[0] ?? 0),
    title: String(d?.title ?? d?.[1] ?? ''),
    description: String(d?.description ?? d?.[2] ?? ''),
    creator: (d?.creator ?? d?.[3] ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    isActive: Boolean(d?.isActive ?? d?.[4] ?? false),
    resultsDecrypted: Boolean(d?.resultsDecrypted ?? d?.[5] ?? false),
    questionCount: BigInt(d?.questionCount ?? d?.[6] ?? 0),
    totalVotes: BigInt(d?.totalVotes ?? d?.[7] ?? 0),
    createdAt: BigInt(d?.createdAt ?? d?.[8] ?? 0),
  };
}

export function Survey() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const id = useMemo(() => {
    const m = window.location.pathname.match(/\/survey\/(\d+)/i);
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) && n > 0 ? BigInt(n) : undefined;
  }, [window.location.pathname]);

  const [info, setInfo] = useState<SurveyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<{ text: string, options: string[] }[]>([]);
  const [choices, setChoices] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [results, setResults] = useState<number[][] | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!publicClient || !id) return;
      setLoading(true);
      try {
        const raw = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getSurveyInfo', args: [id] });
        const d = normalizeSurvey(raw);
        setInfo(d);

        const arr: { text: string; options: string[] }[] = [];
        for (let i = 0; i < Number(d.questionCount); i++) {
          const [text, options] = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getQuestion', args: [id, BigInt(i)] }) as [string, string[]];
          arr.push({ text, options });
        }
        setQuestions(arr);
        setChoices(new Array(arr.length).fill(-1));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [publicClient, id]);

  const submitVotes = async () => {
    if (!instance) return alert('Loading Zama');
    if (!signerPromise) return alert('Connect wallet');
    if (!id || !info) return;
    if (choices.some((c) => c < 0)) return alert('Select all answers');

    setSubmitting(true);
    try {
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      for (const c of choices) input.add32(c);
      const encrypted = await input.encrypt();
      const signer = await signerPromise;
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      await (await c.submitVotes(id, encrypted.handles, encrypted.inputProof)).wait();
      alert('Votes submitted');
    } catch (e) {
      console.error(e);
      alert('Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const endSurvey = async () => {
    if (!signerPromise || !id) return;
    try {
      const signer = await signerPromise;
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      await (await c.endSurvey(id)).wait();
    } catch (e) {
      console.error(e);
      alert('End failed');
    }
  };

  const requestDecryption = async () => {
    if (!signerPromise || !id) return;
    try {
      const signer = await signerPromise;
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      await (await c.requestDecryption(id)).wait();
      alert('Decryption requested');
    } catch (e) {
      console.error(e);
      alert('Request failed');
    }
  };

  const publicDecryptResults = async () => {
    if (!instance || !id || !info || !publicClient) return;
    setDecrypting(true);
    try {
      // collect handles for all option counts
      const handles: string[] = [];
      for (let qi = 0; qi < Number(info.questionCount); qi++) {
        const [_, options] = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getQuestion', args: [id, BigInt(qi)] }) as [string, string[]];
        for (let oi = 0; oi < options.length; oi++) {
          const h = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getEncryptedOptionCount', args: [id, BigInt(qi), BigInt(oi)] }) as `0x${string}`;
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Header />
      <main className="main-content">
        <div className="status-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="submit-button" style={{ width: 'auto' }} onClick={() => { window.history.pushState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}>Back</button>
            <h2 className="status-title" style={{ margin: 0 }}>Survey</h2>
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

              {!loading && questions.length > 0 && (
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
      </main>
    </div>
  );
}

