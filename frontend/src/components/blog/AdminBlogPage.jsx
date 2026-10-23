import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Edit3, Trash2, Globe, EyeOff, ExternalLink,
  Clock, Calendar, Sparkles, AlertCircle, CheckCircle2, X, RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../../lib/api';
import { can, roleLabel } from '../../lib/roles';
import { formatDate } from '../../lib/format';

const PRESET_CATEGORIES = [
  'Teknologi',
  'AI & Etika',
  'Tips Karir',
  'Regulasi UU PDP',
  'Rilis Fitur',
];

export default function AdminBlogPage() {
  const isAdmin = can('manageBlog');

  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCategory, setFormCategory] = useState(PRESET_CATEGORIES[0]);
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formReadTime, setFormReadTime] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);

  const fetchPosts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/blog/admin/all?limit=50`);
      if (!res.ok) {
        throw new Error(`Gagal memuat daftar artikel (${res.status})`);
      }
      const data = await res.json();
      setPosts(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchPosts();
    }
  }, [isAdmin]);

  const openCreateModal = () => {
    setEditingPost(null);
    setFormTitle('');
    setFormSlug('');
    setFormCategory(PRESET_CATEGORIES[0]);
    setFormCoverUrl('');
    setFormSummary('');
    setFormContent('');
    setFormReadTime('');
    setFormIsPublished(true);
    setIsModalOpen(true);
  };

  const openEditModal = (post) => {
    setEditingPost(post);
    setFormTitle(post.title || '');
    setFormSlug(post.slug || '');
    setFormCategory(post.category || PRESET_CATEGORIES[0]);
    setFormCoverUrl(post.cover_image_url || '');
    setFormSummary(post.summary || '');
    setFormContent(post.content || '');
    setFormReadTime(post.read_time_minutes ? String(post.read_time_minutes) : '');
    setFormIsPublished(Boolean(post.is_published));
    setIsModalOpen(true);

    // If content wasn't returned in list view, fetch single post detail
    if (!post.content) {
      fetch(`${API_BASE_URL}/api/blog/${post.slug}`)
        .then((r) => r.ok ? r.json() : null)
        .then((detail) => {
          if (detail?.content) setFormContent(detail.content);
        })
        .catch(() => {});
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPost(null);
  };

  const handleTitleChange = (val) => {
    setFormTitle(val);
    // If creating new post, auto-generate slug
    if (!editingPost) {
      const generated = val
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setFormSlug(generated);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSummary.trim() || !formContent.trim()) {
      alert('Harap lengkapi Judul, Ringkasan, dan Konten artikel.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        slug: formSlug.trim() || undefined,
        category: formCategory.trim(),
        cover_image_url: formCoverUrl.trim() || null,
        summary: formSummary.trim(),
        content: formContent.trim(),
        read_time_minutes: formReadTime ? parseInt(formReadTime, 10) : undefined,
        is_published: formIsPublished,
      };

      const url = editingPost
        ? `${API_BASE_URL}/api/blog/${editingPost.id}`
        : `${API_BASE_URL}/api/blog`;
      const method = editingPost ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Gagal menyimpan artikel (${res.status})`);
      }

      setSuccessMsg(editingPost ? 'Artikel berhasil diperbarui.' : 'Artikel baru berhasil diterbitkan!');
      setTimeout(() => setSuccessMsg(null), 3000);
      closeModal();
      fetchPosts();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async (post) => {
    const nextStatus = !post.is_published;
    try {
      const res = await fetch(`${API_BASE_URL}/api/blog/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal memperbarui status publikasi');
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_published: nextStatus ? 1 : 0 } : p))
      );
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Hapus artikel "${post.title}" secara permanen?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/blog/${post.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus artikel');
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setSuccessMsg('Artikel berhasil dihapus.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-primary-border-200 p-8 text-center max-w-xl mx-auto my-12 font-jkt">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-primary-black">Akses Terbatas: Hanya Khusus Admin</h2>
        <p className="text-xs text-primary-slate-600 mt-2 leading-relaxed">
          Akun Anda memiliki hak akses <strong>{roleLabel()}</strong>. Modul pengunggahan dan manajemen publikasi artikel blog hanya dapat dikelola oleh pengguna dengan role <strong>Admin Workspace</strong>.
        </p>
      </div>
    );
  }

  const filteredPosts = posts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.slug?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-jkt">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-primary-border-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-primary-orange text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Content Management System</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-primary-black">
            Manajemen Artikel & Blog
          </h1>
          <p className="text-xs text-primary-slate-500 mt-0.5">
            Publikasikan wawasan, panduan kandidat, dan rilis fitur ke portal publik blog TalentOps AI.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-orange text-white text-xs font-bold hover:bg-orange-600 transition-all shadow-md shadow-primary-orange/25 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Artikel Baru</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-primary-border-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-primary-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, slug, atau kategori..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-primary-border-200 text-xs text-primary-black focus:outline-none focus:border-primary-orange"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-primary-slate-500 font-medium">
            Total: <strong>{filteredPosts.length}</strong> artikel
          </span>
          <button
            onClick={fetchPosts}
            className="p-2 rounded-lg border border-primary-border-200 text-primary-slate-600 hover:text-primary-black hover:bg-primary-slate-50 transition-colors"
            title="Segarkan data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white rounded-2xl border border-primary-border-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-primary-slate-500 animate-pulse">
            Memuat daftar artikel...
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-rose-600">{error}</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-12 text-center text-primary-slate-400">
            <p className="text-xs font-semibold">Belum ada artikel yang dibuat.</p>
            <button
              onClick={openCreateModal}
              className="mt-3 text-xs font-bold text-primary-orange hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tulis artikel pertama sekarang</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-primary-slate-700">
              <thead className="bg-primary-slate-50 border-b border-primary-border-200 text-[11px] font-bold text-primary-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Artikel</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Waktu Baca</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tanggal Rilis</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-border-100">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-primary-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="flex items-center gap-3">
                        {post.cover_image_url ? (
                          <img
                            src={post.cover_image_url}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-primary-border-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-primary-slate-100 border border-primary-border-200 flex items-center justify-center text-primary-slate-400 font-bold text-[10px] shrink-0">
                            DOC
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-primary-black truncate">{post.title}</p>
                          <p className="text-[11px] text-primary-slate-400 font-mono truncate">
                            /{post.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary-slate-100 text-primary-slate-700 font-semibold text-[10px]">
                        {post.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-primary-slate-500">
                      {post.read_time_minutes} menit
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => handleTogglePublish(post)}
                        title="Klik untuk ubah status publish"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          post.is_published
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {post.is_published ? (
                          <>
                            <Globe className="w-3 h-3 text-emerald-600" />
                            <span>Published</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3 text-amber-600" />
                            <span>Draft</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-primary-slate-500">
                      {formatDate(post.created_at)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-1">
                      {post.is_published ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-primary-slate-400 hover:text-primary-orange inline-flex rounded-lg hover:bg-primary-slate-100 transition-colors"
                          title="Lihat halaman publik"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : null}
                      <button
                        onClick={() => openEditModal(post)}
                        className="p-1.5 text-primary-slate-500 hover:text-primary-blue inline-flex rounded-lg hover:bg-primary-slate-100 transition-colors"
                        title="Edit artikel"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post)}
                        className="p-1.5 text-primary-slate-500 hover:text-rose-600 inline-flex rounded-lg hover:bg-primary-slate-100 transition-colors"
                        title="Hapus artikel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-primary-border-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-primary-border-100 mb-6">
              <div>
                <h3 className="text-lg font-bold text-primary-black">
                  {editingPost ? 'Edit Artikel Blog' : 'Tulis Artikel Blog Baru'}
                </h3>
                <p className="text-xs text-primary-slate-500 mt-0.5">
                  Format artikel mendukung judul level markdown (#, ##, ###) dan paragraf bebas.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-full text-primary-slate-400 hover:text-primary-black hover:bg-primary-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary-black mb-1">
                  Judul Artikel *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Contoh: Mengoptimalkan Rekrutmen dengan Pendekatan Blind Review"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-primary-border-200 text-xs font-semibold text-primary-black focus:outline-none focus:border-primary-orange"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary-black mb-1">
                    Slug URL (otomatis)
                  </label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="mengoptimalkan-rekrutmen-blind-review"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-primary-border-200 text-xs font-mono text-primary-slate-700 focus:outline-none focus:border-primary-orange bg-primary-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary-black mb-1">
                    Kategori *
                  </label>
                  <input
                    type="text"
                    required
                    list="category-presets"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Pilih atau ketik kategori baru"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-primary-border-200 text-xs text-primary-black focus:outline-none focus:border-primary-orange"
                  />
                  <datalist id="category-presets">
                    {PRESET_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary-black mb-1">
                    URL Gambar Cover (opsional)
                  </label>
                  <input
                    type="url"
                    value={formCoverUrl}
                    onChange={(e) => setFormCoverUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-primary-border-200 text-xs text-primary-black focus:outline-none focus:border-primary-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary-black mb-1">
                    Waktu Baca (menit, opsional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formReadTime}
                    onChange={(e) => setFormReadTime(e.target.value)}
                    placeholder="Otomatis dihitung jika kosong (~200 wpm)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-primary-border-200 text-xs text-primary-black focus:outline-none focus:border-primary-orange"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-black mb-1">
                  Ringkasan / Excerpt Singkat *
                </label>
                <textarea
                  required
                  rows={2}
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="Ringkasan 1-2 kalimat pengantar yang tampil di card preview artikel..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-primary-border-200 text-xs text-primary-black focus:outline-none focus:border-primary-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-black mb-1">
                  Konten Lengkap Artikel *
                </label>
                <textarea
                  required
                  rows={9}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Tuliskan isi artikel Anda di sini... Pisahkan antar paragraf dengan baris kosong (enter 2x). Gunakan ## untuk subjudul."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-primary-border-200 text-xs text-primary-black font-sans leading-relaxed focus:outline-none focus:border-primary-orange"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPublished}
                    onChange={(e) => setFormIsPublished(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-primary-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-primary-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-orange"></div>
                </label>
                <span className="text-xs font-bold text-primary-black">
                  {formIsPublished ? 'Langsung Terbitkan (Published)' : 'Simpan Sebagai Draft'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-primary-border-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-full border border-primary-border-200 text-xs font-bold text-primary-slate-600 hover:bg-primary-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-full bg-primary-orange text-white text-xs font-bold hover:bg-orange-600 transition-all shadow-md shadow-primary-orange/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editingPost ? 'Perbarui Artikel' : 'Publikasikan Artikel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
