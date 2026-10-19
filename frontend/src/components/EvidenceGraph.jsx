import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  Check, 
  Layers, 
  Clock, 
  Play, 
  Quote, 
  Zap,
  Code2,
  Briefcase,
  GraduationCap,
  FolderGit2
} from 'lucide-react';
import { MOCK_CANDIDATES } from '../data/mockCandidates';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

// --- CUSTOM REACT FLOW NODES (Grafana Labs Enterprise Theme) ---

// 1. Candidate Master Root Node
function CandidateRootNode({ data }) {
  const recBadge = (() => {
    switch (data.recommendation) {
      case 'STRONG_MATCH':
        return { bg: 'bg-[#eaf0ff] text-[#1b55f5] border-[#8ec0ff]', label: 'Sangat Sesuai' };
      case 'REVIEW_REQUIRED':
        return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Perlu Review HR' };
      case 'WEAK_FIT':
        return { bg: 'bg-[#f4f4f6] text-[#454554] border-[#e6e6ea]', label: 'Kurang Sesuai' };
      default:
        return { bg: 'bg-[#f4f4f6] text-[#67677e] border-[#e6e6ea]', label: data.recommendation || 'Diproses' };
    }
  })();

  return (
    <div className="p-4 rounded-xl bg-[#1f2127] text-white border-2 border-[#1b55f5] shadow-xl w-64 select-none">
      <div className="flex items-center justify-between pb-2 border-b border-[#383a42]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[10px] font-mono font-bold uppercase text-[#8ec0ff]">Kandidat Dossier</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b55f5] text-white font-mono font-bold">
          Skor: {typeof data.overall_score === 'number' ? data.overall_score.toFixed(1) : '-'}
        </span>
      </div>
      <div className="mt-2.5 space-y-1">
        <h4 className="font-mono text-base font-extrabold text-white tracking-wide">{data.label}</h4>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${recBadge.bg}`}>
            {recBadge.label}
          </span>
          {data.confidence_level && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-[#8ec0ff] border border-white/10">
              {data.confidence_level} Conf
            </span>
          )}
          {data.unresolved_risk && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              data.unresolved_risk === 'HIGH' ? 'bg-rose-900/60 text-rose-300' : 'bg-white/10 text-slate-300'
            }`}>
              Risk: {data.unresolved_risk}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#1b55f5] !w-3 !h-3" />
    </div>
  );
}

