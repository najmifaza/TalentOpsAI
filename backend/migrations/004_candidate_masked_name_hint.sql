-- ==============================================================================
-- TALENTOPS AI: BLIND-REVIEW NAME HINT
-- Dokumen Acuan: PRD_TALENTOPS_AI_MASTER.md Bab 6.2 butir 4 (Unmasking Governance)
-- Tujuan: dossier menampilkan nama tersamar (mis. B**i S*****o) tanpa perlu
-- mendekripsi PII setiap kali halaman dibuka. Dekripsi penuh tetap hanya lewat
-- POST /api/candidates/{id}/unmask yang menulis pii_access_logs.
-- Baris lama tetap NULL karena backfill butuh dekripsi, jadi UI jatuh ke
-- masked_identifier sampai kandidat diunggah ulang.
--
-- PERINGATAN untuk penulis migrasi berikutnya: scripts/init_db.py memecah berkas
-- pada setiap karakter titik-koma, lalu hanya membuang baris yang diawali dua
-- tanda minus. Artinya titik-koma di dalam komentar akan memotong statement dan
-- sisa kalimatnya tereksekusi sebagai SQL. Jangan pakai titik-koma di komentar.
-- ==============================================================================

ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS masked_name_hint VARCHAR(128) NULL;
