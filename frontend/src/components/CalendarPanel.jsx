import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Clock,
  User,
  Briefcase,
  ShieldCheck,
  CalendarCheck2
} from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

export default function CalendarPanel() {
  const [slots, setSlots] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSlots = useCallback(async (statusFilter = filterStatus) => {
    setIsLoading(true);
    setError(null);
    try {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await fetch(`${API_BASE_URL}/api/slots${q}`);
      if (!res.ok) {
        throw new Error(`Gagal memuat jadwal wawancara (${res.status})`);
      }
      const json = await res.json();
      setSlots(json.data || []);
    } catch (err) {
      setError(err.message || 'Gagal menghubungi backend.');
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const statusBadge = (status) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Tersedia
          </span>
        );
      case 'booked':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-primary-black text-white">
            <CalendarCheck2 className="w-3 h-3 text-primary-orange" />
            Dipesan
          </span>
        );
      case 'tentative':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            Tentatif (Terkunci)
          </span>
        );
      default:
        return (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-primary-slate-100 text-primary-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 max-w-5xl font-jkt">
      {/* Title & Overview Banner */}
      <div>
        <h2 className="text-xl font-extrabold text-primary-black tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-orange" />
          <span>Jadwal Wawancara &amp; Ekspor Kalender</span>
        </h2>
        <p className="text-xs text-primary-slate-600 mt-1 leading-relaxed">
          Manajemen slot wawancara teknis berbasis penguncian atomik (ACID) di database lokal dengan dukungan
          ekspor 1-klik ke Google Calendar pribadi atau berkas .ics universal.
        </p>
      </div>

      {/* Sovereign Engine Trust Card */}
      <div className="p-4 rounded-2xl bg-primary-slate-50 border border-primary-border-200 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-600 text-white">
            <ShieldCheck className="w-3 h-3" />
          </span>
          <span className="font-extrabold text-xs text-primary-black">
            Sovereign Calendar Engine · 100% On-Premise (UU PDP No. 27/2022)
          </span>
        </div>
        <p className="text-xs text-primary-slate-600 leading-relaxed pl-7">
          Jadwal dikunci secara atomik (<code className="font-mono bg-white px-1 py-0.5 rounded border border-primary-border-200">SELECT ... FOR UPDATE</code>)
          pada MariaDB untuk menjamin <strong>nol insiden pemesanan ganda (zero double-booking)</strong>. Anda dapat
          menambahkan jadwal ke akun Google Calendar pribadi Anda secara instan tanpa memerlukan otorisasi OAuth server-side.
        </p>
      </div>

      {/* Filter Tabs & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 p-1 bg-primary-slate-100 rounded-xl border border-primary-border-200 text-xs font-semibold">
          {[
            { label: 'Semua', value: '' },
            { label: 'Tersedia', value: 'available' },
            { label: 'Dipesan', value: 'booked' },
            { label: 'Tentatif', value: 'tentative' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setFilterStatus(tab.value);
                loadSlots(tab.value);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === tab.value
                  ? 'bg-white text-primary-black shadow-xs font-bold'
                  : 'text-primary-slate-600 hover:text-primary-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => loadSlots()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary-border-200 bg-white hover:bg-primary-slate-50 text-xs font-semibold text-primary-black transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary-orange' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Slots Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-primary-slate-500 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-primary-orange" />
          <span>Memuat data jadwal wawancara...</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-primary-border-200 text-center text-xs text-primary-slate-600">
          Tidak ada slot wawancara yang sesuai dengan filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.map((slot) => {
            const start = new Date(slot.start_time);
            const end = new Date(slot.end_time);
            const dateStr = start.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
            const timeStr = `${start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

            return (
              <div
                key={slot.id}
                className="p-5 rounded-2xl bg-white border border-primary-border-200 hover:border-primary-orange/60 hover:shadow-card-hover transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-primary-black font-mono">
                      Slot #{slot.id}
                    </span>
                    {statusBadge(slot.status)}
                  </div>

                  <div>
                    <p className="font-bold text-sm text-primary-black">{dateStr}</p>
                    <p className="text-xs text-primary-slate-600 font-semibold mt-0.5">{timeStr}</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-primary-border-100 text-xs text-primary-slate-600">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-primary-slate-400" />
                      <span>Pewawancara: <strong>{slot.interviewer_name}</strong></span>
                    </div>

                    {slot.masked_identifier && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-primary-orange" />
                        <span>Kandidat: <strong className="font-mono text-primary-black">{slot.masked_identifier}</strong></span>
                        {slot.job_title && (
                          <span className="text-primary-slate-500 truncate">({slot.job_title})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action: Ekspor ke Google Calendar Pribadi */}
                <div className="pt-3 border-t border-primary-border-100">
                  <a
                    href={slot.export_google_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-primary-black hover:bg-primary-blue text-white text-xs font-bold transition-all inline-flex items-center justify-center gap-2 text-center shadow-xs"
                    title="Buka dan simpan ke Google Calendar pribadi Anda"
                  >
                    <Calendar className="w-3.5 h-3.5 text-primary-orange" />
                    <span>Ekspor ke Google Calendar Pribadi</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
