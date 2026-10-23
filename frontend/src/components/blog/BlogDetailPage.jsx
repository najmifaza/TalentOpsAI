import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Calendar, Share2, Check,
  BookOpen, Sparkles, AlertCircle, Briefcase
} from 'lucide-react';
import PublicLayout from '../careers/PublicLayout';
import { API_BASE_URL } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function BlogDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    fetch(`${API_BASE_URL}/api/blog/${slug}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Artikel tidak ditemukan atau telah diarsipkan.');
          throw new Error(`Gagal memuat artikel (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setPost(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [slug]);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: post?.title, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <PublicLayout>
      <div className="bg-white min-h-[600px] py-10 sm:py-16 font-jkt">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6">
          {/* Back button */}
          <div className="mb-8">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary-slate-600 hover:text-primary-black transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Semua Artikel</span>
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-6 bg-primary-slate-200 rounded w-1/4" />
              <div className="h-10 bg-primary-slate-200 rounded w-3/4" />
              <div className="h-4 bg-primary-slate-100 rounded w-1/2" />
              <div className="h-64 bg-primary-slate-100 rounded-2xl" />
              <div className="space-y-3 pt-6">
                <div className="h-4 bg-primary-slate-100 rounded" />
                <div className="h-4 bg-primary-slate-100 rounded" />
                <div className="h-4 bg-primary-slate-100 rounded w-5/6" />
              </div>
            </div>
          ) : error ? (
            <div className="py-20 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-primary-black">{error}</h2>
              <button
                onClick={() => navigate('/blog')}
                className="mt-6 px-6 py-2.5 rounded-full bg-primary-black text-white text-xs font-bold hover:bg-primary-orange transition-all"
              >
                Lihat Artikel Lainnya
              </button>
            </div>
          ) : (
            <article>
              {/* Header Info */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-primary-slate-500">
                  <span className="px-3 py-1 rounded-full bg-primary-orange/10 text-primary-orange font-extrabold text-[11px] uppercase tracking-wider">
                    {post.category}
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-primary-slate-400" />
                    {post.read_time_minutes} min baca
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-primary-slate-400" />
                    {formatDate(post.created_at)}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-extrabold text-primary-black tracking-tight leading-tight">
                  {post.title}
                </h1>

                <div className="flex items-center justify-between py-4 border-y border-primary-border-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-black text-white flex items-center justify-center font-bold text-xs">
                      {post.author_name ? post.author_name.slice(0, 2).toUpperCase() : 'TO'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary-black">{post.author_name}</p>
                      <p className="text-[11px] text-primary-slate-500">TalentOps Editorial Team</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary-border-200 text-xs font-bold text-primary-slate-700 hover:border-primary-orange hover:text-primary-orange transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Tautan Disalin!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Bagikan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Cover Image */}
              {post.cover_image_url && (
                <div className="my-8 rounded-2xl overflow-hidden border border-primary-border-100 shadow-sm max-h-[460px] bg-primary-slate-50">
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Lead Summary */}
              {post.summary && (
                <div className="my-8 p-5 sm:p-6 bg-primary-slate-50 rounded-2xl border-l-4 border-primary-orange text-sm sm:text-base font-medium text-primary-slate-700 leading-relaxed italic">
                  "{post.summary}"
                </div>
              )}

              {/* Body Content */}
              <div className="prose max-w-none text-primary-slate-800 text-sm sm:text-base leading-relaxed space-y-5 my-8">
                {post.content.split('\n\n').map((paragraph, idx) => {
                  const trimmed = paragraph.trim();
                  if (!trimmed) return null;
                  if (trimmed.startsWith('### ')) {
                    return (
                      <h3 key={idx} className="text-lg sm:text-xl font-bold text-primary-black mt-6 mb-2">
                        {trimmed.replace('### ', '')}
                      </h3>
                    );
                  }
                  if (trimmed.startsWith('## ')) {
                    return (
                      <h2 key={idx} className="text-xl sm:text-2xl font-extrabold text-primary-black mt-8 mb-3">
                        {trimmed.replace('## ', '')}
                      </h2>
                    );
                  }
                  if (trimmed.startsWith('# ')) {
                    return (
                      <h1 key={idx} className="text-2xl sm:text-3xl font-extrabold text-primary-black mt-10 mb-4">
                        {trimmed.replace('# ', '')}
                      </h1>
                    );
                  }
                  return (
                    <p key={idx} className="leading-relaxed whitespace-pre-line text-primary-slate-700">
                      {trimmed}
                    </p>
                  );
                })}
              </div>

              {/* Bottom CTA to Job Board */}
              <div className="mt-14 p-8 rounded-3xl bg-gradient-to-r from-primary-black to-primary-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-primary-orange text-xs font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Karier Berkeadilan</span>
                  </div>
                  <h3 className="text-xl font-bold">Siap Mengembangkan Karir Anda?</h3>
                  <p className="text-xs text-primary-slate-300 mt-1 max-w-md">
                    Temukan posisi impian di perusahaan terkemuka dengan sistem evaluasi blind-review anonim dan bebas bias.
                  </p>
                </div>
                <Link
                  to="/lowongan"
                  className="px-6 py-3 rounded-full bg-primary-orange text-white text-xs font-bold hover:bg-orange-600 transition-all shrink-0 inline-flex items-center gap-2 shadow-md shadow-primary-orange/20"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Jelajahi Lowongan</span>
                </Link>
              </div>
            </article>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
