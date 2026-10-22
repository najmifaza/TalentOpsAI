-- ==============================================================================
-- TALENTOPS AI: PUBLIC JOB PROFILE (Career Portal)
-- Tujuan: halaman lowongan publik butuh data yang selama ini hanya ada di
-- kepala rekruter — perusahaan, logo, jenjang, fungsi, batas lamar, dan isi
-- deskripsi/persyaratan terpisah. Semua kolom NULL-able supaya baris lama tetap
-- valid tanpa backfill.
--
-- Catatan untuk penulis migrasi berikutnya: scripts/init_db.py memecah berkas
-- pada setiap titik-koma, jadi jangan menulis titik-koma di dalam komentar.
-- ==============================================================================

ALTER TABLE job_descriptions
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS company_logo_url VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS company_about TEXT NULL,
    ADD COLUMN IF NOT EXISTS company_address VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS company_industry VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS company_website VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS job_function VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS employment_level VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS location VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS deadline DATE NULL,
    ADD COLUMN IF NOT EXISTS description_text LONGTEXT NULL,
    ADD COLUMN IF NOT EXISTS requirements_text LONGTEXT NULL;
