import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  GitBranch, 
  ShieldCheck, 
  AlertTriangle, 
  ExternalLink, 
  Github, 
  Info,
  Maximize2,
  RefreshCw,
  Code2,
  Quote,
  ChevronLeft,
  ChevronRight,
  Layers,
  Play,
  Clock,
  Sparkles
} from 'lucide-react';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

// --- CUSTOM NODES (Grafana Labs Enterprise Theme) ---

// 1. Candidate Root Node (Layer 1)
function CandidateNode({ data }) {
  const recBadge = (() => {
    switch (data.recommendation) {
      case 'STRONG_MATCH':
        return { bg: 'bg-[#eaf0ff] text-[#1b55f5] border-[#8ec0ff]', label: 'Sangat Sesuai' };
      case 'REVIEW_REQUIRED':
        return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Perlu Review HR' };
      case 'SECURITY_QUARANTINE':
        return { bg: 'bg-rose-50 text-rose-800 border-rose-200', label: 'Karantina Keamanan' };
      case 'WEAK_FIT':
        return { bg: 'bg-[#f4f4f6] text-[#454554] border-[#e6e6ea]', label: 'Kurang Sesuai' };
      default:
        return { bg: 'bg-[#f4f4f6] text-[#67677e] border-[#e6e6ea]', label: data.recommendation || 'Diproses' };
    }
  })();

  return (
    <div className="p-4 rounded-xl bg-[#1f2127] text-white border-2 border-[#1b55f5] shadow-xl w-64 select-none">
      <Handle type="source" position={Position.Right} className="!bg-[#1b55f5] !w-3 !h-3" />
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2d3139]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[10px] font-mono font-bold uppercase text-[#8ec0ff]">Kandidat Dossier</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b55f5] text-white font-mono font-bold">
          Skor: {typeof data.score === 'number' ? data.score.toFixed(1) : (data.score || '-')}
        </span>
      </div>
      <div className="mt-2.5 space-y-1">
        <h4 className="font-mono text-base font-extrabold text-white tracking-wide">{data.maskedId}</h4>
        <p className="text-[11px] text-[#9a9aa8] font-medium truncate">{data.jobTitle || 'Pelamar Rekrutmen'}</p>
        <div className="pt-1 flex flex-wrap gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${recBadge.bg}`}>
            {recBadge.label}
          </span>
          {data.confidence && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-[#8ec0ff] border border-white/10">
              {data.confidence} Conf
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// 2. Competency Claim Node (Layer 2)
function CompetencyNode({ data }) {
  const isSecurity = data.isSecurity;
  const isMatched = data.matchedRequirement !== null && data.matchedRequirement !== undefined;

  return (
    <div className={`p-3.5 rounded-xl bg-white border-2 shadow-md w-60 select-none transition-all ${
      isSecurity 
        ? 'border-rose-400 hover:border-rose-500' 
        : 'border-[#e6e6ea] hover:border-[#1b55f5]'
    }`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className={`!w-3 !h-3 ${isSecurity ? '!bg-rose-500' : '!bg-[#1b55f5]'}`} 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className={`!w-3 !h-3 ${isSecurity ? '!bg-rose-400' : '!bg-[#8ec0ff]'}`} 
      />
      <div className="flex items-center justify-between pb-1.5 border-b border-[#f4f4f6]">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          isSecurity ? 'text-rose-600' : 'text-[#1b55f5]'
        }`}>
          {isSecurity ? 'Anomali Terdeteksi' : 'Keahlian di CV'}
        </span>
        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
          isSecurity 
            ? 'bg-rose-50 text-rose-700' 
            : 'bg-[#eaf0ff] text-[#1b55f5]'
        }`}>
          {isSecurity ? `${data.severityLabel}` : `${data.confidence}% Conf`}
        </span>
      </div>
      <div className="mt-2">
        <h5 className="text-xs font-bold text-[#000000] truncate">{data.skill}</h5>
        <p className="text-[10px] text-[#67677e] mt-0.5 leading-snug line-clamp-3">{data.description}</p>
        {!isSecurity && (
          <span className={`inline-block mt-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
            isMatched
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-[#f4f4f6] text-[#67677e] border-[#e6e6ea]'
          }`}>
            {isMatched ? `Memenuhi syarat: ${data.matchedRequirement}` : 'Tidak diminta lowongan'}
          </span>
        )}
      </div>
    </div>
  );
}

// 3. Resume Quote Grounding Evidence Node (Layer 3)
function EvidenceNode({ data }) {
  const isSecurity = data.isSecurity;
  const isVerified = !isSecurity && Boolean(data.verified) && Boolean(data.quote);

  return (
    <div className={`p-3.5 rounded-xl bg-white border-2 shadow-md w-64 select-none transition-all ${
      isSecurity 
        ? 'border-rose-400 hover:border-rose-500' 
        : isVerified
          ? 'border-[#8ec0ff] hover:border-[#1b55f5]'
          : 'border-[#e6e6ea] hover:border-[#8ec0ff]'
    }`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className={`!w-3 !h-3 ${isSecurity ? '!bg-rose-500' : '!bg-[#8ec0ff]'}`} 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className={`!w-3 !h-3 ${isSecurity ? '!bg-rose-500' : '!bg-[#1b55f5]'}`} 
      />
      <div className="flex items-center justify-between pb-1.5 border-b border-[#e6e6ea]">
        <div className="flex items-center gap-1 text-[10px] font-bold text-[#000000]">
          {isSecurity ? (
            <AlertTriangle className="w-3 h-3 text-rose-600" />
          ) : (
            <Quote className="w-3 h-3 text-[#1b55f5]" />
          )}
          <span>
            {isSecurity ? 'Penjelasan Temuan' : (isVerified ? 'Kutipan Asli CV' : 'Sebutan di CV')}
          </span>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${
          isSecurity 
            ? 'bg-rose-50 text-rose-700 border-rose-200' 
            : isVerified
              ? 'bg-[#eaf0ff] text-[#1b55f5] border-blue-200'
              : 'bg-[#f4f4f6] text-[#67677e] border-[#e6e6ea]'
        }`}>
          {isSecurity ? `Severity ${data.severity || 'MEDIUM'}` : (isVerified ? 'Terverifikasi verbatim' : 'Belum terverifikasi')}
        </span>
      </div>

      {isSecurity ? (
        <>
          <p className="mt-2 text-[11px] leading-snug text-rose-900 font-medium">
            {data.quote}
          </p>
          {data.verification && (
            <div className="mt-2 pt-1.5 border-t border-rose-200">
              <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 block">Yang perlu dilakukan</span>
              <p className="text-[10px] text-rose-800 leading-snug mt-0.5">{data.verification}</p>
            </div>
          )}
        </>
      ) : isVerified ? (
        <p className="mt-2 text-[11px] italic leading-snug line-clamp-4 text-[#454554]">
          "{data.quote}"
        </p>
      ) : (
        <p className="mt-2 text-[11px] leading-snug text-[#67677e]">
          Teknologi ini disebut di CV, tetapi tidak ada kalimat pendukung yang lolos verifikasi
          teks asli. Anggap sebagai klaim yang belum terbukti.
        </p>
      )}

      <div className="mt-2 pt-1 border-t border-[#e6e6ea] flex items-center justify-between gap-2 text-[9px] text-[#67677e]">
        <span className="truncate max-w-[150px] font-medium">
          {isSecurity ? `Tingkat: ${data.severity || 'MEDIUM'}` : `Sumber: ${data.source}`}
        </span>
        {data.score !== undefined && data.score !== null && Number(data.score) > 0 && (
          <span className="font-mono text-[#1b55f5] font-bold shrink-0">+{data.score}pt</span>
        )}
      </div>
    </div>
  );
}

// 4. GitHub Artifact Node (Layer 4)
function GithubNode({ data }) {
  const isFailed = data.status === 'FAILED_AUDIT';
  const isProvided = data.status === 'VERIFIED' && Boolean(data.url);

  return (
    <div className={`p-4 rounded-xl border-2 shadow-lg w-64 select-none transition-all ${
      isFailed 
        ? 'bg-rose-50 border-rose-300 text-rose-900' 
        : isProvided 
          ? 'bg-white border-[#1b55f5] text-[#000000]'
          : 'bg-[#f4f4f6] border-[#e6e6ea] text-[#67677e]'
    }`}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className={`!w-3 !h-3 ${isFailed ? '!bg-rose-500' : (isProvided ? '!bg-[#1b55f5]' : '!bg-gray-400')}`} 
      />
      
      <div className="flex items-center justify-between pb-2 border-b border-black/5">
        <div className="flex items-center gap-1.5">
          <Github className={`w-4 h-4 ${isFailed ? 'text-rose-600' : (isProvided ? 'text-[#1b55f5]' : 'text-gray-500')}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Audit GitHub v3</span>
        </div>
        {isFailed ? (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 font-mono font-bold animate-pulse">
            AUDIT_FAILED
          </span>
        ) : isProvided ? (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">
            TERVERIFIKASI
          </span>
        ) : (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-mono font-bold">
            TIDAK DILAMPIRKAN
          </span>
        )}
      </div>

      <div className="mt-2.5 space-y-1">
        {isFailed ? (
          <div className="space-y-1">
            <p className="text-xs font-bold text-rose-800">{data.repoName || 'Audit Keamanan Gagal'}</p>
            <p className="text-[10px] text-rose-600 leading-snug">
              Terdeteksi anomali pada berkas pelamar atau indikasi manipulasi prompt delimiter.
            </p>
          </div>
        ) : isProvided ? (
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#000000] truncate">{data.repoName}</p>
            <p className="text-[10px] text-[#67677e]">
              Tautan repositori publik terverifikasi di profil kandidat.
            </p>
            <a 
              href={data.url} 
              target="_blank" 
              rel="noreferrer" 
              className="text-[10px] text-[#1b55f5] font-semibold flex items-center gap-1 hover:underline pt-1"
            >
              <span>Buka Repositori Asli</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#454554]">{data.repoName || 'Tidak Ada Repositori Publik'}</p>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Kandidat tidak mencantumkan tautan repositori GitHub di dalam berkas lamaran atau portofolio.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// React Flow nodeTypes map
const nodeTypes = {
  candidate: CandidateNode,
  competency: CompetencyNode,
  evidence: EvidenceNode,
  github: GithubNode,
};

// 4 Canonical Horizontal Layers for Quick Navigation
const GRAPH_LAYERS = [
  { id: 'root', label: '1. Root Kandidat', x: 180, y: 260, zoom: 0.9 },
  { id: 'comp', label: '2. Klaim Keahlian', x: 500, y: 260, zoom: 0.85 },
  { id: 'ev', label: '3. Kutipan Asli CV', x: 840, y: 260, zoom: 0.85 },
  { id: 'git', label: '4. Audit GitHub', x: 1180, y: 260, zoom: 0.85 },
];

// Pure function to build nodes and edges DIRECTLY from real database records
function buildGraphFromRealData(candidate, evidenceList = [], anomaliesList = []) {
  const isSecurity = candidate.recommendation === 'SECURITY_QUARANTINE';

  // Check if candidate has a real GitHub URL
  let resolvedGithubUrl = candidate.github_url || null;
  if (!resolvedGithubUrl) {
    // Check if any evidence quote specifically contains a github.com link
    for (const ev of evidenceList) {
      const match = (ev.claim_text || '').match(/https:\/\/github\.com\/([a-zA-Z0-9_\-\.\/]+)/);
      if (match) {
        resolvedGithubUrl = match[0];
        break;
      }
    }
  }

  // Combine real evidence items and anomalies into rows for Layer 2 & Layer 3.
  // Anomalies get their own lane below the skills so a risk finding is never read as
  // a "skill the candidate has".
  const items = [];

  evidenceList.forEach((ev) => {
    const verified = ev.verified === 1 || ev.verified === true;
    items.push({
      type: 'evidence',
      id: `ev-item-${ev.id}`,
      skill: ev.target_competency || 'Kompetensi Teridentifikasi',
      desc: verified
        ? ev.claim_text
        : 'Disebut di CV tanpa kalimat pendukung yang lolos verifikasi teks asli.',
      confidence: Math.round(Number(ev.confidence || 0.75) * 100),
      quote: ev.claim_text || '',
      verified,
      matchedRequirement: ev.matched_requirement || null,
      source: ev.evidence_source || 'CV / Resume',
      score: ev.score_contribution,
      isSecurity: false,
    });
  });

  const severityLabel = { HIGH: 'Risiko Tinggi', MEDIUM: 'Risiko Sedang', LOW: 'Catatan' };
  anomaliesList.forEach((anom) => {
    const severity = (anom.severity || 'MEDIUM').toUpperCase();
    items.push({
      type: 'anomaly',
      id: `anom-item-${anom.id}`,
      skill: anom.anomaly_type === 'CONCURRENT_FULLTIME_OVERLAP'
        ? 'Pekerjaan penuh waktu bertumpang tindih'
        : (anom.anomaly_type === 'SECURITY_QUARANTINE_PROMPT_INJECTION'
            ? 'Manipulasi teks pada berkas'
            : (anom.anomaly_type === 'TITLE_INFLATION_DETECTED'
                ? 'Lonjakan jabatan tidak wajar'
                : (anom.anomaly_type === 'CAREER_BREAK_FLAG'
                    ? 'Jeda karier lebih dari 12 bulan'
                    : (anom.anomaly_type || 'ANOMALI').replace(/_/g, ' ')))),
      desc: anom.description || 'Anomali terdeteksi pada berkas.',
      confidence: severity === 'HIGH' ? 100 : (severity === 'MEDIUM' ? 75 : 50),
      severity,
      severityLabel: severityLabel[severity] || severity,
      quote: anom.description || 'Anomali terdeteksi pada berkas.',
      verification: anom.suggested_verification || null,
      source: 'Deteksi otomatis',
      isSecurity: true,
    });
  });

  // Skills first, then risks, so the vertical order matches the lane reading order.
  items.sort((a, b) => (a.isSecurity === b.isSecurity ? 0 : (a.isSecurity ? 1 : -1)));

  // If candidate has been evaluated but has 0 matching skills (Skill Mismatch / Weak Fit)
  if (items.length === 0) {
    let quoteText = "Berkas CV pelamar tidak mencantumkan kompetensi teknis yang dipersyaratkan posisi ini.";
    const resumeText = candidate.sanitized_resume_text || '';
    if (resumeText) {
      const meaningfulLines = resumeText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 25 && !l.startsWith('[') && !l.includes('RINGKASAN') && !l.includes('PENGALAMAN') && !l.includes('EDUCATION'));
      if (meaningfulLines.length > 0) {
        quoteText = meaningfulLines[0];
      }
    }

    items.push({
      type: 'evidence',
      id: 'mismatch-1',
      skill: 'Audit Relevansi Keahlian (Skill Mismatch)',
      desc: 'Tidak ditemukan kecocokan kompetensi pelamar dengan kualifikasi inti lowongan.',
      confidence: 100,
      quote: quoteText,
      source: 'RINGKASAN CV PELAMAR',
      score: 0,
      isSecurity: false,
    });
  }

  // Calculate vertical center positioning
  const count = Math.max(1, items.length);
  const midY = Math.max(160, ((count - 1) * 150) / 2);

  const nodes = [
    // Layer 1: Root Candidate
    {
      id: 'root-candidate',
      type: 'candidate',
      position: { x: 50, y: midY },
      data: {
        maskedId: candidate.masked_identifier,
        jobTitle: candidate.job_title || 'Pelamar Rekrutmen',
        score: candidate.overall_score,
        recommendation: candidate.recommendation,
        confidence: candidate.confidence_level,
      },
    },
  ];

  const edges = [];

  // Layer 2 & 3: Competencies and Verbatim Quotes
  items.forEach((item, idx) => {
    const yPos = 40 + idx * 150;
    const compNodeId = `comp-${item.id}`;
    const evNodeId = `ev-${item.id}`;

    // Competency Node
    nodes.push({
      id: compNodeId,
      type: 'competency',
      position: { x: 390, y: yPos },
      data: {
        skill: item.skill,
        description: item.desc,
        confidence: item.confidence,
        severityLabel: item.severityLabel,
        matchedRequirement: item.matchedRequirement,
        isSecurity: item.isSecurity,
      },
    });

    // Evidence Quote Node
    nodes.push({
      id: evNodeId,
      type: 'evidence',
      position: { x: 730, y: yPos },
      data: {
        quote: item.quote,
        source: item.source,
        score: item.score,
        confidence: item.confidence,
        verified: item.verified,
        severity: item.severity,
        verification: item.verification,
        isSecurity: item.isSecurity,
      },
    });

    // Root -> Competency Edge
    edges.push({
      id: `e-root-${compNodeId}`,
      source: 'root-candidate',
      target: compNodeId,
      animated: true,
      style: {
        stroke: item.isSecurity ? '#E11D48' : '#1b55f5',
        strokeWidth: item.isSecurity ? 3 : 2,
      },
    });

    // Competency -> Evidence Edge
    edges.push({
      id: `e-${compNodeId}-${evNodeId}`,
      source: compNodeId,
      target: evNodeId,
      animated: item.isSecurity,
      style: {
        stroke: item.isSecurity ? '#E11D48' : '#8ec0ff',
        strokeWidth: 2,
      },
    });
  });

  // Layer 4: GitHub / Portfolio Artifact
  const gitNodeId = 'git-artifact-main';
  const hasRepo = Boolean(resolvedGithubUrl);

  nodes.push({
    id: gitNodeId,
    type: 'github',
    position: { x: 1080, y: midY },
    data: {
      status: isSecurity ? 'FAILED_AUDIT' : (hasRepo ? 'VERIFIED' : 'NOT_APPLICABLE'),
      repoName: hasRepo ? resolvedGithubUrl.replace('https://github.com/', '') : (isSecurity ? 'Audit Kredensial Gagal' : 'Tidak Ada Repositori Publik'),
      url: hasRepo ? resolvedGithubUrl : null,
    },
  });

  // The GitHub audit is a property of the candidate, not of a single skill claim, so it
  // hangs off the root. Previously only evidence[0] and [1] were wired to it, which left
  // every other claim dangling and made an anomaly look like it implicated the repo.
  edges.push({
    id: `e-root-${gitNodeId}`,
    source: 'root-candidate',
    target: gitNodeId,
    animated: hasRepo,
    style: { stroke: isSecurity ? '#E11D48' : (hasRepo ? '#1b55f5' : '#9CA3AF'), strokeWidth: 2 },
  });

  return { nodes, edges };
}

// Inner Canvas Component utilizing useReactFlow hook
function EvidenceGraphInner({ candidate, onReloadCandidates, embedded = false, initialDetail = null }) {
  const { fitView, setCenter } = useReactFlow();
  const [activeLayerIdx, setActiveLayerIdx] = useState(0);
  const [candidateDetail, setCandidateDetail] = useState(initialDetail?.candidate || null);
  const [liveEvidence, setLiveEvidence] = useState(initialDetail?.evidence || []);
  const [liveAnomalies, setLiveAnomalies] = useState(initialDetail?.anomalies || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriageRunning, setIsTriageRunning] = useState(false);
  const loadedForRef = useRef(null);

  // Fetch real candidate data, evidence, and anomalies from MariaDB
  const fetchRealCandidateData = useCallback(async () => {
    if (!candidate?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/candidates/${candidate.id}`);
      if (res && res.ok) {
        const json = await res.json();
        setCandidateDetail(json.candidate || null);
        setLiveEvidence(json.evidence || []);
        setLiveAnomalies(json.anomalies || []);
      }
    } catch (err) {
      console.warn('Backend real candidate evidence fetch fallback:', err);
    } finally {
      setIsLoading(false);
    }
  }, [candidate?.id]);

  useEffect(() => {
    if (!candidate?.id) return;
    if (loadedForRef.current === candidate.id) return;
    loadedForRef.current = candidate.id;

    // The dossier page already fetched this exact payload; a second request on mount
    // is pure duplication. Fall back to fetching only when the parent has nothing.
    if (initialDetail && initialDetail.candidate) {
      setCandidateDetail(initialDetail.candidate);
      setLiveEvidence(initialDetail.evidence || []);
      setLiveAnomalies(initialDetail.anomalies || []);
      return;
    }
    fetchRealCandidateData();
  }, [candidate?.id, initialDetail, fetchRealCandidateData]);

  // Merge candidate info with real backend candidate record
  const activeCandidateObj = useMemo(() => {
    return candidateDetail ? { ...candidate, ...candidateDetail } : candidate;
  }, [candidate, candidateDetail]);

  // Build the graph solely and strictly from the fetched real data
  const graphElements = useMemo(() => {
    return buildGraphFromRealData(activeCandidateObj, liveEvidence, liveAnomalies);
  }, [activeCandidateObj, liveEvidence, liveAnomalies]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    setNodes(graphElements.nodes);
    setEdges(graphElements.edges);
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 500 });
    }, 100);
  }, [graphElements, setNodes, setEdges, fitView]);

  // Trigger live backend triage on demand if candidate has 0 evidence
  const handleTriggerLiveTriage = async () => {
    if (!candidate?.id) return;
    setIsTriageRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/candidates/${candidate.id}/triage`, { method: 'POST' });
      if (res && res.ok) {
        // Poll for 3 seconds then reload real data
        setTimeout(async () => {
          await fetchRealCandidateData();
          if (onReloadCandidates) onReloadCandidates();
          setIsTriageRunning(false);
        }, 3500);
      } else {
        setIsTriageRunning(false);
      }
    } catch (e) {
      console.error('Triage run error:', e);
      setIsTriageRunning(false);
    }
  };

  const jumpToLayer = (idx) => {
    setActiveLayerIdx(idx);
    const target = GRAPH_LAYERS[idx];
    if (target) {
      setCenter(target.x, target.y, { zoom: target.zoom, duration: 600 });
    }
  };

  const handlePrevLayer = () => {
    const nextIdx = Math.max(0, activeLayerIdx - 1);
    jumpToLayer(nextIdx);
  };

  const handleNextLayer = () => {
    const nextIdx = Math.min(GRAPH_LAYERS.length - 1, activeLayerIdx + 1);
    jumpToLayer(nextIdx);
  };

  const handleFitAll = () => {
    setActiveLayerIdx(-1);
    fitView({ padding: 0.15, duration: 600 });
  };

  const isTrulyUnscanned = (activeCandidateObj.status === 'queued' || activeCandidateObj.status === 'unscanned') && (activeCandidateObj.overall_score === null || activeCandidateObj.overall_score === undefined);
  const hasNoEvidenceYet = isTrulyUnscanned && liveEvidence.length === 0 && liveAnomalies.length === 0 && !isLoading;

  return (
    <div className="space-y-3">
      {/* Layer Navigation Bar */}
      <div className="bg-white p-2.5 rounded-xl border border-[#e6e6ea] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-[10px] font-bold text-[#67677e] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-[#1b55f5]" />
            Lompat Layer:
          </span>
          {GRAPH_LAYERS.map((layer, idx) => {
            const isActive = activeLayerIdx === idx;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => jumpToLayer(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border ${
                  isActive
                    ? 'bg-[#1b55f5] text-white border-[#1b55f5] shadow-xs'
                    : 'bg-[#f4f4f6] hover:bg-white text-[#000000] border-[#e6e6ea]'
                }`}
              >
                {layer.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={fetchRealCandidateData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f4f4f6] text-[#000000] text-xs font-semibold border border-[#e6e6ea] transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Segarkan Data Bukti Asli"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#1b55f5] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleFitAll}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f4f4f6] text-[#000000] text-xs font-semibold border border-[#e6e6ea] transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Tampilkan Seluruh Graf di Layar"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#1b55f5]" />
            <span>Pusatkan Semua</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Container */}
      <div className="clean-card p-2 shadow-sm border border-[#e6e6ea] overflow-hidden relative">
        <div className={`w-full ${embedded ? 'h-[440px] sm:h-[480px]' : 'h-[520px] sm:h-[620px]'} rounded-xl overflow-hidden bg-[#f4f4f6] relative`}>
          {hasNoEvidenceYet ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-[#000000]">Belum Ada Bukti Grounding di Database</h4>
              <p className="text-xs text-[#67677e] max-w-md leading-relaxed">
                Kandidat <strong className="font-mono text-[#1b55f5]">{candidate.masked_identifier}</strong> belum memiliki data klaim atau anomali tersimpan di database. Jalankan analisis AI untuk mengekstrak kutipan kalimat asli dari berkas CV.
              </p>
              <button
                type="button"
                onClick={handleTriggerLiveTriage}
                disabled={isTriageRunning}
                className="px-4 py-2 bg-[#1b55f5] text-white rounded-lg text-xs font-semibold hover:bg-[#1545c7] transition-all flex items-center gap-2 shadow-xs"
              >
                {isTriageRunning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengekstrak Bukti CV via Model Gemini 3.8...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Jalankan Triage AI Sekarang (Live API)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.25}
              maxZoom={2.2}
              panOnDrag={true}
              panOnScroll={true}
              zoomOnPinch={true}
              touchZoom={true}
              zoomOnDoubleClick={true}
              nodesDraggable={true}
              elementsSelectable={true}
              attributionPosition="bottom-left"
            >
              <Background color="#d8d8df" gap={20} size={1.2} />
              <Controls className="!bg-white !border !border-[#e6e6ea] !shadow-xs !rounded-lg overflow-hidden" />
              <MiniMap 
                nodeColor={(n) => {
                  if (n.type === 'candidate') return '#1f2127';
                  if (n.type === 'competency') return '#1b55f5';
                  if (n.type === 'evidence') return '#8ec0ff';
                  return '#454554';
                }}
                className="!bg-white/95 !border !border-[#e6e6ea] !rounded-xl !shadow-xs hidden md:block"
              />
            </ReactFlow>
          )}

          {/* Floating Mobile Pan Controller */}
          {!hasNoEvidenceYet && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-[#e6e6ea] shadow-xl lg:hidden max-w-[95%]">
              <button
                type="button"
                onClick={handlePrevLayer}
                disabled={activeLayerIdx <= 0}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#f4f4f6] hover:bg-white disabled:opacity-30 text-[#000000] text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
                title="Geser ke Layer Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4 text-[#1b55f5]" />
                <span className="hidden xs:inline">Layer</span> Kiri
              </button>

              <span className="text-[11px] font-mono font-bold text-[#000000] px-1 shrink-0">
                {activeLayerIdx >= 0 ? `${activeLayerIdx + 1}/4` : 'All'}
              </span>

              <button
                type="button"
                onClick={handleNextLayer}
                disabled={activeLayerIdx >= GRAPH_LAYERS.length - 1}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#1b55f5] hover:bg-[#1545c7] disabled:opacity-30 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs shrink-0"
                title="Geser ke Layer Berikutnya"
              >
                <span className="hidden xs:inline">Layer</span> Kanan
                <ChevronRight className="w-4 h-4 text-white" />
              </button>

              <button
                type="button"
                onClick={handleFitAll}
                className="ml-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#f4f4f6] text-[#000000] text-xs font-bold border border-[#e6e6ea] transition-colors flex items-center gap-1 shrink-0"
                title="Pusatkan Seluruh Graf"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#1b55f5]" />
                <span className="hidden sm:inline">Pusatkan</span>
              </button>
            </div>
          )}

          {/* Canvas Floating Legend */}
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-[#e6e6ea] shadow-sm text-xs space-y-2 select-none hidden sm:block">
            <span className="font-bold text-[10px] uppercase tracking-wider text-[#000000] block">
              Legenda Alur Bukti Kredensial
            </span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-[#1f2127] border border-[#1b55f5]"></span>
              <span className="text-[#454554] text-[11px]">Kandidat Master Root</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-white border-2 border-[#e6e6ea]"></span>
              <span className="text-[#454554] text-[11px]">Keahlian yang disebut di CV</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-white border-2 border-[#8ec0ff]"></span>
              <span className="text-[#454554] text-[11px]">Kutipan CV terverifikasi verbatim</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-white border-2 border-rose-400"></span>
              <span className="text-[#454554] text-[11px]">Anomali / risiko yang perlu diklarifikasi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-white border-2 border-[#1b55f5]"></span>
              <span className="text-[#454554] text-[11px]">Audit GitHub (Atau TIDAK DILAMPIRKAN)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EvidenceGraph() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const [candidateList, setCandidateList] = useState([]);

  // Load candidate list from backend
  const loadCandidates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/candidates?limit=50`);
      if (res && res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const mapped = json.data.map(c => {
            return {
              id: c.id,
              masked_identifier: c.masked_identifier,
              job_title: c.job_title || 'Unknown Role',
              department: c.department || null,
              overall_score: c.overall_score !== null ? c.overall_score : 0,
              recommendation: c.recommendation || 'REVIEW_REQUIRED',
              confidence_level: c.confidence_level || 'MEDIUM',
              github_url: c.github_url || null,
            };
          });
          setCandidateList(mapped);
        }
      }
    } catch (err) {
      console.warn('Backend candidate list fetch fallback:', err);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Find candidate by ID or Masked Identifier from URL if provided
  const candidateFromUrl = useMemo(() => {
    if (!candidateId) return null;
    return candidateList.find(c => String(c.id) === String(candidateId) || c.masked_identifier === candidateId);
  }, [candidateId, candidateList]);

  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  // Sync state when URL parameter changes or candidateList loads
  useEffect(() => {
    if (candidateFromUrl) {
      setSelectedCandidateId(candidateFromUrl.id);
    } else if (selectedCandidateId === null && candidateList.length > 0) {
      setSelectedCandidateId(candidateList[0].id);
    }
  }, [candidateFromUrl, candidateList, selectedCandidateId]);

  const activeCandidate = candidateList.find(c => c.id === selectedCandidateId) || candidateList[0] || null;

  const handleSelectCandidate = (cand) => {
    setSelectedCandidateId(cand.id);
    navigate(`/evidence-graph/${cand.id}`);
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Top Header Card */}
      <div className="clean-card p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eaf0ff] text-[#1b55f5] border border-blue-200 text-xs font-semibold">
            <GitBranch className="w-3.5 h-3.5 text-[#1b55f5]" />
            <span>Interactive Node-Link Architecture &bull; React Flow</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#000000] tracking-tight">
            Candidate Evidence Graph Explorer
          </h2>
          <p className="text-xs sm:text-sm text-[#67677e] leading-relaxed">
            Menghubungkan klaim keahlian kandidat langsung ke <strong className="text-[#000000]">kutipan teks asli resume</strong> (grounding validation via Substring Guard) dan <strong className="text-[#000000]">audit repositori GitHub</strong>. Data diambil real-time dari tabel relasional MariaDB (<code className="bg-[#f4f4f6] border border-[#e6e6ea] px-1.5 py-0.5 rounded text-[#000000] font-mono">candidate_evidence</code> &amp; <code className="bg-[#f4f4f6] border border-[#e6e6ea] px-1.5 py-0.5 rounded text-[#000000] font-mono">candidate_anomalies</code>).
          </p>
        </div>
      </div>

      {candidateList.length === 0 ? (
        <div className="clean-card p-12 flex flex-col items-center justify-center text-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#f4f4f6] flex items-center justify-center">
            <Layers className="w-6 h-6 text-[#67677e]" />
          </div>
          <p className="text-sm font-bold text-[#000000]">Belum Ada Data Kandidat</p>
          <p className="text-xs text-[#67677e] max-w-xs">
            Upload berkas CV kandidat dan jalankan analisis AI triage dari HR Dashboard terlebih dahulu.
          </p>
        </div>
      ) : (
        <>
      {/* Candidate Selector Bar */}
      <div className="clean-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          <span className="text-xs font-bold uppercase tracking-wider text-[#67677e] mr-1 shrink-0">
            Pilih Kandidat:
          </span>
          {candidateList.map((cand) => {
            const isSelected = cand.id === activeCandidate?.id;
            return (
              <button
                key={cand.id}
                onClick={() => handleSelectCandidate(cand)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-2 shrink-0 ${
                  isSelected
                    ? 'bg-[#1b55f5] text-white shadow-xs ring-2 ring-[#8ec0ff]'
                    : 'bg-white hover:bg-[#f4f4f6] text-[#000000] border border-[#e6e6ea]'
                }`}
              >
                <span>{cand.masked_identifier}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-sans font-bold ${
                  cand.recommendation === 'STRONG_MATCH' 
                    ? (isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800') 
                    : (cand.recommendation === 'SECURITY_QUARANTINE' 
                        ? (isSelected ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-800') 
                        : (isSelected ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-800'))
                }`}>
                  {cand.recommendation === 'STRONG_MATCH' ? 'Sangat Sesuai' : (cand.recommendation === 'SECURITY_QUARANTINE' ? 'Karantina' : (cand.recommendation === 'REVIEW_REQUIRED' ? 'Review HR' : 'Weak Fit'))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#67677e] shrink-0 self-end sm:self-auto">
          <Info className="w-4 h-4 text-[#1b55f5]" />
          <span>Geser &amp; Zoom kanvas graf untuk inspeksi</span>
        </div>
      </div>

      {/* React Flow Provider Wrapper */}
      <ReactFlowProvider>
        <EvidenceGraphInner 
          candidate={activeCandidate} 
          onReloadCandidates={loadCandidates} 
        />
      </ReactFlowProvider>
        </>
      )}
    </div>
  );
}

// Reusable standalone component for embedding inside candidate dossier / inspector modals
export function CandidateEvidenceGraph({ candidate, onReloadCandidates, embedded = true, initialDetail = null }) {
  if (!candidate) return null;
  return (
    <ReactFlowProvider>
      <EvidenceGraphInner 
        candidate={candidate} 
        onReloadCandidates={onReloadCandidates} 
        embedded={embedded}
        initialDetail={initialDetail}
      />
    </ReactFlowProvider>
  );
}
