import { useEffect, useState } from 'react';
import { useReadContract, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';

type SurveyInfo = {
  id: bigint; title: string; description: string; creator: `0x${string}`; isActive: boolean; resultsDecrypted: boolean; questionCount: bigint; totalVotes: bigint; createdAt: bigint;
};

export function SurveyBrowse() {
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
  const [allSurveys, setAllSurveys] = useState<SurveyInfo[]>([]);

  // removed unused stub loader

  // Load all surveys when totalSurveys updates
  useEffect(() => {
    const loadAll = async () => {
      try {
        const total = Number(totalSurveys || 0n);
        if (!total) { setAllSurveys([]); return; }
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
      } catch (e) {
        console.error(e);
      }
    };
    loadAll();
  }, [totalSurveys, publicClient]);

  // Detail/Actions moved to dedicated Survey page

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Browse & Vote</h2>
        <p className="card-description">
          Choose a survey to participate in. All your choices are encrypted and private.
        </p>
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-gray-600">
            Total Surveys: {String(totalSurveys || 0n)}
          </span>
        </div>
      </div>

      <div className="card-body">
        {allSurveys.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No surveys available</h3>
            <p className="text-gray-600">Be the first to create a survey!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {allSurveys.map((s, idx) => (
              <div key={idx} className="card bg-gray-50 border-gray-100">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="badge badge-info">#{Number(s.id)}</span>
                        <h3 className="font-semibold text-gray-900">{s.title}</h3>
                        <span className={`badge ${s.isActive ? 'badge-success' : 'badge-warning'}`}>
                          {s.isActive ? 'Active' : 'Ended'}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{s.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>👥 {String(s.totalVotes)} votes</span>
                        <span>📝 {String(s.questionCount)} questions</span>
                        <span>📅 Created {new Date(Number(s.createdAt) * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <button className="btn btn-primary" onClick={() => { const id = String(Number(s.id)); window.history.pushState(null, '', `/survey/${id}`); window.dispatchEvent(new PopStateEvent('popstate')); }}>Participate</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
