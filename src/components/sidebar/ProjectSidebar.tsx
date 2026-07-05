import React, { useState } from 'react';
import { Project, ProjectRun } from '../../types';
import { Plus, FolderGit, Cpu, Settings, Layers, Calendar, ChevronRight } from 'lucide-react';

interface ProjectSidebarProps {
  projects: Project[];
  activeProject: Project | null;
  activeRun: ProjectRun | null;
  runs: ProjectRun[];
  onSelectProject: (p: Project) => void;
  onSelectRun: (r: ProjectRun) => void;
  onCreateProject: (name: string, description: string) => void;
  onOpenSettings: () => void;
}

export default function ProjectSidebar({
  projects,
  activeProject,
  activeRun,
  runs,
  onSelectProject,
  onSelectRun,
  onCreateProject,
  onOpenSettings,
}: ProjectSidebarProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateProject(name, desc);
    setName('');
    setDesc('');
    setShowNewModal(false);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
      case 'ready_for_human_test':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      case 'failed':
        return 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
      case 'draft':
        return 'bg-slate-500';
      case 'clarifying':
        return 'bg-amber-500 animate-pulse';
      default:
        return 'bg-indigo-400 animate-ping';
    }
  };

  return (
    <div className="w-80 bg-bento-bg border-r border-bento-border flex flex-col h-screen text-bento-text">
      {/* Title Header */}
      <div className="p-6 border-b border-bento-border flex items-center justify-between bg-bento-card/10">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-indigo-500 p-2 rounded-lg text-slate-900 shadow-[0_0_12px_rgba(99,102,241,0.3)]">
            <Cpu className="w-5 h-5 text-bento-text-bright" />
          </div>
          <div>
            <h1 className="font-bold text-bento-text-bright tracking-tight text-lg font-sans">EBURON</h1>
            <p className="text-[10px] text-bento-accent font-mono font-medium tracking-wider">CODEBOX IDE v1</p>
          </div>
        </div>
      </div>

      {/* Projects List Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-xs font-semibold text-bento-text uppercase tracking-widest flex items-center gap-1.5">
              <FolderGit className="w-3.5 h-3.5 text-bento-accent" />
              Projects
            </h2>
            <button
              onClick={() => setShowNewModal(true)}
              className="p-1 hover:bg-bento-card rounded text-bento-accent hover:text-bento-accent-hover transition"
              title="Create New App Project"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            {projects.length === 0 ? (
              <p className="text-bento-text/60 text-xs text-center py-4 font-sans">No projects yet. Click + to begin.</p>
            ) : (
              projects.map((p) => {
                const isActive = activeProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition group ${
                      isActive
                        ? 'bg-bento-card text-bento-text-bright border border-bento-border/80 shadow-[0_4px_12px_rgba(99,102,241,0.06)]'
                        : 'hover:bg-bento-card/40 text-bento-text hover:text-bento-text-bright border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(p.status)} flex-shrink-0`} />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className="text-[10px] text-bento-text/60 truncate">{p.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-bento-text/40 group-hover:text-bento-text-bright transition" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Runs History Section */}
        {activeProject && (
          <div>
            <h2 className="text-xs font-semibold text-bento-text uppercase tracking-widest px-2 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-bento-accent" />
              Build Runs ({runs.length})
            </h2>

            <div className="space-y-1.5">
              {runs.length === 0 ? (
                <p className="text-bento-text/60 text-[11px] text-center py-4 font-mono">No pipelines executed yet.</p>
              ) : (
                runs.map((r) => {
                  const isActive = activeRun?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => onSelectRun(r)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex flex-col gap-1 transition ${
                        isActive
                          ? 'bg-bento-card/80 border border-bento-border text-bento-text-bright shadow-[0_2px_8px_rgba(99,102,241,0.05)]'
                          : 'hover:bg-bento-card/30 text-bento-text/70 hover:text-bento-text-bright border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-semibold text-bento-text/50">
                          RUN-{r.id.toUpperCase()}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(r.status)}`} />
                      </div>
                      <p className="text-xs truncate font-medium text-bento-text-bright">{r.prompt}</p>
                      <div className="flex items-center gap-1 text-[9px] text-bento-text/50 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Settings Area */}
      <div className="p-4 border-t border-bento-border bg-bento-card/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-bento-card border border-bento-border flex items-center justify-center text-bento-text-bright text-xs font-bold font-mono">
            E
          </div>
          <div>
            <p className="text-xs font-semibold text-bento-text-bright">Human Operator</p>
            <p className="text-[10px] text-indigo-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Connected
            </p>
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="p-2 hover:bg-bento-card rounded-lg text-bento-text hover:text-bento-accent transition"
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bento-card border border-bento-border rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-bento-text-bright mb-2 font-sans">Create Autonomous Software Project</h3>
            <p className="text-bento-text text-xs mb-4">
              Enter a name and purpose. Eburon Codebox will orchestrate a worker team to build it autonomously.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-bento-text uppercase tracking-wider mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Dynamic E-Commerce Dashboard"
                  className="w-full bg-bento-bg border border-bento-border rounded-lg px-3 py-2 text-bento-text-bright placeholder-bento-text/40 focus:outline-none focus:border-bento-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-bento-text uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g., Real-time inventory tracking, user profile controls, and billing reports"
                  rows={3}
                  className="w-full bg-bento-bg border border-bento-border rounded-lg px-3 py-2 text-bento-text-bright placeholder-bento-text/40 focus:outline-none focus:border-bento-accent text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-bento-text hover:text-bento-text-bright transition text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-bento-accent hover:bg-bento-accent-hover text-white font-semibold px-4 py-2 rounded-lg transition text-sm shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