// 2. Dimension Category Node (SKILL, EXPERIENCE, EDUCATION, PORTFOLIO)
function DimensionCategoryNode({ data }) {
  const getTheme = (label) => {
    switch (label) {
      case 'SKILL':
        return { icon: Code2, border: 'border-[#1b55f5]', bg: 'bg-[#eaf0ff]', text: 'text-[#1b55f5]' };
      case 'EXPERIENCE':
        return { icon: Briefcase, border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-800' };
      case 'EDUCATION':
        return { icon: GraduationCap, border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-800' };
      case 'PORTFOLIO':
        return { icon: FolderGit2, border: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-800' };
      default:
        return { icon: Layers, border: 'border-[#e6e6ea]', bg: 'bg-[#f4f4f6]', text: 'text-[#000000]' };
    }
  };

  const theme = getTheme(data.label);
  const Icon = theme.icon;

  return (
    <div className={`p-3.5 rounded-xl bg-white border-2 ${theme.border} shadow-md w-56 select-none`}>
      <Handle type="target" position={Position.Top} className="!bg-[#1b55f5] !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between pb-1.5 border-b border-[#f4f4f6]">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${theme.text}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${theme.text}`}>{data.label}</span>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${theme.bg} ${theme.text}`}>
          {data.claims_count} Klaim
        </span>
      </div>
      <p className="text-[10px] text-[#67677e] mt-1.5 font-medium">
        {data.is_empty ? 'Tidak ada klaim diekstraksi' : `${data.claims_count} bukti faktual terverifikasi`}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-[#1b55f5] !w-2.5 !h-2.5" />
    </div>
  );
}

// 3. Evidence Claim Node (Grounding Verbatim Substring from Resume)
function EvidenceClaimCardNode({ data }) {
  const isGithub = data.source?.includes('GITHUB') || !!data.url;

  return (
    <div className={`p-3.5 rounded-xl bg-white border-2 shadow-md w-64 select-none hover:border-[#1b55f5] transition-all ${
      isGithub ? 'border-emerald-300' : 'border-[#8ec0ff]'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-[#1b55f5] !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between pb-1.5 border-b border-[#e6e6ea]">
        <div className="flex items-center gap-1.5">
          {isGithub ? (
            <Github className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Quote className="w-3.5 h-3.5 text-[#1b55f5]" />
          )}
          <span className="text-xs font-extrabold text-[#000000] truncate max-w-[140px]">
            {data.competency || 'Kompetensi'}
          </span>
        </div>
        {typeof data.score === 'number' && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#eaf0ff] text-[#1b55f5] border border-[#8ec0ff]">
            +{data.score}pt
          </span>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        <p className="text-[11px] text-[#454554] italic leading-snug line-clamp-3 bg-[#f8f9fc] p-2 rounded border border-[#e6e6ea]">
          "{data.claim_text}"
        </p>
        <div className="flex items-center justify-between text-[9px] text-[#67677e] pt-1">
          <span className="font-semibold uppercase tracking-wider truncate max-w-[140px] text-[#1b55f5]">
            Sumber: {data.source || 'Resume Asli'}
          </span>
          {typeof data.confidence === 'number' && (
            <span className="font-mono text-emerald-700 font-bold">
              {Math.round(data.confidence * 100)}% Conf
            </span>
          )}
        </div>
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-[#1b55f5] font-semibold flex items-center gap-1 hover:underline pt-0.5"
          >
            <span>Buka Repositori GitHub</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// 4. Detected Anomalies Root Node
function DetectedAnomaliesNode({ data }) {
  return (
    <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-400 shadow-md w-56 select-none">
      <Handle type="target" position={Position.Top} className="!bg-rose-500 !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between pb-1.5 border-b border-rose-200">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">Anomali Terdeteksi</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">
          {data.count} Temuan
        </span>
      </div>
      <p className="text-[10px] text-rose-700 mt-1.5">
        Temuan risiko otomatis (overlapping dates, hidden text, dsb.)
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-rose-500 !w-2.5 !h-2.5" />
    </div>
  );
}

// 5. Anomaly Detail Node
function AnomalyDetailCardNode({ data }) {
  const isHigh = data.severity === 'HIGH';

  return (
    <div className={`p-3.5 rounded-xl border-2 shadow-md w-64 select-none ${
      isHigh ? 'bg-rose-50/80 border-rose-400' : 'bg-amber-50/80 border-amber-300'
    }`}>
      <Handle type="target" position={Position.Top} className={`!w-2.5 !h-2.5 ${isHigh ? '!bg-rose-500' : '!bg-amber-500'}`} />
      <div className="flex items-center justify-between pb-1.5 border-b border-black/5">
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
          isHigh ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
        }`}>
          {data.severity} SEVERITY
        </span>
        <span className="text-[10px] font-bold text-[#000000] truncate max-w-[120px]">
          {data.type}
        </span>
      </div>
      <p className="text-[11px] text-[#454554] mt-2 leading-snug">
        {data.description}
      </p>
    </div>
  );
}

// React Flow nodeTypes registration
const nodeTypes = {
  candidateRoot: CandidateRootNode,
  dimensionNode: DimensionCategoryNode,
  evidenceClaimNode: EvidenceClaimCardNode,
  riskNode: DetectedAnomaliesNode,
  anomalyDetailNode: AnomalyDetailCardNode,
};

// Canvas Inner Component using useReactFlow
function EvidenceGraphInner({ candidate, onNavigateDashboard }) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [graphSummary, setGraphSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch real evidence graph from backend
  const loadGraph = useCallback(async () => {
    if (!candidate?.id) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/api/candidates/${candidate.id}/evidence-graph`);
      } catch (directErr) {
        res = await fetch(`/api/candidates/${candidate.id}/evidence-graph`);
      }

      if (res && res.ok) {
        const json = await res.json();
        const serverNodes = json.graph?.nodes || [];
        const serverEdges = json.graph?.edges || [];

        setNodes(serverNodes);
        setEdges(serverEdges);
        setGraphSummary(json.summary || null);

        setTimeout(() => {
          fitView({ padding: 0.2, duration: 600 });
        }, 150);
      } else {
        setErrorMsg('Graf bukti belum tersedia atau kandidat belum selesai di-triage AI.');
      }
    } catch (err) {
      console.warn('Evidence graph fetch error:', err);
      setErrorMsg('Gagal memuat graf bukti dari server backend.');
    } finally {
      setIsLoading(false);
    }
  }, [candidate?.id, fitView, setNodes, setEdges]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const handleCenterAll = () => {
    fitView({ padding: 0.2, duration: 500 });
  };

  const isUnscanned = !graphSummary || graphSummary.evidence_count === 0;

  return (
    <div className="space-y-4">
      {/* Action / Toolbar Header */}
      <div className="bg-white p-3.5 rounded-xl border border-[#e6e6ea] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#000000] flex items-center gap-1.5 mr-2">
            <GitBranch className="w-4 h-4 text-[#1b55f5]" />
            <span>Kandidat: <strong className="font-mono text-[#1b55f5]">{candidate.masked_identifier}</strong></span>
          </span>

          {graphSummary && (
            <div className="flex items-center gap-2 text-[11px] text-[#67677e]">
              <span className="px-2 py-0.5 rounded bg-[#f4f4f6] border border-[#e6e6ea] font-medium">
                Total Node: <strong>{graphSummary.total_nodes}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#eaf0ff] text-[#1b55f5] border border-[#8ec0ff] font-medium">
                Bukti Faktual: <strong>{graphSummary.evidence_count}</strong>
              </span>
              {graphSummary.anomaly_count > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  Anomali: {graphSummary.anomaly_count}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadGraph}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f4f4f6] text-[#000000] text-xs font-semibold border border-[#e6e6ea] transition-all flex items-center gap-1.5 shadow-2xs"
            title="Muat Ulang Graf Bukti"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#1b55f5] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleCenterAll}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f4f4f6] text-[#000000] text-xs font-semibold border border-[#e6e6ea] transition-all flex items-center gap-1.5 shadow-2xs"
            title="Pusatkan Seluruh Graf di Layar"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#1b55f5]" />
            <span>Pusatkan Graf</span>
          </button>
        </div>
      </div>

      {/* Main Graph Canvas Container */}
      <div className="clean-card p-2 shadow-sm border border-[#e6e6ea] overflow-hidden relative">
        <div className="w-full h-[540px] sm:h-[640px] rounded-xl overflow-hidden bg-[#f4f4f6] relative">
          {nodes.length > 0 ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
            >
              <Background color="#d8d8df" gap={20} size={1.2} />
              <Controls position="bottom-right" className="!bg-white !border !border-[#e6e6ea] !shadow-md !rounded-lg" />
              <MiniMap
                position="bottom-left"
                nodeStrokeColor="#1b55f5"
                nodeColor="#ffffff"
                className="!bg-white !border !border-[#e6e6ea] !shadow-md !rounded-lg"
              />
            </ReactFlow>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-[#000000]">Belum Ada Graf Bukti Tersimpan</h4>
              <p className="text-xs text-[#67677e] max-w-md leading-relaxed">
                {errorMsg || 'Berkas kandidat ini berstatus dalam antrean dan belum dianalisis oleh AI Triage Engine.'}
              </p>
              {onNavigateDashboard && (
                <button
                  onClick={onNavigateDashboard}
                  className="px-4 py-2 bg-[#1b55f5] text-white rounded-lg text-xs font-semibold hover:bg-[#1545c7] transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Buka Dashboard &amp; Jalankan Triage AI</span>
                </button>
              )}
            </div>
          )}

          {/* Floating Graph Legend */}
          <div className="hidden md:flex absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-[#e6e6ea] shadow-sm flex-col gap-2 text-[11px] text-[#454554]">
            <span className="font-bold text-[#000000] border-b border-[#e6e6ea] pb-1">Legenda Node Bukti:</span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#1f2127] border border-[#1b55f5]"></span>
              <span>Kandidat Master Root</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-white border-2 border-[#1b55f5]"></span>
              <span>Kategori Dimensi 4D</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-white border-2 border-[#8ec0ff]"></span>
              <span>Kutipan Asli Resume (Verbatim)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-rose-50 border border-rose-300"></span>
              <span>Anomali Terdeteksi</span>
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
  const [candidateList, setCandidateList] = useState(MOCK_CANDIDATES);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  // Load real candidates from MariaDB backend
  useEffect(() => {
    async function loadCandidates() {
      try {
        let res;
        try {
          res = await fetch(`${API_BASE_URL}/api/candidates?limit=50`);
        } catch (e) {
          res = await fetch('/api/candidates?limit=50');
        }
        if (res && res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setCandidateList(json.data);
            // Default to candidate from URL or the first candidate in the list
            if (candidateId) {
              const matched = json.data.find(c => String(c.id) === String(candidateId) || c.masked_identifier === candidateId);
              setSelectedCandidateId(matched ? matched.id : json.data[0].id);
            } else {
              setSelectedCandidateId(json.data[0].id);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Fallback loading mock candidates:', err);
      }
      setSelectedCandidateId(MOCK_CANDIDATES[0].id);
    }
    loadCandidates();
  }, [candidateId]);

  const activeCandidate = useMemo(() => {
    return candidateList.find(c => c.id === selectedCandidateId) || candidateList[0] || MOCK_CANDIDATES[0];
  }, [candidateList, selectedCandidateId]);

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
            Menghubungkan klaim keahlian kandidat langsung ke <strong className="text-[#000000]">kutipan teks asli resume</strong> (grounding validation via Substring Guard) dan <strong className="text-[#000000]">repositori GitHub terverifikasi</strong>. Data diambil real-time dari tabel relasional MariaDB (<code className="bg-[#f4f4f6] px-1.5 py-0.5 rounded text-[#000000] font-mono">candidate_evidence</code> &amp; <code className="bg-[#f4f4f6] px-1.5 py-0.5 rounded text-[#000000] font-mono">candidate_anomalies</code>).
          </p>
        </div>
      </div>

      {/* Candidate Selector Bar */}
      <div className="clean-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          <span className="text-xs font-bold uppercase tracking-wider text-[#67677e] mr-1 shrink-0">
            Pilih Kandidat:
          </span>
          {candidateList.map((cand) => {
            const isSelected = cand.id === activeCandidate?.id;
            const rec = cand.recommendation || 'PENDING_SCAN';

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
                  rec === 'STRONG_MATCH' 
                    ? (isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800') 
                    : (rec === 'SECURITY_QUARANTINE' 
                        ? (isSelected ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-800') 
                        : (isSelected ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-800'))
                }`}>
                  {rec === 'STRONG_MATCH' ? 'Sangat Sesuai' : (rec === 'SECURITY_QUARANTINE' ? 'Karantina' : (rec === 'REVIEW_REQUIRED' ? 'Review HR' : 'Weak Fit'))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#67677e] shrink-0 self-end sm:self-auto">
          <Info className="w-4 h-4 text-[#1b55f5]" />
          <span>Klik node untuk detail bukti &amp; kutipan CV</span>
        </div>
      </div>

      {/* React Flow Provider Wrapper */}
      <ReactFlowProvider>
        <EvidenceGraphInner 
          candidate={activeCandidate} 
          onNavigateDashboard={() => navigate('/dashboard')}
        />
      </ReactFlowProvider>
    </div>
  );
}