-- ==============================================================================
-- TALENTOPS AI: SCORECARD UNIQUENESS (PRD Bab 7)
-- Satu kandidat hanya boleh memiliki satu scorecard pasca-wawancara.
-- Aplikasi sudah mengembalikan HTTP 409 (candidates.py), baris ini menegakkannya
-- juga di level database agar jalur mana pun tunduk pada aturan yang sama.
-- Idempotent: aman dijalankan berulang oleh scripts/init_db.py.
-- ==============================================================================

ALTER TABLE interview_scorecards
    ADD UNIQUE KEY IF NOT EXISTS uq_scorecard_candidate (candidate_id);