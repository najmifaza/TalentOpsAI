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
      let response;
      try {
        response = await fetch(`${apiBase}/api/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
      } catch (directErr) {
        // Fallback to relative endpoint proxied by Vercel rewrite
        response = await fetch('/api/health', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
      }
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
        className="flex items-center gap-1.5 sm:gap-2.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-[#e6e6ea] hover:border-[#1b55f5] shadow-2xs hover:shadow-xs transition-all duration-200 shrink-0"
        title="Klik untuk melihat detail koneksi VPS & Database (Sprint 1 Walking Skeleton)"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {loading ? (
            <span className="animate-spin h-2 w-2 border-2 border-[#1b55f5] border-t-transparent rounded-full"></span>
          ) : isHealthy && isConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          )}
        </span>

        <span className="text-[#454554] flex items-center gap-1 sm:gap-1.5">
          <Server className="w-3.5 h-3.5 text-[#1b55f5] shrink-0" />
          <span className="hidden sm:inline text-[#000000] font-semibold">VPS Cloud:</span>
          <span className={isHealthy ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
            {loading ? 'Pinging...' : isHealthy ? 'ONLINE' : 'OFFLINE'}
          </span>
        </span>

        {latency !== null && (
          <span className="text-[#67677e] border-l border-[#e6e6ea] pl-1.5 sm:pl-2 font-mono text-[10px] sm:text-[11px]">
            {latency}ms
          </span>
        )}
      </button>

      {/* Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#e6e6ea] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#e6e6ea]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#eaf0ff] rounded-xl text-[#1b55f5]">
                  <Activity className="w-5 h-5 text-[#1b55f5]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#000000] text-sm">Status Infrastruktur Sistem</h3>
                  <p className="text-[11px] text-[#67677e]">Konektivitas Live API &amp; Basis Data MariaDB</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#67677e] hover:text-[#000000] p-1.5 rounded-lg hover:bg-[#f4f4f6] transition-colors"
                aria-label="Tutup modal status"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="p-3 bg-[#f4f4f6] rounded-xl border border-[#e6e6ea] flex items-center justify-between">
                <span className="text-xs text-[#454554] flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#1b55f5]" /> Backend Engine (VPS)
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white text-[#000000] border border-[#e6e6ea]">
                  {apiBase}
                </span>
              </div>

              <div className="p-3 bg-[#f4f4f6] rounded-xl border border-[#e6e6ea] flex items-center justify-between">
                <span className="text-xs text-[#454554] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" /> API Health Endpoint
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isHealthy ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {isHealthy ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3" />}
                  {health?.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>

              <div className="p-3 bg-[#f4f4f6] rounded-xl border border-[#e6e6ea] flex items-center justify-between">
                <span className="text-xs text-[#454554] flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#1b55f5]" /> Database ACID (MariaDB)
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isConnected ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {isConnected ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertTriangle className="w-3 h-3" />}
                  {health?.database?.toUpperCase() || 'DISCONNECTED'}
                </span>
              </div>

              <div className="p-3 bg-[#f4f4f6] rounded-xl border border-[#e6e6ea] flex items-center justify-between">
                <span className="text-xs text-[#454554] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1b55f5]" /> Demo Mode Active
                </span>
                <span className="text-[11px] font-mono text-[#000000] font-semibold">
                  {health?.demo_mode ? 'ENABLED (Safe Sandbox)' : 'DISABLED'}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between pt-4 border-t border-[#e6e6ea]">
              <span className="text-xs text-[#67677e]">
                Latensi RTT: <strong className="text-[#000000]">{latency} ms</strong>
              </span>
              <button
                onClick={checkHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b55f5] hover:bg-[#1545c7] text-white font-medium rounded-lg text-xs transition-colors shadow-xs"
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
