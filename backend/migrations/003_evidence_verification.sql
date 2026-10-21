-- ==============================================================================
-- TALENTOPS AI: EVIDENCE TRACEABILITY COLUMNS
-- Dokumen Acuan: PRD_TALENTOPS_AI_MASTER.md Bab 5.1 & 8.2
-- Tujuan: membedakan kutipan CV yang benar-benar lolos substring guard dari
-- sekadar nama teknologi, dan mencatat requirement lowongan mana yang dipenuhi.
-- ==============================================================================

-- matched_requirement: core_competency dari lowongan yang dipenuhi claim ini (NULL = tidak dipenuhi)
-- verified: 1 bila context_narrative terbukti verbatim di teks CV (lolos substring guard)
ALTER TABLE candidate_evidence
    ADD COLUMN IF NOT EXISTS matched_requirement VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS verified TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_evidence_cand_verified
ON candidate_evidence (candidate_id, verified);
