-- ==============================================================================
-- TALENTOPS AI: UNIVERSAL DOMAIN & DYNAMIC TAXONOMY SUPPORT
-- Dokumen Acuan: PRD_TALENTOPS_AI_MASTER.md Bab 7 & Universal Recruitment Expansion
-- Tujuan: Mendukung lowongan non-IT (Finance, Legal, HR, Marketing, Sales, Medis)
-- dengan flag is_tech_role dan kamus taksonomi dinamis competency_taxonomies
-- per lowongan pekerjaan.
--
-- Catatan untuk scripts/init_db.py: Dilarang menggunakan titik koma di komentar.
-- ==============================================================================

ALTER TABLE job_descriptions
    ADD COLUMN IF NOT EXISTS is_tech_role TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS competency_taxonomies JSON NULL;
