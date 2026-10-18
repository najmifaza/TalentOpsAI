import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Database, Server, ShieldCheck, X } from 'lucide-react';

export default function HealthStatusBadge() {
  const [health, setHealth] = useState(null);
  const [latency, setLatency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const response = await fetch(`${apiBase}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      const end = performance.now();
      setLatency(Math.round(end - start));

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setHealth(data);
    } catch (err) {
      console.error('Health check failed:', err);
      setError(err.message);
      setHealth({ status: 'offline', database: 'unreachable' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === 'healthy';
  const isConnected = health?.database === 'connected';

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-[#E1EBE4] hover:border-[#8EB69B] shadow-sm hover:shadow transition-all duration-200 shrink-0 btn-interactive"
        title="Klik untuk melihat detail koneksi VPS & Database (Sprint 1 Walking Skeleton)"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {loading ? (
            <span className="animate-spin h-2.5 w-2.5 border-2 border-[#235347] border-t-transparent rounded-full"></span>
          ) : isHealthy && isConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          )}
        </span>

        <span className="text-[#3D544E] flex items-center gap-1 sm:gap-1.5">
          <Server className="w-3.5 h-3.5 text-[#235347] shrink-0" />
          <span className="hidden sm:inline text-[#0B201B] font-semibold">VPS Cloud:</span>
          <span className={isHealthy ? 'text-[#10B981] font-bold' : 'text-rose-600 font-bold'}>
            {loading ? 'Pinging...' : isHealthy ? 'ONLINE' : 'OFFLINE'}
          </span>
        </span>

        {latency !== null && (
          <span className="text-[#6C837C] border-l border-[#E1EBE4] pl-1.5 sm:pl-2 font-mono text-[10px] sm:text-[11px]">
            {latency}ms
          </span>
        )}
      </button>

      {/* Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#051F20]/70 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E1EBE4] rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#E1EBE4]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#DAF1DE] rounded-xl text-[#0B2B26]">
                  <Activity className="w-5 h-5 text-[#235347]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0B201B] text-sm">Walking Skeleton Pipeline Status</h3>
                  <p className="text-[11px] text-[#6C837C]">Verifikasi DoD Sprint 1 (Vercel &rarr; VPS MariaDB)</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#6C837C] hover:text-[#0B201B] p-1.5 rounded-lg hover:bg-[#EEF4F0] transition-colors"
                aria-label="Tutup modal status"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="p-3 bg-[#F6FAF7] rounded-xl border border-[#E1EBE4] flex items-center justify-between">
                <span className="text-xs text-[#3D544E] flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#235347]" /> Backend Engine (VPS)
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white text-[#0B2B26] border border-[#E1EBE4]">
                  {apiBase}
                </span>
              </div>

              <div className="p-3 bg-[#F6FAF7] rounded-xl border border-[#E1EBE4] flex items-center justify-between">
                <span className="text-xs text-[#3D544E] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#10B981]" /> API Health Endpoint
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isHealthy ? 'bg-[#DAF1DE] text-[#0B2B26] border border-[#C2E0C4]' : 'bg-rose-100 text-rose-700'}`}>
                  {isHealthy ? <CheckCircle2 className="w-3 h-3 text-[#10B981]" /> : <XCircle className="w-3 h-3" />}
                  {health?.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>

              <div className="p-3 bg-[#F6FAF7] rounded-xl border border-[#E1EBE4] flex items-center justify-between">
                <span className="text-xs text-[#3D544E] flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#235347]" /> Database ACID (MariaDB)
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isConnected ? 'bg-[#DAF1DE] text-[#0B2B26] border border-[#C2E0C4]' : 'bg-rose-100 text-rose-700'}`}>
                  {isConnected ? <CheckCircle2 className="w-3 h-3 text-[#10B981]" /> : <AlertTriangle className="w-3 h-3" />}
                  {health?.database?.toUpperCase() || 'DISCONNECTED'}
                </span>
              </div>

              <div className="p-3 bg-[#F6FAF7] rounded-xl border border-[#E1EBE4] flex items-center justify-between">
                <span className="text-xs text-[#3D544E] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#235347]" /> Demo Mode Active
                </span>
                <span className="text-[11px] font-mono text-[#0B2B26] font-semibold">
                  {health?.demo_mode ? 'ENABLED (Safe Sandbox)' : 'DISABLED'}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between pt-4 border-t border-[#E1EBE4]">
              <span className="text-xs text-[#6C837C]">
                Latensi RTT: <strong className="text-[#0B201B]">{latency} ms</strong>
              </span>
              <button
                onClick={checkHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0B2B26] hover:bg-[#163832] text-white font-medium rounded-xl text-xs transition-colors shadow-sm btn-interactive"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Uji Ulang Ping
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
