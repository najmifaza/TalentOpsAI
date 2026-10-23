import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Clock, Calendar, ArrowRight, BookOpen, Sparkles, AlertCircle } from 'lucide-react';
import PublicLayout from '../careers/PublicLayout';
import { API_BASE_URL } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function BlogFeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCategory = searchParams.get('category') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchKeyword = searchParams.get('q') || '';

  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(searchKeyword);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(currentPage));
    queryParams.set('limit', '9');
    if (currentCategory) queryParams.set('category', currentCategory);
    if (searchKeyword) queryParams.set('search', searchKeyword);

    fetch(`${API_BASE_URL}/api/blog?${queryParams.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Gagal memuat artikel blog (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setPosts(data.items || []);
          setTotalPages(data.total_pages || 1);
          setTotalCount(data.total || 0);
          setCategories(data.categories || []);
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
  }, [currentCategory, currentPage, searchKeyword]);

  const handleCategoryClick = (cat) => {
    const next = new URLSearchParams(searchParams);
    if (!cat || cat === currentCategory) {
      next.delete('category');
    } else {
      next.set('category', cat);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      next.set('q', searchInput.trim());
    } else {
      next.delete('q');
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const featuredPost = posts.length > 0 && currentPage === 1 && !currentCategory && !searchKeyword ? posts[0] : null;
  const gridPosts = featuredPost ? posts.slice(1) : posts;

  return (
    <PublicLayout>
      {/* Hero Header - Inspired by Google Blog & Rumio */}
      <section className="bg-white border-b border-primary-border-100 py-12 sm:py-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-orange/10 text-primary-orange text-xs font-bold mb-4 font-jkt">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Kabar, Riset & Wawasan</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-primary-black tracking-tight leading-tight font-jkt">
              Blog TalentOps AI
            </h1>
            <p className="mt-4 text-base sm:text-lg text-primary-slate-600 leading-relaxed font-jkt">
              Eksplorasi wawasan etika AI, kepatuhan UU PDP, tren rekrutmen berkeadilan, dan catatan rilis teknologi tim kami.
            </p>
          </div>

          {/* Search bar & filter */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-primary-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari topik atau kata kunci artikel..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-primary-border-200 bg-primary-slate-50 text-xs font-medium text-primary-black placeholder:text-primary-slate-400 focus:outline-none focus:border-primary-orange focus:bg-white transition-all font-jkt"
              />
            </form>
            <button
              onClick={handleSearchSubmit}
              type="submit"
              className="px-5 py-2.5 bg-primary-black text-white text-xs font-bold rounded-full hover:bg-primary-orange transition-all font-jkt shrink-0"
            >
              Cari Artikel
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="mt-8 flex flex-wrap items-center gap-2 font-jkt">
            <button
              type="button"
              onClick={() => handleCategoryClick('')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !currentCategory
                  ? 'bg-primary-black text-white shadow-xs'
                  : 'bg-primary-slate-100 text-primary-slate-600 hover:bg-primary-slate-200'
              }`}
            >
              Semua Topik ({totalCount})
            </button>
            {categories.map((c) => (
              <button
                key={c.category}
                type="button"
                onClick={() => handleCategoryClick(c.category)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  currentCategory === c.category
                    ? 'bg-primary-orange text-white shadow-xs'
                    : 'bg-primary-slate-100 text-primary-slate-600 hover:bg-primary-slate-200'
                }`}
              >
                {c.category} <span className="opacity-75 text-[11px] ml-1">({c.count})</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-10 sm:py-14 bg-primary-slate-50 min-h-[500px]">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-primary-border-100 animate-pulse space-y-4">
                  <div className="w-full h-44 bg-primary-slate-200 rounded-xl" />
                  <div className="h-4 bg-primary-slate-200 rounded w-1/3" />
                  <div className="h-6 bg-primary-slate-200 rounded w-4/5" />
                  <div className="h-12 bg-primary-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-rose-200 p-8">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-primary-black">Gagal memuat artikel blog</p>
              <p className="text-xs text-primary-slate-600 mt-1">{error}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-primary-border-200 p-8 max-w-md mx-auto">
              <BookOpen className="w-12 h-12 text-primary-slate-300 mx-auto mb-4" />
              <h3 className="text-base font-bold text-primary-black">Belum Ada Artikel</h3>
              <p className="text-xs text-primary-slate-500 mt-1">
                {currentCategory || searchKeyword
                  ? 'Tidak ada artikel yang sesuai kriteria pencarian Anda.'
                  : 'Nantikan wawasan dan panduan terbaru dari tim TalentOps AI segera.'}
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Featured Post Card (Hero Card) */}
              {featuredPost && (
                <article className="group bg-white rounded-3xl border border-primary-border-200 overflow-hidden shadow-xs hover:border-primary-orange hover:shadow-card-hover transition-all">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                    <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 text-xs text-primary-slate-500 mb-3">
                          <span className="px-2.5 py-1 rounded-md bg-primary-orange/10 text-primary-orange font-bold text-[11px] uppercase tracking-wide">
                            {featuredPost.category}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-primary-slate-400" />
                            {featuredPost.read_time_minutes} min read
                          </span>
                        </div>
                        <Link to={`/blog/${featuredPost.slug}`}>
                          <h2 className="text-2xl sm:text-3xl font-extrabold text-primary-black group-hover:text-primary-orange transition-colors tracking-tight leading-snug">
                            {featuredPost.title}
                          </h2>
                        </Link>
                        <p className="mt-3 text-sm text-primary-slate-600 leading-relaxed line-clamp-3">
                          {featuredPost.summary}
                        </p>
                      </div>

                      <div className="mt-6 pt-6 border-t border-primary-border-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-primary-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(featuredPost.created_at)}</span>
                          <span>&bull;</span>
                          <span className="font-semibold text-primary-black">{featuredPost.author_name}</span>
                        </div>
                        <Link
                          to={`/blog/${featuredPost.slug}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-orange hover:underline"
                        >
                          <span>Baca Lengkap</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                    <div className="lg:col-span-5 bg-gradient-to-br from-primary-slate-100 to-primary-slate-200 min-h-[240px] flex items-center justify-center overflow-hidden">
                      {featuredPost.cover_image_url ? (
                        <img
                          src={featuredPost.cover_image_url}
                          alt={featuredPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="p-8 text-center text-primary-slate-400">
                          <BookOpen className="w-16 h-16 mx-auto mb-2 opacity-50" />
                          <span className="text-xs font-semibold">TalentOps AI Insight</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )}

              {/* Grid of standard articles */}
              {gridPosts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {gridPosts.map((post) => (
                    <article
                      key={post.id}
                      className="group bg-white rounded-2xl border border-primary-border-200 overflow-hidden flex flex-col justify-between hover:border-primary-orange hover:shadow-card-hover transition-all"
                    >
                      <div>
                        {post.cover_image_url ? (
                          <div className="h-48 w-full overflow-hidden bg-primary-slate-100">
                            <img
                              src={post.cover_image_url}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ) : (
                          <div className="h-44 w-full bg-gradient-to-br from-primary-slate-50 to-primary-slate-100 border-b border-primary-border-100 flex items-center justify-center text-primary-slate-300">
                            <BookOpen className="w-10 h-10 opacity-60" />
                          </div>
                        )}
                        <div className="p-5 sm:p-6">
                          <div className="flex items-center gap-2 text-xs text-primary-slate-500 mb-2.5">
                            <span className="px-2 py-0.5 rounded bg-primary-slate-100 text-primary-slate-700 font-bold text-[10px] uppercase">
                              {post.category}
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 text-primary-slate-400" />
                              {post.read_time_minutes}m read
                            </span>
                          </div>
                          <Link to={`/blog/${post.slug}`}>
                            <h3 className="font-extrabold text-base text-primary-black group-hover:text-primary-orange transition-colors leading-snug line-clamp-2">
                              {post.title}
                            </h3>
                          </Link>
                          <p className="mt-2 text-xs text-primary-slate-600 line-clamp-3 leading-relaxed">
                            {post.summary}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 sm:px-6 pb-5 pt-3 border-t border-primary-border-100 flex items-center justify-between text-xs text-primary-slate-500">
                        <span>{formatDate(post.created_at)}</span>
                        <Link
                          to={`/blog/${post.slug}`}
                          className="inline-flex items-center gap-1 font-bold text-primary-black group-hover:text-primary-orange transition-colors"
                        >
                          <span>Baca</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-8 font-jkt">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('page', String(currentPage - 1));
                      setSearchParams(next);
                    }}
                    className="px-4 py-2 rounded-full border border-primary-border-200 text-xs font-semibold text-primary-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-all"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs font-medium text-primary-slate-600 px-3">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('page', String(currentPage + 1));
                      setSearchParams(next);
                    }}
                    className="px-4 py-2 rounded-full border border-primary-border-200 text-xs font-semibold text-primary-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-all"
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
