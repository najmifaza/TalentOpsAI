import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, AlertTriangle, RefreshCw, Link2, Unlink, Info } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

const CALLBACK_MESSAGES = {
  connected: { ok: true, text: 'Google Calendar berhasil terhubung ke akun Anda.' },
  denied: { ok: false, text: 'Anda menolak permintaan izin Google Calendar.' },
  invalid_state: { ok: false, text: 'Sesi OAuth kedaluwarsa atau tidak valid. Ulangi proses connect.' },
  state_user_unresolved: { ok: false, text: 'State OAuth tidak membawa identitas pengguna. Ulangi proses connect.' },
  not_configured: { ok: false, text: 'Server belum dikonfigurasi untuk Google Calendar.' },
  token_exchange_failed: { ok: false, text: 'Penukaran kode otorisasi ke Google gagal.' },
  missing_code_or_state: { ok: false, text: 'Callback Google tidak membawa code/state.' },
  error: { ok: false, text: 'Proses connect Google Calendar gagal.' },
};

export default function CalendarPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const callbackKey = searchParams.get('calendar');
  const callbackInfo = callbackKey
    ? CALLBACK_MESSAGES[callbackKey] || { ok: false, text: `Hasil OAuth tidak dikenal: ${callbackKey}` }
    : null;

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/calendar/status`);
      if (!res.ok) {
        throw new Error(res.status === 503 ? 'Integrasi kalender belum dikonfigurasi di server.' : `Gagal memuat status (${res.status})`);
      }
      setStatus(await res.json());
    } catch (err) {
      setError(err.message || 'Gagal menghubungi backend.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/calendar/oauth/authorize`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Gagal memulai OAuth (${res.status})`);
      }
      window.location.assign(data.authorization_url);
    } catch (err) {
      setError(err.message || 'Gagal memulai OAuth.');
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/calendar/disconnect`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Gagal memutus koneksi (${res.status})`);
      }
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Gagal memutus koneksi.');
    } finally {
      setBusy(false);
    }
  };

  const dismissCallback = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('calendar');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  };

  const configured = Boolean(status?.configured);
  const connected = Boolean(status?.connected);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-extrabold text-primary-black tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-orange" />
          <span>Integrasi Google Calendar</span>
        </h2>
        <p className="text-xs text-primary-slate-600 mt-1 leading-relaxed">
          Menghubungkan akun Anda agar jadwal wawancara yang dikonfirmasi HR ikut tersinkron
          sebagai event kalender. Tanpa koneksi, penjadwalan tetap tersimpan di database.
        </p>
      </div>

      {callbackInfo && (
        <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
          callbackInfo.ok
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          {callbackInfo.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="flex-1 leading-relaxed">{callbackInfo.text}</span>
          <button onClick={dismissCallback} className="font-bold underline shrink-0">Tutup</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <div className="p-5 rounded-2xl bg-white border border-primary-border-200 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-primary-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Memuat status koneksi...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                connected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : configured
                    ? 'bg-[#f4f4f6] text-[#454554] border-[#e6e6ea]'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {connected ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                <span>{connected ? 'Terhubung' : configured ? 'Belum terhubung' : 'Server belum dikonfigurasi'}</span>
              </span>
              {status?.tag && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-slate-100 text-primary-slate-600 border border-primary-border-100">
                  {status.tag}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea]">
                <span className="text-[10px] uppercase font-bold text-[#67677e] block">Calendar ID</span>
                <span className="font-mono text-[11px] text-[#000000] break-all">{status?.calendar_id || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea]">
                <span className="text-[10px] uppercase font-bold text-[#67677e] block">Token kedaluwarsa</span>
                <span className="font-mono text-[11px] text-[#000000] break-all">
                  {status?.token_expires_at
                    ? new Date(status.token_expires_at).toLocaleString('id-ID')
                    : '—'}
                </span>
              </div>
            </div>

            {Array.isArray(status?.scopes) && status.scopes.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#67677e]">Scope OAuth</span>
                <div className="flex flex-wrap gap-1.5">
                  {status.scopes.map((scope) => (
                    <span key={scope} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#eaf0ff] text-[#1b55f5] border border-[#8ec0ff]">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConnect}
                disabled={busy || !configured}
                className="px-4 py-2 rounded-xl bg-primary-orange hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{connected ? 'Hubungkan Ulang' : 'Hubungkan Google Calendar'}</span>
              </button>
              {connected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1.5"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Putuskan</span>
                </button>
              )}
              <button
                type="button"
                onClick={loadStatus}
                disabled={isLoading || busy}
                className="px-4 py-2 rounded-xl bg-white hover:bg-[#f4f4f6] disabled:opacity-50 text-[#000000] text-xs font-semibold border border-[#e6e6ea] transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Muat Ulang</span>
              </button>
            </div>

            {!configured && (
              <div className="p-3 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea] text-[11px] text-[#454554] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#1b55f5] shrink-0 mt-0.5" />
                <span>
                  <strong>GOOGLE_CLIENT_ID</strong> dan <strong>GOOGLE_CLIENT_SECRET</strong> belum
                  diisi di <code className="font-mono">backend/.env</code>. Selama kosong, tombol
                  connect dinonaktifkan dan penjadwalan tetap memakai adapter lokal.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
