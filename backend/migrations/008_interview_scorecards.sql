-- ==============================================================================
-- TALENTOPS AI: POST-INTERVIEW SCORECARD & EXPANDED CANDIDATE STATUS
-- Acuan: Siklus Pasca-Wawancara (Recruiter / Hiring Manager / Admin)
-- Mencatat hasil evaluasi teknis, catatan umpan balik, dan rekomendasi pasca-wawancara.
-- Catatan untuk scripts/init_db.py: Dilarang menggunakan titik koma di komentar.
-- ==============================================================================

ALTER TABLE candidates
    MODIFY COLUMN status ENUM('queued', 'analyzing', 'waiting_approval', 'approved', 'rejected', 'request_info', 'failed', 'hired') DEFAULT 'queued';

CREATE TABLE IF NOT EXISTS interview_scorecards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    interviewer_id INT NOT NULL,
    feedback_notes TEXT NULL,
    recommendation ENUM('hire', 'reject') NOT NULL,
    technical_score DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_scorecard_candidate (candidate_id),
    INDEX idx_scorecard_interviewer (interviewer_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
