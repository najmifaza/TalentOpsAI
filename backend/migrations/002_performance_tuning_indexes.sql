-- ==============================================================================
-- TALENTOPS AI: SPRINT 5 COMPOSITE INDEXES & QUERY PERFORMANCE TUNING
-- Dokumen Acuan: PRD_TALENTOPS_AI_MASTER.md Bab 7 & PEMBAGIAN_TUGAS_TIM.md
-- Target: Zero full-table-scan pada triage queue, calendar lock, dan graph lookups
-- ==============================================================================

-- 1. Optimasi Filter & Sorting Dashboard Kandidat HR
-- Query: WHERE is_deleted = FALSE AND job_id = :jid AND status = :st ORDER BY triage_priority DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_candidates_job_triage_prio 
ON candidates (job_id, is_deleted, status, triage_priority, created_at);

-- Query: WHERE is_deleted = FALSE ORDER BY overall_score DESC (What-If baseline & high-rank queries)
CREATE INDEX IF NOT EXISTS idx_candidates_eval_ranking 
ON candidates (is_deleted, overall_score, confidence_level);

-- Query: Batch triage queue retrieval WHERE status = 'queued' AND is_deleted = FALSE
CREATE INDEX IF NOT EXISTS idx_candidates_batch_queue 
ON candidates (status, is_deleted, id);

-- 2. Optimasi Kalender Transaksional (Anti Double-Booking & Overlap Checks)
-- Query: WHERE interviewer_id = :iid AND status IN ('tentative', 'booked') AND start_time < :new_end AND end_time > :new_start
CREATE INDEX IF NOT EXISTS idx_slots_interviewer_overlap 
ON interview_slots (interviewer_id, status, start_time, end_time);

-- Query: WHERE candidate_id = :cid AND status IN ('tentative', 'booked')
CREATE INDEX IF NOT EXISTS idx_slots_candidate_active 
ON interview_slots (candidate_id, status);

-- Query: Background cleaner WHERE status = 'tentative' AND tentative_expires_at < NOW()
CREATE INDEX IF NOT EXISTS idx_slots_tentative_cleaner 
ON interview_slots (status, tentative_expires_at);

-- 3. Optimasi Evidence Graph & Anomaly Lookup per Kandidat
-- Query: WHERE candidate_id = :cid (evidence graph & dossier synthesis)
CREATE INDEX IF NOT EXISTS idx_evidence_cand_dim 
ON candidate_evidence (candidate_id, dimension);

-- Query: WHERE candidate_id IN (:ids) AND anomaly_type IN ('PROMPT_INJECTION', 'HIDDEN_TEXT')
CREATE INDEX IF NOT EXISTS idx_anomalies_cand_type_sev 
ON candidate_anomalies (candidate_id, anomaly_type, severity);

-- Query: WHERE candidate_id = :cid
CREATE INDEX IF NOT EXISTS idx_assessments_cand_skill 
ON candidate_assessments (candidate_id, target_skill);

-- 4. Optimasi Audit Trail & Append-Only Logs
-- Query: SSE replay & audit trace WHERE candidate_id = :cid ORDER BY id ASC, created_at ASC
CREATE INDEX IF NOT EXISTS idx_agent_steps_cand_time 
ON agent_steps (candidate_id, created_at);

-- Query: Review history WHERE candidate_id = :cid ORDER BY reviewed_at DESC
CREATE INDEX IF NOT EXISTS idx_reviews_cand_time 
ON human_reviews (candidate_id, reviewed_at);

-- Query: Access log audit WHERE candidate_id = :cid ORDER BY accessed_at DESC
CREATE INDEX IF NOT EXISTS idx_pii_cand_time 
ON pii_access_logs (candidate_id, accessed_at);
