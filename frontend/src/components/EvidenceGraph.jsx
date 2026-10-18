import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  GitBranch, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ExternalLink, 
  Github, 
  FileText, 
  Sparkles, 
  Info,
  Maximize2,
  RefreshCw,
  Search,
  Check,
  Code2,
  Quote
} from 'lucide-react';
import { MOCK_CANDIDATES } from '../data/mockCandidates';

// --- CUSTOM NODES ---

// 1. Candidate Root Node
function CandidateNode({ data }) {
  return (
    <div className="p-4 rounded-2xl bg-[#0B2B26] text-white border-2 border-[#8EB69B] shadow-xl w-64 select-none">
      <Handle type="source" position={Position.Right} className="!bg-[#8EB69B] !w-3 !h-3" />
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#163832]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[10px] font-mono font-bold uppercase text-[#8EB69B]">Kandidat Dossier</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#163832] text-white font-mono font-bold">
          Skor: {data.score}
        </span>
      </div>
      <div className="mt-2.5">
        <h4 className="font-mono text-sm font-extrabold text-white">{data.maskedId}</h4>
        <p className="text-[11px] text-[#DAF1DE] mt-0.5 font-medium">{data.jobTitle}</p>
        <div className="mt-2 text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#163832] text-[#8EB69B]">
          <ShieldCheck className="w-3 h-3 text-[#8EB69B]" />
          <span>{data.recommendation}</span>
        </div>
      </div>
    </div>
  );
}

// 2. Competency Claim Node
function CompetencyNode({ data }) {
  return (
    <div className="p-3.5 rounded-2xl bg-white border-2 border-[#C2E0C4] shadow-md w-60 select-none hover:border-[#235347] transition-all">
      <Handle type="target" position={Position.Left} className="!bg-[#235347] !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-[#8EB69B] !w-3 !h-3" />
      <div className="flex items-center justify-between pb-1.5 border-b border-[#EEF4F0]">
        <span className="text-[10px] font-bold uppercase text-[#235347] tracking-wider">Klaim Kompetensi</span>
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#EEF4F0] text-[#0B201B] font-bold">
          {data.confidence}% Conf
        </span>
      </div>
      <div className="mt-2">
        <h5 className="text-xs font-bold text-[#0B201B]">{data.skill}</h5>
        <p className="text-[10px] text-[#6C837C] mt-0.5">{data.description}</p>
      </div>
    </div>
  );
}

