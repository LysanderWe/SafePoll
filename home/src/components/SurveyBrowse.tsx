import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
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
  const publicClient = usePublicClient();

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

  const { data: totalSurveys } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getTotalSurveys' });
  const [surveyId, setSurveyId] = useState<string>('');
  const [allSurveys, setAllSurveys] = useState<SurveyInfo[]>([]);
  const parsedId = useMemo(() => { const n = Number(surveyId); return Number.isFinite(n) && n > 0 ? BigInt(n) : undefined; }, [surveyId]);

  const { data: info } = useReadContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getSurveyInfo', args: parsedId ? [parsedId] : undefined, query: { enabled: !!parsedId } }) as { data?: SurveyInfo };

  const [questions, setQuestions] = useState<{ text: string, options: string[] }[]>([]);
  const [choices, setChoices] = useState<number[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [results, setResults] = useState<number[][] | null>(null);

  // removed unused stub loader

  // Load all surveys when totalSurveys updates
  useEffect(() => {
    const loadAll = async () => {
      try {
        const total = Number(totalSurveys || 0n);
        if (!total) {
          setAllSurveys([]);
          setSurveyId('');
          return;
        }
        if (!publicClient) return;
        const list: SurveyInfo[] = [] as any;
        for (let i = 1; i <= total; i++) {
          const data = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getSurveyInfo',
            args: [BigInt(i)],
          });
          list.push(normalizeSurvey(data));
        }
        setAllSurveys(list);
        // auto-select first if none selected
        if (!parsedId) setSurveyId('1');
      } catch (e) {
        console.error(e);
      }
    };
    loadAll();
  }, [totalSurveys, publicClient]);

  // Lightweight question loader using viem read calls sequentially
  useEffect(() => {
    const load = async () => {
      if (!parsedId || !info) return;
      setLoadingQs(true);
      try {
        const arr: { text: string; options: string[] }[] = [];
        const qCount = Number(((info as any)?.questionCount ?? (info as any)?.[6] ?? 0));
        for (let i = 0; i < qCount; i++) {
          if (!publicClient) return;
          const [text, options] = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getQuestion', args: [parsedId, BigInt(i)] }) as [string, string[]];
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
  }, [parsedId, info, publicClient]);

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
      if (!publicClient) return;
      for (let qi = 0; qi < Number(info.questionCount); qi++) {
        const [_, options] = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getQuestion', args: [parsedId, BigInt(qi)] }) as [string, string[]];
        for (let oi = 0; oi < options.length; oi++) {
          const h = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getEncryptedOptionCount', args: [parsedId, BigInt(qi), BigInt(oi)] }) as `0x${string}`;
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

  const infoCreator = (info && ((info as any).creator ?? (info as any)?.[3])) as string | undefined;
  const isCreator = !!infoCreator && !!address && infoCreator.toLowerCase() === address.toLowerCase();

  return (
    <div className="status-card">
      <h2 className="status-title">Browse & Vote</h2>
      <div>Choose a survey. All your choices are encrypted. </div>
      <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="form-label">Total Surveys: {String(totalSurveys || 0n)}</div>
      </div>

      {/* List all surveys */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allSurveys.map((s, idx) => (
          <div key={idx} className="status-item" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="status-label">#{Number(s.id)} — {s.title}</div>
              <div className="status-value" style={{ color: '#6b7280' }}>{s.description}</div>
            </div>
            <div className="status-item" style={{ border: 'none' }}>
              <div className="status-label">Status</div>
              <div className="status-value">{s.isActive ? 'Active' : 'Ended'}</div>
            </div>
            <div className="status-item" style={{ border: 'none' }}>
              <div className="status-label">Votes</div>
              <div className="status-value">{String(s.totalVotes)}</div>
            </div>
            <button
              className="submit-button"
              style={{ width: 'auto' }}
              onClick={() => {
                const id = String(Number(s.id));
                window.history.pushState(null, '', `/survey/${id}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              Open
            </button>
          </div>
        ))}
      </div>

      {/* Detail view has moved to /survey/:id */}
    </div>
  );
}
