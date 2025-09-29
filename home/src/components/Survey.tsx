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
    <div style={{ minHeight: '100vh' }}>
      <Header />
      <main className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              className="btn btn-secondary"
              onClick={() => {
                window.history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              ← Back to Browse
            </button>
          </div>

          {loading ? (
            <div className="card">
              <div className="card-body text-center py-8">
                <div className="text-4xl mb-4">⏳</div>
                <p className="text-gray-600">Loading survey...</p>
              </div>
            </div>
          ) : info ? (
            <div className="flex flex-col gap-6">
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-3">
                    <span className="badge badge-info">#{Number(info.id)}</span>
                    <h1 className="card-title">{info.title}</h1>
                    <span className={`badge ${info.isActive ? 'badge-success' : 'badge-warning'}`}>
                      {info.isActive ? 'Active' : 'Ended'}
                    </span>
                  </div>
                  {info.description && (
                    <p className="card-description mt-2">{info.description}</p>
                  )}
                </div>

                <div className="card-body">
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <span>👥 {String(info.totalVotes)} votes</span>
                    <span>📝 {String(info.questionCount)} questions</span>
                    <span>📅 Created {new Date(Number(info.createdAt) * 1000).toLocaleDateString()}</span>
                    {isCreator && <span className="badge badge-info">You created this survey</span>}
                  </div>

                  {isCreator && (
                    <div className="flex gap-3 mt-4">
                      {info.isActive && (
                        <button onClick={endSurvey} className="btn btn-secondary">
                          End Survey
                        </button>
                      )}
                      {!info.isActive && (
                        <button onClick={requestDecryption} className="btn btn-primary">
                          Request Decryption
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {questions.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">
                      {info.isActive ? 'Submit Your Responses' : 'Survey Questions & Results'}
                    </h2>
                    <p className="card-description">
                      {info.isActive
                        ? 'Your responses will be encrypted and anonymous.'
                        : 'This survey has ended. You can view the results if they have been decrypted.'}
                    </p>
                  </div>

                  <div className="card-body">
                    <div className="flex flex-col gap-6">
                      {questions.map((q, qi) => (
                        <div key={qi} className="card bg-gray-50 border-gray-200">
                          <div className="card-body">
                            <h3 className="font-semibold text-gray-900 mb-4">
                              Question {qi + 1}: {q.text}
                            </h3>
                            <div className="flex flex-col gap-3">
                              {q.options.map((opt, oi) => (
                                <label
                                  key={oi}
                                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${
                                    choices[qi] === oi
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 hover:border-gray-300 hover:bg-white'
                                  } ${!info.isActive ? 'cursor-default' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name={`q-${qi}`}
                                    checked={choices[qi] === oi}
                                    onChange={() =>
                                      setChoices((c) =>
                                        c.map((v, idx) => (idx === qi ? oi : v))
                                      )
                                    }
                                    disabled={!info.isActive}
                                    className="w-4 h-4 text-blue-600"
                                  />
                                  <span className="flex-1">{opt}</span>
                                  {results && (
                                    <span className="badge badge-info">
                                      {results[qi][oi]} votes
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end gap-3">
                        {info.isActive && (
                          <button
                            onClick={submitVotes}
                            disabled={submitting || choices.some(c => c < 0)}
                            className="btn btn-primary"
                          >
                            {submitting ? 'Submitting...' : 'Submit Votes'}
                          </button>
                        )}

                        {!info.isActive && (
                          <button
                            onClick={publicDecryptResults}
                            disabled={decrypting}
                            className="btn btn-primary"
                          >
                            {decrypting ? 'Decrypting...' : 'View Results'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center py-8">
                <div className="text-4xl mb-4">❌</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Survey not found</h3>
                <p className="text-gray-600">The survey you're looking for doesn't exist.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

