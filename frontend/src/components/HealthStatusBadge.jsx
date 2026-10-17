import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Database, Server, ShieldCheck } from 'lucide-react';

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
    // Auto-ping every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === 'healthy';
  const isConnected = health?.database === 'connected';

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 glass-panel glass-panel-hover"
        title="Klik untuk melihat detail koneksi VPS & Database (Sprint 1 Walking Skeleton)"
      >
        <span className="relative flex h-2.5 w-2.5">
          {loading ? (
            <span className="animate-spin h-2.5 w-2.5 border-2 border-cyan-400 border-t-transparent rounded-full"></span>
          ) : isHealthy && isConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          )}
        </span>

        <span className="text-slate-300 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          <span>VPS:</span>
          <span className={isHealthy ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
            {loading ? 'Pinging...' : isHealthy ? 'LIVE' : 'OFFLINE'}
          </span>
        </span>

        {latency !== null && (
          <span className="text-slate-400 border-l border-slate-700 pl-2">
            {latency}ms
          </span>
        )}
      </button>

      {/* Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">Walking Skeleton Pipeline Status</h3>
                  <p className="text-xs text-slate-400">Verifikasi DoD Sprint 1 (Vercel &rarr; VPS MariaDB)</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-sm text-slate-400 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" /> Backend Engine (VPS)
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {apiBase}
                </span>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-sm text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> API Health Status
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${isHealthy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'}`}>
                  {isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {health?.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-sm text-slate-400 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" /> Database ACID (MariaDB)
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${isConnected ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-rose-500/10 text-rose-400'}`}>
                  {isConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {health?.database?.toUpperCase() || 'DISCONNECTED'}
                </span>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-sm text-slate-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Demo Mode Active
                </span>
                <span className="text-xs font-mono text-slate-300">
                  {health?.demo_mode ? 'ENABLED (Safe Sandbox)' : 'DISABLED'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Ping latency: <strong className="text-cyan-400">{latency} ms</strong>
              </span>
              <button
                onClick={checkHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg text-xs transition-colors"
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
