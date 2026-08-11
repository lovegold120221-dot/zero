import React, { useState } from 'react';
import { WorkspaceFile } from '../../types';
import { FileCode, Play, Terminal, Eye, Code, FileText, CheckCircle } from 'lucide-react';

interface WorkspaceExplorerProps {
  files: WorkspaceFile[];
  buildLog?: string;
  qaLog?: string;
}

export default function WorkspaceExplorer({ files, buildLog, qaLog }: WorkspaceExplorerProps) {
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal' | 'qa'>('editor');

  // Set first file as default active file
  React.useEffect(() => {
    if (files.length > 0 && !activeFile) {
      setActiveFile(files[0]);
    }
  }, [files, activeFile]);

  const selectFile = (file: WorkspaceFile) => {
    setActiveFile(file);
    setActiveTab('editor');
  };

  return (
    <div className="flex h-full bg-bento-card border border-bento-border rounded-xl overflow-hidden shadow-2xl">
      {/* File Tree Left Rail */}
      <div className="w-64 border-r border-bento-border flex flex-col bg-bento-card/30">
        <div className="px-4 py-3 border-b border-bento-border flex items-center justify-between">
          <span className="text-xs font-semibold text-bento-text/50 tracking-wider uppercase">Workspace Modules</span>
          <span className="bg-bento-bg border border-bento-border text-[10px] px-2 py-0.5 rounded text-bento-accent font-mono">
            {files.length} modules
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {files.length === 0 ? (
            <p className="text-[11px] text-bento-text/40 text-center py-6 font-mono">Workspace empty.</p>
          ) : (
            files.map((file) => {
              const isActive = activeFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => selectFile(file)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-mono transition ${
                    isActive
                      ? 'bg-bento-bg text-bento-accent border border-bento-border shadow-sm'
                      : 'hover:bg-bento-bg/40 text-bento-text hover:text-bento-text-bright border border-transparent'
                  }`}
                >
                  <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-bento-accent' : 'text-bento-text/40'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-left font-medium">{file.path.split('/').pop()}</p>
                    <p className="text-[9px] text-bento-text/40 truncate text-left mt-0.5">
                      {file.path.substring(0, file.path.lastIndexOf('/')) || 'root'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Editor & Console Right Area */}
      <div className="flex-1 flex flex-col h-full bg-bento-bg/10">
        {/* Workspace Tab Header */}
        <div className="px-5 py-2.5 bg-bento-card/30 border-b border-bento-border flex items-center justify-between">
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeTab === 'editor'
                  ? 'bg-bento-bg text-bento-text-bright border border-bento-border shadow-sm'
                  : 'text-bento-text/50 hover:text-bento-text-bright'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Source Code
            </button>
            <button
              onClick={() => setActiveTab('terminal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeTab === 'terminal'
                  ? 'bg-bento-bg text-bento-text-bright border border-bento-border shadow-sm'
                  : 'text-bento-text/50 hover:text-bento-text-bright'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Build Validator Console
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeTab === 'qa'
                  ? 'bg-bento-bg text-bento-text-bright border border-bento-border shadow-sm'
                  : 'text-bento-text/50 hover:text-bento-text-bright'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Automated QA report
            </button>
          </div>
          {activeFile && activeTab === 'editor' && (
            <span className="text-[10px] font-mono text-bento-text/50 bg-bento-bg border border-bento-border px-2 py-0.5 rounded">
              Owned by: {activeFile.owner || 'System'}
            </span>
          )}
        </div>

        {/* Tab Content Display */}
        <div className="flex-1 overflow-auto p-5">
          {activeTab === 'editor' ? (
            activeFile ? (
              <div className="h-full flex flex-col font-mono text-xs">
                {/* Filepath breadcrumb bar */}
                <div className="px-3 py-1.5 bg-bento-card/50 rounded-t-lg border-t border-x border-bento-border text-[11px] text-bento-text/70 flex items-center justify-between">
                  <span>{activeFile.path}</span>
                  <span className="text-bento-text/40 text-[10px]">TypeScript Source</span>
                </div>
                <textarea
                  readOnly
                  value={activeFile.content}
                  className="flex-1 min-h-[400px] w-full bg-bento-bg p-4 rounded-b-lg border border-bento-border text-bento-text-bright focus:outline-none resize-none font-mono leading-relaxed"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-6 text-bento-text/40">
                <FileText className="w-8 h-8 text-bento-border mb-2" />
                <p className="text-xs">Select a workspace file from the left panel to begin analysis.</p>
              </div>
            )
          ) : activeTab === 'terminal' ? (
            <div className="h-full flex flex-col font-mono text-xs">
              <div className="px-3 py-1.5 bg-bento-card/50 rounded-t-lg border-t border-x border-bento-border text-[11px] text-bento-text/70">
                Compiler Shell Logs
              </div>
              <pre className="flex-1 bg-bento-bg p-4 rounded-b-lg border border-bento-border text-bento-accent overflow-auto whitespace-pre-wrap leading-relaxed font-mono">
                {buildLog || 'No compilation logs executed yet in this run.'}
              </pre>
            </div>
          ) : (
            <div className="h-full flex flex-col font-mono text-xs">
              <div className="px-3 py-1.5 bg-bento-card/50 rounded-t-lg border-t border-x border-bento-border text-[11px] text-bento-text/70">
                Acceptance QA Logs
              </div>
              <pre className="flex-1 bg-bento-bg p-4 rounded-b-lg border border-bento-border text-emerald-400 overflow-auto whitespace-pre-wrap leading-relaxed font-mono">
                {qaLog || 'QA harness holds ready. Initialize dispatcher pipeline to run tests.'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