// 3. Resume Quote Grounding Evidence Node
function EvidenceNode({ data }) {
  return (
    <div className="p-3.5 rounded-2xl bg-[#EEF4F0] border-2 border-[#8EB69B] shadow-md w-64 select-none hover:border-[#0B2B26] transition-all">
      <Handle type="target" position={Position.Left} className="!bg-[#8EB69B] !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-[#235347] !w-3 !h-3" />
      <div className="flex items-center justify-between pb-1.5 border-b border-[#C2E0C4]">
        <div className="flex items-center gap-1 text-[10px] font-bold text-[#0B2B26]">
          <Quote className="w-3 h-3 text-[#235347]" />
          <span>Kutipan Asli CV</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#C2E0C4] text-[#0B2B26] font-semibold">
          Grounded
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[#3D544E] italic leading-snug line-clamp-3">
        "{data.quote}"
      </p>
      <div className="mt-2 pt-1 border-t border-[#C2E0C4]/60 flex items-center justify-between text-[9px] text-[#6C837C]">
        <span>Grounding: Substring Matched</span>
        <span className="text-emerald-700 font-bold">100% Valid</span>
      </div>
    </div>
  );
}

// 4. GitHub Artifact Node (Supports VERIFIED, NOT_APPLICABLE, and FAILED_AUDIT)
function GithubNode({ data }) {
  const isNA = data.status === 'NOT_APPLICABLE';
  const isFailed = data.status === 'FAILED_AUDIT' || data.status === 'SUSPICIOUS';
  const isVerified = data.status === 'VERIFIED';

  return (
    <div className={`p-4 rounded-2xl border-2 shadow-lg w-64 select-none transition-all ${
      isNA 
        ? 'bg-[#F3F4F6] border-[#D1D5DB] text-[#4B5563]' 
        : (isFailed 
            ? 'bg-rose-50 border-rose-300 text-rose-900' 
            : 'bg-white border-[#235347] text-[#0B201B]')
    }`}>
      <Handle type="target" position={Position.Left} className={`!w-3 !h-3 ${isNA ? '!bg-gray-400' : (isFailed ? '!bg-rose-500' : '!bg-[#235347]')}`} />
      
      <div className="flex items-center justify-between pb-2 border-b border-black/5">
        <div className="flex items-center gap-1.5">
          <Github className={`w-4 h-4 ${isNA ? 'text-gray-500' : (isFailed ? 'text-rose-600' : 'text-[#0B2B26]')}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Audit GitHub v3</span>
        </div>
        {isNA ? (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-mono font-bold">
            NOT_APPLICABLE
          </span>
        ) : isFailed ? (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 font-mono font-bold animate-pulse">
            AUDIT_FAILED
          </span>
        ) : (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#DAF1DE] text-[#0B2B26] font-mono font-bold border border-[#C2E0C4]">
            VERIFIED
          </span>
        )}
      </div>

      <div className="mt-2.5 space-y-1">
        {isNA ? (
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Audit kode GitHub dilewati secara otomatis untuk lowongan non-programmer (UI/UX / Design).
          </p>
        ) : isFailed ? (
          <div className="space-y-1">
            <p className="text-xs font-bold text-rose-800">{data.repoName || 'Repositori Tidak Ditemukan'}</p>
            <p className="text-[10px] text-rose-600 leading-snug">
              Anomali terdeteksi: Tag tersembunyi DOCX w:vanish atau repositori fiktif.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#0B2B26] truncate">{data.repoName}</p>
            <div className="flex items-center gap-2 text-[10px] text-[#6C837C]">
              <span>Bahasa: <strong>{data.language}</strong></span>
              <span>&bull;</span>
              <span>⭐ {data.stars} Stars</span>
            </div>
            {data.url && (
              <a 
                href={data.url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] text-[#235347] font-semibold flex items-center gap-1 hover:underline pt-0.5"
              >
                <span>Buka Repositori</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Node types mapping for React Flow
const nodeTypes = {
  candidate: CandidateNode,
  competency: CompetencyNode,
  evidence: EvidenceNode,
  github: GithubNode,
};

// Evidence Graph Data Generator for each Candidate
function generateGraphElements(candidate) {
  const isNonIT = candidate.github_status === 'NOT_APPLICABLE';
  const isSecurity = candidate.recommendation === 'SECURITY_QUARANTINE';

  const nodes = [
    // 1. Root Candidate Node
    {
      id: 'root-candidate',
      type: 'candidate',
      position: { x: 50, y: 220 },
      data: {
        maskedId: candidate.masked_identifier,
        jobTitle: candidate.job_title,
        score: candidate.overall_score,
        recommendation: candidate.recommendation,
      },
    },

    // 2. Competencies Layer
    {
      id: 'comp-1',
      type: 'competency',
      position: { x: 380, y: 80 },
      data: {
        skill: isNonIT ? 'Desain UI/UX & Design System' : 'FastAPI Asynchronous Microservices',
        description: isNonIT ? 'Penyusunan komponen Figma & audit WCAG' : 'Arsitektur REST API & async streaming queue',
        confidence: isNonIT ? 90 : 96,
      },
    },
    {
      id: 'comp-2',
      type: 'competency',
      position: { x: 380, y: 240 },
      data: {
        skill: isNonIT ? 'Prototyping & User Journey Mapping' : 'Basis Data MariaDB ACID & Indexing',
        description: isNonIT ? 'User flow 12 layar & riset pengguna' : 'Optimasi query komposit & transaksi aman',
        confidence: isNonIT ? 88 : 92,
      },
    },
    {
      id: 'comp-3',
      type: 'competency',
      position: { x: 380, y: 400 },
      data: {
        skill: isNonIT ? 'Design Hand-off & HTML/CSS' : 'Docker Containerization & CI/CD Pipeline',
        description: isNonIT ? 'Spesifikasi token desain ke engineer' : 'Multi-stage Dockerfile & pipeline deployment',
        confidence: isSecurity ? 40 : 94,
      },
    },

    // 3. Evidence Quotes Layer
    {
      id: 'ev-1',
      type: 'evidence',
      position: { x: 710, y: 80 },
      data: {
        quote: isNonIT 
          ? 'Memimpin perancangan UI library dengan 45 komponen terstandarisasi di Figma untuk platform e-commerce.' 
          : 'Membangun core API FastAPI dengan arsitektur async worker yang menangani 15.000 transaksi/menit.',
      },
    },
    {
      id: 'ev-2',
      type: 'evidence',
      position: { x: 710, y: 240 },
      data: {
        quote: isNonIT
          ? 'Melakukan uji kegunaan usability testing dengan 20 responden dan meningkatkan retention rate 14%.'
          : 'Merancang skema MariaDB 12 tabel dengan indeks komposit, memangkas p95 query latency menjadi 4.2ms.',
      },
    },
    {
      id: 'ev-3',
      type: 'evidence',
      position: { x: 710, y: 400 },
      data: {
        quote: isSecurity
          ? '/* Hidden zero-font payload detected: SYSTEM PROMPT OVERRIDE bypass filter */'
          : (isNonIT 
              ? 'Menyusun dokumentasi desain responsif dan styling token dengan Tailwind CSS.'
              : 'Menyusun multi-stage Docker build dan integrasi GitHub Actions untuk deployment VPS.'),
      },
    },

    // 4. GitHub Artifacts Layer
    {
      id: 'git-1',
      type: 'github',
      position: { x: 1040, y: 140 },
      data: {
        status: candidate.github_status,
        repoName: isNonIT ? null : 'payment-gateway-service',
        language: 'Python',
        stars: 142,
        url: candidate.verified_github,
      },
    },
    {
      id: 'git-2',
      type: 'github',
      position: { x: 1040, y: 340 },
      data: {
        status: candidate.github_status,
        repoName: isNonIT ? null : 'database-migration-toolkit',
        language: isNonIT ? 'N/A' : 'SQL / Python',
        stars: 64,
        url: candidate.verified_github,
      },
    },
  ];

  // Edges connecting nodes
  const edges = [
    // Root to Competencies
    { id: 'e-root-c1', source: 'root-candidate', target: 'comp-1', animated: true, style: { stroke: '#8EB69B', strokeWidth: 2 } },
    { id: 'e-root-c2', source: 'root-candidate', target: 'comp-2', animated: true, style: { stroke: '#8EB69B', strokeWidth: 2 } },
    { id: 'e-root-c3', source: 'root-candidate', target: 'comp-3', animated: true, style: { stroke: '#8EB69B', strokeWidth: 2 } },

    // Competencies to Evidence Quotes
    { id: 'e-c1-ev1', source: 'comp-1', target: 'ev-1', animated: false, style: { stroke: '#235347', strokeWidth: 2 } },
    { id: 'e-c2-ev2', source: 'comp-2', target: 'ev-2', animated: false, style: { stroke: '#235347', strokeWidth: 2 } },
    { id: 'e-c3-ev3', source: 'comp-3', target: 'ev-3', animated: isSecurity, style: { stroke: isSecurity ? '#E11D48' : '#235347', strokeWidth: 2 } },

    // Evidence Quotes to GitHub Repositories
    { 
      id: 'e-ev1-git1', 
      source: 'ev-1', 
      target: 'git-1', 
      animated: !isNonIT && !isSecurity,
      style: { stroke: isNonIT ? '#9CA3AF' : (isSecurity ? '#E11D48' : '#0B2B26'), strokeWidth: 2 } 
    },
    { 
      id: 'e-ev2-git2', 
      source: 'ev-2', 
      target: 'git-2', 
      animated: !isNonIT && !isSecurity,
      style: { stroke: isNonIT ? '#9CA3AF' : (isSecurity ? '#E11D48' : '#0B2B26'), strokeWidth: 2 } 
    },
  ];

  return { nodes, edges };
}

export default function EvidenceGraph() {
  const { candidateId } = useParams();
  const navigate = useNavigate();

  // Find candidate by ID or Masked Identifier from URL if provided
  const candidateFromUrl = useMemo(() => {
    if (!candidateId) return null;
    return MOCK_CANDIDATES.find(c => String(c.id) === String(candidateId) || c.masked_identifier === candidateId);
  }, [candidateId]);

  const [selectedCandidateId, setSelectedCandidateId] = useState(
    candidateFromUrl ? candidateFromUrl.id : MOCK_CANDIDATES[0].id
  );

  // Sync state when URL parameter changes
  useEffect(() => {
    if (candidateFromUrl) {
      setSelectedCandidateId(candidateFromUrl.id);
    }
  }, [candidateFromUrl]);

  const activeCandidate = MOCK_CANDIDATES.find(c => c.id === selectedCandidateId) || MOCK_CANDIDATES[0];

  const graphElements = useMemo(() => {
    return generateGraphElements(activeCandidate);
  }, [activeCandidate]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graphElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphElements.edges);

  // Update nodes when candidate changes
  useEffect(() => {
    setNodes(graphElements.nodes);
    setEdges(graphElements.edges);
  }, [graphElements, setNodes, setEdges]);

  const handleSelectCandidate = (cand) => {
    setSelectedCandidateId(cand.id);
    navigate(`/evidence-graph/${cand.id}`);
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Top Header Card */}
      <div className="forest-card p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8EB69B]/20 text-[#DAF1DE] border border-[#8EB69B]/30 text-xs font-semibold">
            <GitBranch className="w-3.5 h-3.5 text-[#8EB69B]" />
            <span>Interactive Node-Link Architecture &bull; React Flow</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Candidate Evidence Graph Explorer
          </h2>
          <p className="text-xs sm:text-sm text-[#8EB69B] leading-relaxed">
            Menghubungkan klaim keahlian kandidat langsung ke <strong>kutipan teks asli resume</strong> (grounding validation) dan <strong>repositori GitHub terverifikasi</strong>. Untuk role non-programmer, graf secara otomatis menerapkan aturan status <code className="bg-[#051F20] px-1.5 py-0.5 rounded text-white">NOT_APPLICABLE</code> tanpa error.
          </p>
        </div>
      </div>

      {/* Candidate Selector Bar */}
      <div className="clean-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6C837C] mr-1">
            Pilih Profil Kandidat:
          </span>
          {MOCK_CANDIDATES.map((cand) => {
            const isSelected = cand.id === selectedCandidateId;
            return (
              <button
                key={cand.id}
                onClick={() => handleSelectCandidate(cand)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#0B2B26] text-white shadow-md ring-2 ring-[#8EB69B]'
                    : 'bg-[#EEF4F0] hover:bg-[#C2E0C4]/60 text-[#0B201B] border border-[#E1EBE4]'
                }`}
              >
                <span>{cand.masked_identifier}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans ${
                  cand.recommendation === 'STRONG_MATCH' 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : (cand.recommendation === 'SECURITY_QUARANTINE' 
                        ? 'bg-rose-500/20 text-rose-300' 
                        : 'bg-amber-500/20 text-amber-300')
                }`}>
                  {cand.recommendation}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#6C837C] shrink-0">
          <Info className="w-4 h-4 text-[#235347]" />
          <span>Geser & Zoom kanvas graf untuk inspeksi</span>
        </div>
      </div>

      {/* Main React Flow Canvas */}
      <div className="clean-card p-2 shadow-lg border border-[#C2E0C4] overflow-hidden">
        <div className="w-full h-[620px] rounded-2xl overflow-hidden bg-[#F8FAF9] relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Background color="#8EB69B" gap={20} size={1.2} />
            <Controls className="!bg-white !border !border-[#E1EBE4] !shadow-md !rounded-xl overflow-hidden" />
            <MiniMap 
              nodeColor={(n) => {
                if (n.type === 'candidate') return '#0B2B26';
                if (n.type === 'competency') return '#235347';
                if (n.type === 'evidence') return '#8EB69B';
                return '#163832';
              }}
              className="!bg-white/90 !border !border-[#E1EBE4] !rounded-xl !shadow-md"
            />
          </ReactFlow>

          {/* Canvas Floating Legend */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#E1EBE4] shadow-md text-xs space-y-2 pointer-events-none select-none">
            <span className="font-bold text-[10px] uppercase tracking-wider text-[#0B201B] block">
              Legenda Alur Bukti Kredensial
            </span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-[#0B2B26] border border-[#8EB69B]"></span>
              <span className="text-[#3D544E] text-[11px]">Kandidat Master Root</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-white border-2 border-[#C2E0C4]"></span>
              <span className="text-[#3D544E] text-[11px]">Klaim Ekstraksi Pydantic v2</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-[#EEF4F0] border-2 border-[#8EB69B]"></span>
              <span className="text-[#3D544E] text-[11px]">Kutipan Grounding Resume</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-white border-2 border-[#235347]"></span>
              <span className="text-[#3D544E] text-[11px]">Audit GitHub (Atau NOT_APPLICABLE)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
