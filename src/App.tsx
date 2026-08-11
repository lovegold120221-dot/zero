import React, { useState, useEffect } from 'react';
import { Project, ProjectRun, LogEntry, WorkspaceFile, ContractSpec } from './types';
import ProjectSidebar from './components/sidebar/ProjectSidebar';
import WorkflowTimeline from './components/ide/WorkflowTimeline';
import WorkspaceExplorer from './components/ide/WorkspaceExplorer';
import MermaidViewer from './components/ide/MermaidViewer';
import WorkerBoard from './components/ide/WorkerBoard';
import AdminPanel from './components/ide/AdminPanel';
import { initAuth, googleSignIn, uploadFileToDrive } from './utils/googleDrive';
import {
  Cpu,
  Sparkles,
  Layers,
  Code,
  Terminal,
  Download,
  Send,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  CheckCircle,
  Activity,
  HardDrive,
  Eye
} from 'lucide-react';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeRun, setActiveRun] = useState<ProjectRun | null>(null);
  const [runs, setRuns] = useState<ProjectRun[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [settings, setSettings] = useState<{ geminiKeyActive: boolean } | null>(null);

  // Layout tabs
  const [activeDeckTab, setActiveDeckTab] = useState<'blueprint' | 'workers' | 'workspace' | 'telemetry' | 'preview' | 'admin'>('blueprint');

  // New prompt input
  const [prompt, setPrompt] = useState('');
  const [submittingPrompt, setSubmittingPrompt] = useState(false);

  // Clarification questions answers
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [submittingAnswers, setSubmittingAnswers] = useState(false);

  // Patch feedback input
  const [patchFeedback, setPatchFeedback] = useState('');
  const [submittingPatch, setSubmittingPatch] = useState(false);

  // Google Drive Auth state
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => setDriveToken(token),
      () => setDriveToken(null)
    );
    return () => unsubscribe();
  }, []);

  const handleDriveUpload = async () => {
    if (!activeRun?.finalPackageUrl) return;
    try {
      setIsUploadingToDrive(true);
      let currentToken = driveToken;
      if (!currentToken) {
        const result = await googleSignIn('https://www.googleapis.com/auth/drive.file');
        if (result) currentToken = result.accessToken;
      }
      if (!currentToken) return;

      const res = await fetch(activeRun.finalPackageUrl);
      const blob = await res.blob();
      await uploadFileToDrive(currentToken, blob, `eburon-package-${activeRun.id}.zip`);
      alert('Successfully uploaded to Google Drive!');
    } catch (err) {
      console.error('Failed to upload to drive', err);
      alert('Failed to upload to Google Drive.');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Fetch initial configuration
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Fetch all projects
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0 && !activeProject) {
          setActiveProject(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  // Fetch runs for the active project
  const fetchRuns = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/runs`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
        // Find most recent or set active
        if (data.length > 0) {
          // Default to latest run
          const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setActiveRun(sorted[0]);
        } else {
          setActiveRun(null);
        }
      }
    } catch (err) {
      console.error('Failed to load project runs:', err);
    }
  };

  // Fetch run details, logs, and files
  const fetchRunDetails = async (runId: string) => {
    try {
      const runRes = await fetch(`/api/runs/${runId}`);
      if (runRes.ok) {
        const runData = await runRes.json();
        setActiveRun(runData);

        // Sync with project status visually
        setProjects(prev => prev.map(p => p.id === runData.projectId ? { ...p, status: runData.status } : p));
      }

      const logRes = await fetch(`/api/runs/${runId}/logs`);
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData);
      }

      const fileRes = await fetch(`/api/runs/${runId}/workspace`);
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        setFiles(fileData);
      }
    } catch (err) {
      console.error('Failed to sync run details:', err);
    }
  };

  // Initialize
  useEffect(() => {
    fetchProjects();
    fetchSettings();
  }, []);

  // Update when project changes
  useEffect(() => {
    if (activeProject) {
      fetchRuns(activeProject.id);
    } else {
      setRuns([]);
      setActiveRun(null);
    }
  }, [activeProject]);

  // Update when active run changes
  useEffect(() => {
    if (activeRun) {
      fetchRunDetails(activeRun.id);
    } else {
      setLogs([]);
      setFiles([]);
    }
  }, [activeRun?.id]);

  // SSE real-time updates + fallback polling for processing runs
  useEffect(() => {
    if (!activeRun) return;

    const processingStatuses: string[] = [
      'clarifying', 'feasibility_scan', 'planning', 'checking_plan',
      'filling_gaps', 'generating_blueprint', 'blueprint_publishing',
      'task_packet_gen', 'dispatching_workers', 'workers_running',
      'worker_blocked', 'manifest_review', 'blueprint_governor',
      'merging', 'conflict_checker', 'planner_review', 'redo_required',
      'validating_build', 'qa_running', 'dod_check', 'packaging',
      'previewing',
    ];

    if (!processingStatuses.includes(activeRun.status)) return;

    const runId = activeRun.id;

    // SSE connection for real-time push updates
    const es = new EventSource(`/api/runs/${runId}/stream`);

    es.addEventListener('status', (e) => {
      const { status } = JSON.parse(e.data);
      setActiveRun(prev => prev?.id === runId ? { ...prev, status } : prev);
      fetchRunDetails(runId);
      fetchProjects();
    });

    es.addEventListener('log', (e) => {
      const entry: LogEntry = JSON.parse(e.data);
      setLogs(prev => [...prev, entry]);
    });

    es.addEventListener('worker_status', () => fetchRunDetails(runId));
    es.addEventListener('worker_generating', () => fetchRunDetails(runId));

    es.addEventListener('worker_file', () => {
      fetch(`/api/runs/${runId}/workspace`)
        .then(r => r.ok ? r.json() : [])
        .then((data: WorkspaceFile[]) => setFiles(data))
        .catch(() => {});
    });

    // Fallback polling at lower frequency in case SSE drops
    const fallback = setInterval(() => {
      fetchRunDetails(runId);
      fetchProjects();
    }, 8000);

    return () => {
      es.close();
      clearInterval(fallback);
    };
  }, [activeRun?.status, activeRun?.id]);

  // Create Project
  const handleCreateProject = async (name: string, description: string) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        const newProj = await res.json();
        setProjects(prev => [newProj, ...prev]);
        setActiveProject(newProj);
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  // Dispatch build run
  const handleDispatchRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !prompt.trim() || submittingPrompt) return;

    setSubmittingPrompt(true);
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        const newRun = await res.json();
        setActiveRun(newRun);
        setRuns(prev => [newRun, ...prev]);
        setPrompt('');
        setActiveDeckTab('blueprint');
      }
    } catch (err) {
      console.error('Failed to trigger run:', err);
    } finally {
      setSubmittingPrompt(false);
    }
  };

  // Submit clarifications
  const handleClarifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun || submittingAnswers) return;

    setSubmittingAnswers(true);
    try {
      const res = await fetch(`/api/runs/${activeRun.id}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: clarificationAnswers }),
      });
      if (res.ok) {
        const updatedRun = await res.json();
        setActiveRun(updatedRun);
        setClarificationAnswers({});
      }
    } catch (err) {
      console.error('Error submitting clarifications:', err);
    } finally {
      setSubmittingAnswers(false);
    }
  };

  // Submit human patch request
  const handlePatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun || !patchFeedback.trim() || submittingPatch) return;

    setSubmittingPatch(true);
    try {
      const res = await fetch(`/api/runs/${activeRun.id}/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: patchFeedback }),
      });
      if (res.ok) {
        const updatedRun = await res.json();
        setActiveRun(updatedRun);
        setPatchFeedback('');
        setActiveDeckTab('workers');
      }
    } catch (err) {
      console.error('Error submitting feedback patch:', err);
    } finally {
      setSubmittingPatch(false);
    }
  };

  const getPhaseBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'ready_for_human_test':
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
      case 'failed':
        return 'text-rose-400 bg-rose-950/20 border-rose-900/30';
      case 'clarifying':
      case 'human_qa':
        return 'text-amber-400 bg-amber-950/20 border-amber-900/30';
      case 'released':
        return 'text-violet-400 bg-violet-950/20 border-violet-900/30';
      default:
        return 'text-cyan-400 bg-cyan-950/20 border-cyan-900/30 animate-pulse';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bento-bg font-sans text-bento-text">
      {/* Side list of Projects and histories */}
      <ProjectSidebar
        projects={projects}
        activeProject={activeProject}
        activeRun={activeRun}
        runs={runs}
        onSelectProject={setActiveProject}
        onSelectRun={setActiveRun}
        onCreateProject={handleCreateProject}
        onOpenSettings={() => setActiveDeckTab('admin')}
      />

      {/* Primary Workspace Display */}
      <main className="flex-1 flex flex-col min-w-0 bg-bento-bg">
        {/* Main Header / Status Panel */}
        {activeProject ? (
          <header className="px-6 py-4 border-b border-bento-border flex items-center justify-between bg-bento-card/30 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-bento-accent" />
                <h2 className="font-bold text-bento-text-bright text-base tracking-tight">{activeProject.name}</h2>
              </div>
              <p className="text-xs text-bento-text/60 mt-1">{activeProject.description}</p>
            </div>

            {activeRun && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-bold text-bento-text/40 tracking-wider">SYSTEM STATUS:</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wider ${getPhaseBadge(activeRun.status)}`}>
                  {activeRun.status.toUpperCase().replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </header>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-bento-bg">
            <Cpu className="w-12 h-12 text-bento-accent animate-pulse mb-3" />
            <h2 className="text-xl font-bold tracking-tight text-bento-text-bright">Establish Workspace Project</h2>
            <p className="text-bento-text/60 text-sm max-w-sm mt-1">
              Create a custom project inside the sidebar to configure the orchestrated software factory.
            </p>
          </div>
        )}

        {/* Content View Deck */}
        {activeProject && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Interactive Workspace Actions depending on state */}
            {activeRun ? (
              <>
                {/* 1. Clarification Form if needed */}
                {activeRun.status === 'clarifying' && activeRun.clarificationQuestions && (
                  <div className="border border-amber-900/40 rounded-xl p-6 bg-amber-950/10 flex flex-col gap-4 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle className="w-5 h-5 animate-bounce" />
                      <h4 className="font-bold text-sm tracking-tight">AI Scope Clarification Needed</h4>
                    </div>
                    <p className="text-xs text-bento-text/80 leading-relaxed font-sans">
                      Our Prompt Classifier requires precise technical parameters. Please answer these questions to generate the master blueprint:
                    </p>
                    <form onSubmit={handleClarifySubmit} className="space-y-4">
                      {activeRun.clarificationQuestions.map((q, idx) => (
                        <div key={idx}>
                          <label className="block text-xs font-semibold text-bento-text-bright font-sans mb-1.5">{q}</label>
                          <input
                            type="text"
                            required
                            value={clarificationAnswers[q] || ''}
                            onChange={(e) => setClarificationAnswers({ ...clarificationAnswers, [q]: e.target.value })}
                            placeholder="Provide details..."
                            className="w-full bg-bento-bg border border-bento-border rounded-lg px-3 py-2.5 text-bento-text-bright placeholder-bento-text/30 text-xs focus:outline-none focus:border-bento-accent"
                          />
                        </div>
                      ))}
                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={submittingAnswers}
                          className="bg-bento-accent hover:bg-bento-accent-hover disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-md hover:shadow-indigo-500/10"
                        >
                          {submittingAnswers ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                          Dispatch Worker Enclaves
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* 1.5 Human QA Approval block */}
                {activeRun.status === 'human_qa' && (
                  <div className="border border-amber-900/40 rounded-xl p-6 bg-amber-950/10 flex flex-col gap-4 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
                    <div className="flex items-center gap-2 text-amber-400">
                      <ShieldCheck className="w-5 h-5" />
                      <h4 className="font-bold text-sm tracking-tight">Human QA Review Required</h4>
                    </div>
                    <p className="text-xs text-bento-text/80 leading-relaxed font-sans">
                      The Eburon Live Previewer has deployed a preview. Review the app in the Live Preview tab, then approve or request changes.
                    </p>
                    <div className="flex gap-3 mt-1">
                      <button
                        onClick={async () => {
                          if (!activeRun) return;
                          await fetch(`/api/runs/${activeRun.id}/human-qa`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ approved: true, feedback: 'Approved by human tester' })
                          });
                          fetchRunDetails(activeRun.id);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-lg"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve & Release
                      </button>
                      <button
                        onClick={async () => {
                          if (!activeRun) return;
                          const feedback = prompt('What needs to change?');
                          if (!feedback) return;
                          await fetch(`/api/runs/${activeRun.id}/human-qa`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ approved: false, feedback })
                          });
                          fetchRunDetails(activeRun.id);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-5 py-2.5 rounded-lg transition flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Request Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Released state */}
                {activeRun.status === 'released' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 border border-violet-900/40 rounded-xl p-6 bg-violet-950/10 flex flex-col gap-4 shadow-lg">
                      <div className="flex items-center gap-2 text-violet-400">
                        <ShieldCheck className="w-5 h-5" />
                        <h4 className="font-bold text-sm tracking-tight">Release {activeRun.releaseVersion || '1.0.0'} Finalized</h4>
                      </div>
                      <p className="text-xs text-bento-text/80 leading-relaxed font-sans">
                        Human QA approved. Release packaged with SBOM, signed attestations, and provenance metadata.
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {activeRun.finalPackageUrl && (
                          <a href={activeRun.finalPackageUrl} download
                            className="bg-violet-600 hover:bg-violet-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-lg">
                            <Download className="w-4 h-4" />
                            Download Release Package
                          </a>
                        )}
                        {activeRun.sbomUri && (
                          <a href={activeRun.sbomUri} target="_blank" rel="noopener noreferrer"
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-5 py-2.5 rounded-lg transition flex items-center gap-2">
                            <Code className="w-4 h-4" />
                            View SBOM
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="border border-bento-border rounded-xl p-5 bg-bento-card flex flex-col gap-3 shadow-md">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-bento-text-bright">Release Info</h4>
                      <div className="space-y-2 text-[10px] font-mono text-bento-text/60">
                        <p>Version: <span className="text-bento-text-bright">{activeRun.releaseVersion || '1.0.0'}</span></p>
                        <p>SBOM: <span className="text-emerald-400">Attached</span></p>
                        <p>Attestation: <span className="text-emerald-400">Signed</span></p>
                        {activeRun.costInputTokens && <p>Input tokens: {activeRun.costInputTokens.toLocaleString()}</p>}
                        {activeRun.costOutputTokens && <p>Output tokens: {activeRun.costOutputTokens.toLocaleString()}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Ready for Testing & Patch Feedback block */}
                {activeRun.status === 'ready_for_human_test' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Package download panel */}
                    <div className="md:col-span-2 border border-emerald-900/40 rounded-xl p-6 bg-emerald-950/10 flex flex-col gap-4 shadow-lg">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <ShieldCheck className="w-5 h-5" />
                        <h4 className="font-bold text-sm tracking-tight">Eburon Production Package Ready</h4>
                      </div>
                      <p className="text-xs text-bento-text/80 leading-relaxed font-sans">
                        Codebox compiled all modules cleanly. All automated unit and schema tests passed successfully. The app is ready for Human testing!
                      </p>

                      <div className="flex flex-wrap gap-3 mt-1">
                        {activeRun.finalPackageUrl ? (
                          <>
                            <a
                              href={activeRun.finalPackageUrl}
                              download
                              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-lg hover:shadow-emerald-500/10"
                            >
                              <Download className="w-4 h-4" />
                              Download Production ZIP Package
                            </a>
                            <button
                              onClick={handleDriveUpload}
                              disabled={isUploadingToDrive}
                              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-lg hover:shadow-slate-500/10"
                            >
                              <HardDrive className="w-4 h-4" />
                              {isUploadingToDrive ? 'Uploading...' : 'Save to Google Drive'}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-bento-text/50 font-mono">ZIP Bundle Packaging...</span>
                        )}
                      </div>
                    </div>

                    {/* Human patch feedback form */}
                    <div className="border border-bento-border rounded-xl p-5 bg-bento-card flex flex-col gap-3 shadow-md">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-bento-text-bright">Request Targeted Patch</h4>
                      <p className="text-[11px] text-bento-text/60 font-sans leading-normal">
                        Found a bug or need a change? Enter your feedback. Eburon will rerun only the responsible worker.
                      </p>
                      <form onSubmit={handlePatchSubmit} className="space-y-3">
                        <textarea
                          required
                          value={patchFeedback}
                          onChange={(e) => setPatchFeedback(e.target.value)}
                          placeholder="e.g., Update dashboard chart layout..."
                          rows={2}
                          className="w-full bg-bento-bg border border-bento-border rounded-lg p-2.5 text-bento-text-bright placeholder-bento-text/30 text-xs focus:outline-none focus:border-bento-accent font-mono"
                        />
                        <button
                          type="submit"
                          disabled={submittingPatch}
                          className="w-full bg-bento-bg hover:bg-bento-card border border-bento-border disabled:opacity-50 text-bento-text-bright hover:text-bento-accent font-semibold text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {submittingPatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Trigger Patch Redo Loop
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Interactive Status Indicator for intermediate pipeline statuses */}
                {['planning', 'checking_plan', 'generating_blueprint', 'dispatching_workers', 'workers_running', 'merging', 'planner_review', 'validating_build', 'qa_running', 'packaging'].includes(activeRun.status) && (
                  <div className="border border-bento-border rounded-xl p-6 bg-bento-card/30 flex flex-col items-center justify-center text-center gap-3 shadow-[0_4px_24px_rgba(99,102,241,0.03)]">
                    <Activity className="w-8 h-8 text-bento-accent animate-spin" />
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-bento-text-bright">Autonomous Software Factory active</h4>
                      <p className="text-[11px] text-bento-text/50 font-mono">
                        Pipeline step: {activeRun.status.toUpperCase().replace(/_/g, ' ')}...
                      </p>
                    </div>
                  </div>
                )}

                {/* Layout tab selectors */}
                <div className="flex border-b border-bento-border gap-6">
                  <button
                    onClick={() => setActiveDeckTab('blueprint')}
                    className={`pb-3 text-xs font-semibold tracking-wider uppercase transition border-b-2 flex items-center gap-1.5 ${
                      activeDeckTab === 'blueprint'
                        ? 'border-bento-accent text-bento-text-bright'
                        : 'border-transparent text-bento-text/50 hover:text-bento-text-bright'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Mainframe Blueprint
                  </button>
                  <button
                    onClick={() => setActiveDeckTab('workers')}
                    className={`pb-3 text-xs font-semibold tracking-wider uppercase transition border-b-2 flex items-center gap-1.5 ${
                      activeDeckTab === 'workers'
                        ? 'border-bento-accent text-bento-text-bright'
                        : 'border-transparent text-bento-text/50 hover:text-bento-text-bright'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    Workers
                  </button>
                  <button
                    onClick={() => setActiveDeckTab('workspace')}
                    className={`pb-3 text-xs font-semibold tracking-wider uppercase transition border-b-2 flex items-center gap-1.5 ${
                      activeDeckTab === 'workspace'
                        ? 'border-bento-accent text-bento-text-bright'
                        : 'border-transparent text-bento-text/50 hover:text-bento-text-bright'
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    Workspace
                  </button>
                  <button
                    onClick={() => setActiveDeckTab('telemetry')}
                    className={`pb-3 text-xs font-semibold tracking-wider uppercase transition border-b-2 flex items-center gap-1.5 ${
                      activeDeckTab === 'telemetry'
                        ? 'border-bento-accent text-bento-text-bright'
                        : 'border-transparent text-bento-text/50 hover:text-bento-text-bright'
                    }`}
                  >
                    <Terminal className="w-4 h-4" />
                    Telemetry logs
                  </button>
                  {activeRun?.previewUrl && (
                    <button
                      onClick={() => setActiveDeckTab('preview')}
                      className={`pb-3 text-xs font-semibold tracking-wider uppercase transition border-b-2 flex items-center gap-1.5 ${
                        activeDeckTab === 'preview'
                          ? 'border-bento-accent text-bento-text-bright'
                          : 'border-transparent text-bento-text/50 hover:text-bento-text-bright'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      Live Preview
                    </button>
                  )}
                </div>

                {/* Active tab component deck rendering */}
                <div className="min-h-[450px]">
                  {activeDeckTab === 'blueprint' && (
                    <div className="space-y-6">
                      <MermaidViewer source={activeRun.mermaidSource} activeStatus={activeRun.status} />

                      {/* Feasibility Report */}
                      {activeRun.feasibilityReport && (
                        <div className="bg-bento-card border border-bento-border rounded-xl p-5 shadow-xl">
                          <div className="flex items-center gap-2 mb-4 border-b border-bento-border pb-3">
                            <Activity className="w-4 h-4 text-bento-accent" />
                            <h3 className="font-semibold text-bento-text-bright text-sm tracking-tight">
                              Feasibility Report
                            </h3>
                            <span className="text-[10px] font-mono text-bento-text/40 ml-auto">
                              {(activeRun.feasibilityReport.estimatedComplexity.level).toUpperCase()} · {(activeRun.feasibilityReport.classification.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div className="border border-bento-border/60 rounded-lg p-3 bg-bento-card/20">
                              <span className="text-[9px] font-mono text-bento-text/40 uppercase tracking-wider">Classification</span>
                              <p className="text-xs font-semibold text-bento-text-bright mt-1 capitalize">{activeRun.feasibilityReport.classification.taskType.replace(/_/g, ' ')}</p>
                            </div>
                            <div className="border border-bento-border/60 rounded-lg p-3 bg-bento-card/20">
                              <span className="text-[9px] font-mono text-bento-text/40 uppercase tracking-wider">Complexity</span>
                              <p className="text-xs font-semibold text-bento-text-bright mt-1 capitalize">{activeRun.feasibilityReport.estimatedComplexity.level}</p>
                              <p className="text-[10px] text-bento-text/50 mt-0.5">
                                {activeRun.feasibilityReport.estimatedComplexity.estimatedWorkerCount} workers · {activeRun.feasibilityReport.estimatedComplexity.estimatedDuration}
                              </p>
                            </div>
                            <div className="border border-bento-border/60 rounded-lg p-3 bg-bento-card/20">
                              <span className="text-[9px] font-mono text-bento-text/40 uppercase tracking-wider">Overall Risk</span>
                              <p className={`text-xs font-semibold mt-1 capitalize ${
                                activeRun.feasibilityReport.riskAssessment.overallRisk === 'high' ? 'text-rose-400'
                                  : activeRun.feasibilityReport.riskAssessment.overallRisk === 'medium' ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}>
                                {activeRun.feasibilityReport.riskAssessment.overallRisk}
                              </p>
                              <p className="text-[10px] text-bento-text/50 mt-0.5">
                                {activeRun.feasibilityReport.riskAssessment.factors.length} risk factors
                              </p>
                            </div>
                            <div className="border border-bento-border/60 rounded-lg p-3 bg-bento-card/20">
                              <span className="text-[9px] font-mono text-bento-text/40 uppercase tracking-wider">Platform</span>
                              <p className="text-xs font-semibold text-bento-text-bright mt-1">{activeRun.feasibilityReport.platformScan.os}</p>
                              <p className="text-[10px] text-bento-text/50 mt-0.5">
                                Node {activeRun.feasibilityReport.platformScan.nodeVersion} · {activeRun.feasibilityReport.platformScan.hasGPU ? 'GPU' : 'CPU'}
                              </p>
                            </div>
                          </div>
                          {(activeRun.feasibilityReport.capabilityAnalysis.matches.length > 0 || activeRun.feasibilityReport.capabilityAnalysis.gaps.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              {activeRun.feasibilityReport.capabilityAnalysis.matches.length > 0 && (
                                <div>
                                  <span className="text-[9px] font-mono text-bento-text/40 uppercase tracking-wider mb-2 block">Capability Matches</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {activeRun.feasibilityReport.capabilityAnalysis.matches.map((m, i) => (
                                      <span key={i} className="text-[10px] font-mono bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 px-2 py-0.5 rounded">{m}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {activeRun.feasibilityReport.capabilityAnalysis.gaps.length > 0 && (
                                <div>
                                  <span className="text-[9px] font-mono text-bento-text/40 uppercase tracking-wider mb-2 block">Capability Gaps</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {activeRun.feasibilityReport.capabilityAnalysis.gaps.map((g, i) => (
                                      <span key={i} className="text-[10px] font-mono bg-amber-950/30 border border-amber-800/40 text-amber-400 px-2 py-0.5 rounded">{g}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {activeRun.feasibilityReport.blueprintSuggestions.components.length > 0 && (
                            <div>
                              <span className="text-[9px] font-mono text-bento-text/40 uppercase tracking-wider mb-2 block">Blueprint Suggestions</span>
                              <div className="flex flex-wrap gap-1.5">
                                {activeRun.feasibilityReport.blueprintSuggestions.components.map((c, i) => (
                                  <span key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                    c.priority === 'core' ? 'bg-violet-950/30 border-violet-800/40 text-violet-400'
                                      : c.priority === 'supporting' ? 'bg-bento-accent/10 border-bento-accent/30 text-bento-accent'
                                      : 'bg-bento-bg/50 border-bento-border/40 text-bento-text/50'
                                  }`}>
                                    {c.name} ({c.type})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Worker Enclaves */}
                      <div className="bg-bento-card border border-bento-border rounded-xl p-5 shadow-xl">
                        <div className="flex items-center gap-2 mb-4 border-b border-bento-border pb-3">
                          <Cpu className="w-4 h-4 text-bento-accent" />
                          <h3 className="font-semibold text-bento-text-bright text-sm tracking-tight">
                            Worker Enclaves
                          </h3>
                          <span className="text-[10px] font-mono text-bento-text/40 ml-auto">
                            {activeRun.workerRuns?.length || activeRun.planJson?.workersNeeded?.length || 0} enclaves
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {(activeRun.planJson?.workersNeeded || []).map((worker, idx) => {
                            const workerRun = activeRun.workerRuns?.find(w => w.workerLabel === worker);
                            const boundaries = activeRun.planJson?.workspaceBoundaries?.[worker] || [];
                            const status = workerRun?.status || 'pending';
                            const statusColor = status === 'completed' ? 'border-emerald-700/50 bg-emerald-950/10 text-emerald-400'
                              : status === 'running' ? 'border-bento-accent/30 bg-bento-accent/10 text-bento-accent animate-pulse'
                              : 'border-bento-border/50 bg-bento-card/20 text-bento-text/40';
                            return (
                              <div key={worker} className={`border rounded-lg p-3 transition flex flex-col gap-2 ${statusColor}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold">{worker}</span>
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                    status === 'completed' ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                                      : status === 'running' ? 'bg-bento-accent/20 border-bento-accent/40 text-bento-accent'
                                      : 'bg-bento-bg/40 border-bento-border/40 text-bento-text/40'
                                  }`}>
                                    {status.toUpperCase()}
                                  </span>
                                </div>
                                {boundaries.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {boundaries.map(b => (
                                      <span key={b} className="text-[9px] font-mono bg-bento-bg/50 border border-bento-border/30 px-1.5 py-0.5 rounded">
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {workerRun && (
                                  <div className="text-[9px] font-mono text-bento-text/40 mt-0.5">
                                    {workerRun.filesCreated.length} files created
                                  </div>
                                )}
                              </div>
                            );
                          })}
                    </div>
                  </div>

                  {/* Contract Registry */}
                  {activeRun.contracts && activeRun.contracts.length > 0 && (
                    <div className="bg-bento-card border border-bento-border rounded-xl p-5 shadow-xl">
                      <div className="flex items-center gap-2 mb-4 border-b border-bento-border pb-3">
                        <Code className="w-4 h-4 text-bento-accent" />
                        <h3 className="font-semibold text-bento-text-bright text-sm tracking-tight">
                          Contract Registry
                        </h3>
                        <span className="text-[10px] font-mono text-bento-text/40 ml-auto">{activeRun.contracts.length} contracts</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeRun.contracts.map(c => (
                          <div key={c.name} className="border border-bento-border/60 rounded-lg p-3 bg-bento-card/20">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-bento-text-bright font-mono">{c.name}</span>
                              <span className="text-[9px] font-mono text-bento-accent bg-bento-accent/10 px-1.5 py-0.5 rounded">{c.format}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-bento-text/50 font-mono">
                              <span>Owner: {c.owner}</span>
                              <span>v{c.version}</span>
                            </div>
                            {c.consumers && c.consumers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {c.consumers.map(cons => (
                                  <span key={cons} className="text-[8px] font-mono bg-bento-bg/50 border border-bento-border/30 px-1.5 py-0.5 rounded text-bento-text/40">{cons}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeRun.planMarkdown && (
                        <div className="bg-bento-card border border-bento-border rounded-xl p-5 shadow-lg prose prose-invert max-w-none text-xs leading-relaxed font-sans text-bento-text">
                          <h4 className="font-bold text-bento-text-bright mb-3 border-b border-bento-border pb-2">Structured Master Plan Output</h4>
                          <pre className="whitespace-pre-wrap font-sans text-bento-text/90 leading-normal">{activeRun.planMarkdown}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  {activeDeckTab === 'workers' && (
                    <WorkerBoard workers={activeRun.workerRuns} />
                  )}

                  {activeDeckTab === 'workspace' && (
                    <WorkspaceExplorer
                      files={files}
                      buildLog={activeRun.buildReport?.logs}
                      qaLog={activeRun.qaReport?.logs}
                    />
                  )}

                  {activeDeckTab === 'telemetry' && (
                    <WorkflowTimeline logs={logs} currentStatus={activeRun.status} />
                  )}

                  {activeDeckTab === 'preview' && activeRun?.previewUrl && (
                    <div className="bg-bento-card border border-bento-border rounded-xl overflow-hidden shadow-2xl flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
                      <div className="px-5 py-3 bg-bento-card/30 border-b border-bento-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-bento-accent" />
                          <h3 className="font-semibold text-bento-text-bright text-sm tracking-tight">Eburon Live Preview</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">LIVE</span>
                          <a
                            href={activeRun.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-bento-accent hover:text-bento-accent-hover underline ml-2 font-mono"
                          >
                            Open in new tab ↗
                          </a>
                        </div>
                      </div>
                      <iframe
                        src={activeRun.previewUrl}
                        className="flex-1 w-full bg-white"
                        style={{ border: 'none' }}
                        title="Eburon Live Preview"
                        sandbox="allow-scripts allow-same-origin"
                      />
                    </div>
                  )}

                  {activeDeckTab === 'admin' && (
                    <AdminPanel apiActive={!!settings?.geminiKeyActive} />
                  )}
                </div>
              </>
            ) : (
              /* No run active yet - show Prompt Intake central cockpit */
              <div className="max-w-3xl mx-auto py-12 flex flex-col gap-8">
                <div className="bg-gradient-to-tr from-bento-card via-bento-card/80 to-bento-card border border-bento-border rounded-2xl p-8 text-center flex flex-col items-center gap-4 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-bento-accent to-transparent" />
                  <Sparkles className="w-10 h-10 text-bento-accent" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold tracking-tight text-bento-text-bright font-sans">Dispatch Autonomous Software Generator</h3>
                    <p className="text-bento-text/60 text-xs max-w-lg leading-relaxed font-sans">
                      Enter your application specification. Eburon Codebox will classify, build visual blueprints, coordinate specialized workers, run tests, and package a fully responsive code ZIP autonomously.
                    </p>
                  </div>

                  <form onSubmit={handleDispatchRun} className="w-full mt-4 flex flex-col gap-3">
                    <textarea
                      required
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., Build a responsive metrics tracker with database schemas, active latency metrics, and styled stats cards."
                      rows={4}
                      className="w-full bg-bento-bg border border-bento-border rounded-xl p-4 text-bento-text-bright placeholder-bento-text/30 text-sm focus:outline-none focus:border-bento-accent font-mono focus:ring-1 focus:ring-bento-accent/25 leading-relaxed"
                    />
                    <div className="flex justify-end mt-1">
                      <button
                        type="submit"
                        disabled={submittingPrompt}
                        className="bg-bento-accent hover:bg-bento-accent-hover text-white font-bold text-xs px-6 py-3 rounded-lg transition flex items-center gap-2 shadow-lg hover:shadow-indigo-500/10"
                      >
                        {submittingPrompt ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                        Initialize Eburon Pipeline
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
