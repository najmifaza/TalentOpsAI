import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { login, isAuthenticated } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-slate-50 px-4 font-jkt">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <img src="/logo.svg" alt="TalentOps AI" className="h-9 w-auto object-contain" />
          <h1 className="text-base font-extrabold text-primary-black">Masuk ke Workspace HR</h1>
          <p className="text-xs text-primary-slate-500 text-center">
            Akses internal recruiter, hiring manager, dan compliance officer.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="clean-card bg-white border border-primary-border-100 rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-[11px] font-bold text-primary-slate-700 uppercase tracking-wider">
              Username atau Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-primary-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-primary-border-200 bg-primary-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
                placeholder="recruiter_talentops"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[11px] font-bold text-primary-slate-700 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-primary-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-primary-border-200 bg-primary-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-orange hover:opacity-90 disabled:opacity-60 text-white rounded-full text-xs font-bold shadow-md shadow-primary-orange/25 transition-all"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{isSubmitting ? 'Memverifikasi...' : 'Masuk'}</span>
          </button>
        </form>

        <p className="text-[11px] text-center text-primary-slate-400 mt-4">
          Sesi menggunakan JWT HS256. Token disimpan di perangkat ini dan dikirim sebagai Bearer.
        </p>
      </div>
    </div>
  );
}
