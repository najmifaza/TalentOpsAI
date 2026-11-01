import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Clock,
  User,
  Briefcase,
  ShieldCheck,
  CalendarCheck2,
  CalendarDays,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

const safeUrl = (url) => {
  if (!url) return '#';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    return '#';
  } catch {
    return '#';
  }
};

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function CalendarPanel() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);

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

  // Navigate forward / backward
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else {
      next.setDate(next.getDate() - 7);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  // Month Title format: e.g. "Oktober 2026"
  const formattedHeaderTitle = useMemo(() => {
    if (viewMode === 'month') {
      const monthStr = currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      return monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
    }
    // Week view title: "Minggu X - Bulan Tahun"
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const sDay = startOfWeek.getDate();
    const sMonth = startOfWeek.toLocaleDateString('id-ID', { month: 'short' });
    const eDay = endOfWeek.getDate();
    const eMonth = endOfWeek.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    return `${sDay} ${sMonth} - ${eDay} ${eMonth}`;
  }, [currentDate, viewMode]);

  // Helper check same calendar day
  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Generate days grid for Month view
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const start = new Date(firstDayOfMonth);
    start.setDate(start.getDate() - start.getDay()); // backtrack to Sunday

    const days = [];
    const curr = new Date(start);

    // Render 35 or 42 cells depending on month overflow
    while (days.length < 35 || (days.length < 42 && curr <= lastDayOfMonth)) {
      for (let i = 0; i < 7; i++) {
        days.push({
          date: new Date(curr),
          isCurrentMonth: curr.getMonth() === month,
          isToday: isSameDay(curr, new Date()),
        });
        curr.setDate(curr.getDate() + 1);
      }
    }
    return days;
  }, [currentDate]);

  // Generate days for Week view
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const days = [];
    const curr = new Date(startOfWeek);
    for (let i = 0; i < 7; i++) {
      days.push({
        date: new Date(curr),
        isCurrentMonth: curr.getMonth() === currentDate.getMonth(),
        isToday: isSameDay(curr, new Date()),
      });
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const activeDays = viewMode === 'month' ? monthDays : weekDays;

  // Map slots per date string (YYYY-MM-DD)
  const slotsByDate = useMemo(() => {
    const map = {};
    slots.forEach((slot) => {
      const dt = new Date(slot.start_time);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(slot);
    });
    return map;
  }, [slots]);

  const getSlotsForDay = (dateObj) => {
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    return slotsByDate[key] || [];
  };

  // Selected date slots
  const selectedDateSlots = useMemo(() => {
    return getSlotsForDay(selectedDate);
  }, [selectedDate, slotsByDate]);

  // Statistics
  const stats = useMemo(() => {
    const booked = slots.filter((s) => s.status === 'booked').length;
    const available = slots.filter((s) => !s.status || s.status === 'available').length;
    const tentative = slots.filter((s) => s.status === 'tentative').length;
    return { booked, available, tentative, total: slots.length };
  }, [slots]);

  const renderSlotPill = (slot) => {
    const start = new Date(slot.start_time);
    const timeStr = start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const isSelected = selectedSlot && selectedSlot.id === slot.id;

    let badgeClass = 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100';
    if (slot.status === 'booked') {
      badgeClass = 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100';
    } else if (slot.status === 'tentative') {
      badgeClass = 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100';
    }

    const candidateTitle = slot.masked_name_hint || slot.masked_identifier || 'Sesi Terbuka';

    return (
      <button
        key={slot.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedSlot(slot);
          setSelectedDate(new Date(slot.start_time));
        }}
        className={`w-full text-left px-2 py-1 rounded-md text-[11px] border font-medium transition-all truncate flex items-center justify-between gap-1 shadow-2xs ${badgeClass} ${
          isSelected ? 'ring-2 ring-primary-info font-bold shadow-xs' : ''
        }`}
        title={`${timeStr} WIB - ${candidateTitle}`}
      >
        <span className="truncate">
          <strong className="font-mono text-[10px] mr-1">{timeStr}</strong>
          {candidateTitle}
        </span>
        {slot.status === 'booked' && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5 max-w-7xl font-jkt">
      {/* Page Title & Sovereign Trust Card */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-primary-black tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary-orange" />
            <span>Jadwal Wawancara &amp; Kalender Internal</span>
          </h2>
          <p className="text-xs text-primary-slate-600 mt-1 leading-relaxed">
            Kalender terpadu manajemen jadwal wawancara berbasis ACID MariaDB dengan ekspor 1-klik ke Google Calendar pribadi.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            {stats.booked} Terkunci (Booked)
          </span>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-info"></span>
            {stats.available} Tersedia
          </span>
        </div>
      </div>

      {/* Sovereign Engine Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-primary-slate-50 border border-primary-border-200 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 text-primary-slate-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Sovereign Calendar Engine (UU PDP No. 27/2022)</strong>: Data jadwal disimpan secara ACID di MariaDB lokal, zero transfer PII ke server pihak ketiga.
          </span>
        </div>
        <span className="text-[11px] font-mono text-primary-slate-500 bg-white px-2 py-0.5 rounded border border-primary-border-200">
          SELECT ... FOR UPDATE
        </span>
      </div>

      {/* Calendar Toolbar Header (Nav, View Switcher, Filter, Refresh) */}
      <div className="p-3 bg-white rounded-2xl border border-primary-border-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Navigation and Month Title */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-primary-border-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <button
              type="button"
              onClick={handlePrev}
              title="Sebelumnya"
              className="p-1.5 hover:bg-primary-slate-50 text-primary-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold text-primary-slate-800 hover:bg-primary-slate-50 border-x border-primary-border-200 transition-colors"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Berikutnya"
              className="p-1.5 hover:bg-primary-slate-50 text-primary-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-base font-extrabold text-primary-black ml-2 tracking-tight">
            {formattedHeaderTitle}
          </h3>
        </div>

        {/* Right: Switcher Bulan/Minggu & Filter Status & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center bg-primary-slate-100 p-0.5 rounded-xl border border-primary-border-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'month'
                  ? 'bg-white text-primary-black shadow-2xs font-extrabold'
                  : 'text-primary-slate-600 hover:text-primary-black'
              }`}
            >
              Bulan
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-primary-black shadow-2xs font-extrabold'
                  : 'text-primary-slate-600 hover:text-primary-black'
              }`}
            >
              Minggu
            </button>
          </div>

          {/* Status filter dropdown */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              loadSlots(e.target.value);
            }}
            className="bg-white border border-primary-border-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-primary-slate-800 focus:outline-none focus:border-primary-info"
          >
            <option value="">Semua Status</option>
            <option value="booked">Dipesan (Booked)</option>
            <option value="available">Tersedia</option>
            <option value="tentative">Tentatif</option>
          </select>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => loadSlots()}
            disabled={isLoading}
            className="p-1.5 rounded-xl border border-primary-border-200 bg-white hover:bg-primary-slate-50 text-primary-slate-800 transition-colors"
            title="Muat ulang data jadwal"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary-orange' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* MAIN TWO-COLUMN LAYOUT: CALENDAR GRID (LEFT) + DETAIL SIDEBAR (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: 7-Column Calendar Grid (lg:col-span-8 or 9) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-primary-border-200 shadow-2xs overflow-hidden">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-primary-border-200 bg-primary-slate-50 text-center text-xs font-extrabold text-primary-slate-700 py-2.5">
            {DAY_NAMES.map((d, i) => (
              <div key={d} className={`${i === 0 || i === 6 ? 'text-primary-orange' : ''}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Cells Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-primary-border-100 bg-white">
            {activeDays.map(({ date, isCurrentMonth, isToday: dateIsToday }, idx) => {
              const daySlots = getSlotsForDay(date);
              const isDateSelected = isSameDay(date, selectedDate);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(date);
                    if (daySlots.length > 0) {
                      setSelectedSlot(daySlots[0]);
                    } else {
                      setSelectedSlot(null);
                    }
                  }}
                  className={`p-1.5 transition-colors cursor-pointer flex flex-col justify-between ${
                    viewMode === 'month' ? 'min-h-[105px] md:min-h-[120px]' : 'min-h-[220px]'
                  } ${
                    !isCurrentMonth ? 'bg-primary-slate-50/50 text-primary-slate-400' : 'bg-white'
                  } ${
                    isDateSelected ? 'bg-primary-info-soft/30 ring-1 ring-inset ring-primary-info/50' : 'hover:bg-primary-slate-50/70'
                  }`}
                >
                  {/* Cell Header: Date Number + Slot Count */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-xs font-bold size-5 flex items-center justify-center rounded-full ${
                        dateIsToday
                          ? 'bg-primary-orange text-white'
                          : isCurrentMonth
                          ? 'text-primary-slate-800'
                          : 'text-primary-slate-400'
                      }`}
                    >
                      {date.getDate()}
                    </span>

                    {daySlots.length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-primary-slate-100 text-primary-slate-600 font-bold">
                        {daySlots.length}
                      </span>
                    )}
                  </div>

                  {/* Day Slots Stack */}
                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px] no-scrollbar">
                    {daySlots.slice(0, 3).map((slot) => renderSlotPill(slot))}

                    {daySlots.length > 3 && (
                      <span className="text-[10px] font-bold text-primary-slate-500 pl-1 block">
                        +{daySlots.length - 3} lainnya...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detail Sidebar (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 bg-white rounded-2xl border border-primary-border-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-primary-border-100">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-slate-900 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-primary-orange" />
                <span>Detail Jadwal Wawancara</span>
              </h4>
              {selectedSlot && (
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                  selectedSlot.status === 'booked'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {selectedSlot.status === 'booked' ? 'Dipesan' : 'Tersedia'}
                </span>
              )}
            </div>

            {selectedSlot ? (
              <div className="space-y-4 text-xs animate-fade-in">
                {/* Tipe Layanan & Judul */}
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-primary-info-soft text-primary-info block w-max mb-1.5">
                    Wawancara Arsitektur &amp; Kompetensi
                  </span>
                  <h3 className="text-sm font-extrabold text-primary-black">
                    {selectedSlot.masked_name_hint || selectedSlot.masked_identifier || `Slot #${selectedSlot.id}`}
                  </h3>
                  {selectedSlot.masked_identifier && (
                    <span className="font-mono text-[11px] text-primary-slate-500">
                      ID: {selectedSlot.masked_identifier}
                    </span>
                  )}
                </div>

                {/* Metadata Details */}
                <div className="p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-primary-slate-600 font-medium">Posisi:</span>
                    <span className="font-bold text-primary-slate-900 truncate max-w-[170px]">
                      {selectedSlot.job_title || 'Rekayasa Perangkat Lunak'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-primary-slate-600 font-medium">Waktu Sesi:</span>
                    <span className="font-bold text-primary-slate-900 text-right">
                      {new Date(selectedSlot.start_time).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Jakarta',
                      })},{' '}
                      {new Date(selectedSlot.start_time).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Jakarta',
                      })}{' '}
                      WIB
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-primary-slate-600 font-medium">Pewawancara:</span>
                    <span className="font-semibold text-primary-slate-900">
                      {selectedSlot.interviewer_name || 'Tim HR Recruiter'}
                    </span>
                  </div>

                  {selectedSlot.event_id && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-primary-border-100">
                      <span className="text-primary-slate-500 font-mono text-[10px]">Event ID:</span>
                      <span className="font-mono text-[10px] text-primary-info truncate max-w-[170px]">
                        {selectedSlot.event_id}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  {selectedSlot.export_google_url && (
                    <a
                      href={safeUrl(selectedSlot.export_google_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-primary-black hover:bg-primary-blue text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs text-center"
                    >
                      <span>Buka di Google Calendar Pribadi</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {selectedSlot.candidate_id && (
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/candidates/${selectedSlot.candidate_id}`)}
                      className="w-full py-2.5 px-3 rounded-xl bg-primary-slate-100 hover:bg-primary-slate-200 text-primary-slate-900 text-xs font-bold transition-all flex items-center justify-center gap-2 text-center"
                    >
                      <span>Buka Profil Pelamar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* When NO slot is selected: Show Selected Date Summary */
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-primary-slate-500 block mb-0.5">
                    Tanggal Terpilih:
                  </span>
                  <p className="text-sm font-extrabold text-primary-black">
                    {selectedDate.toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-primary-slate-700 block">
                    Jadwal pada tanggal ini ({selectedDateSlots.length}):
                  </span>

                  {selectedDateSlots.length === 0 ? (
                    <div className="p-4 rounded-xl bg-primary-slate-50 border border-primary-border-100 text-primary-slate-500 text-center leading-relaxed">
                      Tidak ada jadwal wawancara pada tanggal ini. Pilih tanggal lain atau buka dossier kandidat untuk menjadwalkan.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                      {selectedDateSlots.map((slot) => {
                        const start = new Date(slot.start_time);
                        const timeStr = start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div
                            key={slot.id}
                            onClick={() => setSelectedSlot(slot)}
                            className="p-2.5 rounded-xl border border-primary-border-200 bg-white hover:border-primary-info transition-all cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-primary-slate-900">
                                {slot.masked_name_hint || slot.masked_identifier || `Slot #${slot.id}`}
                              </p>
                              <p className="text-[10px] text-primary-slate-500 font-mono">
                                {timeStr} WIB &bull; {slot.job_title || 'Rekayasa'}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-primary-info">
                              Pilih &rarr;
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Prompt helper */}
                <div className="p-3 rounded-xl bg-primary-info-soft text-primary-slate-700 text-[11px] flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary-info shrink-0 mt-0.5" />
                  <p>
                    Klik salah satu entri jadwal pada kalender atau daftar di atas untuk membuka rincian lengkap dan tautan ekspor kalender.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
