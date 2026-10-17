/**
 * Mock Candidate Dataset - Contract-First Basis
 * Sesuai PRD Bab 8.2 & Golden Dataset Baseline (Fardizza)
 */

export const MOCK_CANDIDATES = [
  {
    id: 1,
    masked_identifier: "#TK-A17C9B",
    tracking_token: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    job_title: "Senior Backend Engineer",
    applied_date: "2026-10-17 14:20",
    candidate_name_masked: "B*** S******",
    overall_score: 91.5,
    scores_4d: {
      s_comp: 94.0,
      s_port: 90.0,
      s_conf: 95.0,
      s_risk: 12.0
    },
    recommendation: "STRONG_MATCH",
    status: "waiting_approval",
    confidence_level: "HIGH",
    verified_github: "https://github.com/candidate/payment-service",
    github_status: "VERIFIED",
    flags: [],
    key_technologies: ["FastAPI", "Python", "PostgreSQL", "Redis", "Docker"]
  },
  {
    id: 2,
    masked_identifier: "#TK-B82F10",
    tracking_token: "d41d8cd9-8f00-4b82-9a3b-231a48c6a012",
    job_title: "Senior Backend Engineer",
    applied_date: "2026-10-17 15:10",
    candidate_name_masked: "R*** P******",
    overall_score: 74.2,
    scores_4d: {
      s_comp: 80.0,
      s_port: 72.0,
      s_conf: 78.0,
      s_risk: 65.0
    },
    recommendation: "REVIEW_REQUIRED",
    status: "analyzing",
    confidence_level: "MEDIUM",
    verified_github: "https://github.com/reza-dev/api-core",
    github_status: "VERIFIED",
    flags: ["OVERLAPPING_TIMELINE_17M"],
    key_technologies: ["Golang", "Docker", "PostgreSQL", "Kafka"]
  },
  {
    id: 3,
    masked_identifier: "#TK-C39D44",
    tracking_token: "202cb962-ac59-4d96-9328-2d52402d08a0",
    job_title: "Senior Backend Engineer",
    applied_date: "2026-10-17 15:45",
    candidate_name_masked: "C**** L******",
    overall_score: 48.0,
    scores_4d: {
      s_comp: 35.0,
      s_port: 40.0,
      s_conf: 90.0,
      s_risk: 20.0
    },
    recommendation: "WEAK_FIT",
    status: "queued",
    confidence_level: "HIGH",
    verified_github: null,
    github_status: "NOT_APPLICABLE",
    flags: ["SKILL_MISMATCH"],
    key_technologies: ["Figma", "Adobe Illustrator", "HTML/CSS"]
  },
  {
    id: 4,
    masked_identifier: "#TK-D99A12",
    tracking_token: "98234a2e-4360-449e-b816-9283f4f1e4b9",
    job_title: "Senior Backend Engineer",
    applied_date: "2026-10-17 16:30",
    candidate_name_masked: "D*** S******",
    overall_score: 25.0,
    scores_4d: {
      s_comp: 20.0,
      s_port: 10.0,
      s_conf: 40.0,
      s_risk: 98.0
    },
    recommendation: "SECURITY_QUARANTINE",
    status: "rejected",
    confidence_level: "LOW",
    verified_github: null,
    github_status: "FAILED_AUDIT",
    flags: ["HIDDEN_TEXT_INJECTION", "SUSPICIOUS_TAGS_W_VANISH"],
    key_technologies: ["Python", "Malicious Prompt Delimiter"]
  },
  {
    id: 5,
    masked_identifier: "#TK-E54K88",
    tracking_token: "5e8ff9bf-e737-4d1a-8b17-768393e8e7a8",
    job_title: "Senior Backend Engineer",
    applied_date: "2026-10-17 17:15",
    candidate_name_masked: "E** P*******",
    overall_score: 86.0,
    scores_4d: {
      s_comp: 88.0,
      s_port: 85.0,
      s_conf: 92.0,
      s_risk: 15.0
    },
    recommendation: "STRONG_MATCH",
    status: "waiting_approval",
    confidence_level: "HIGH",
    verified_github: "https://github.com/eko-dev/ecommerce-backend",
    github_status: "VERIFIED",
    flags: ["VERIFIED_CAREER_BREAK_FAMILY"],
    key_technologies: ["Node.js", "TypeScript", "PostgreSQL", "Docker", "RabbitMQ"]
  }
];
