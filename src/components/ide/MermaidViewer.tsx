import React, { useState } from 'react';
import { RunStatus } from '../../types';
import { Layers, ChevronDown, ChevronUp, Copy, Check, Info } from 'lucide-react';

interface MermaidViewerProps {
  source?: string;
  activeStatus: RunStatus;
}

export default function MermaidViewer({ source, activeStatus }: MermaidViewerProps) {
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!source) return;
    navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStepState = (phases: RunStatus[]) => {
    if (phases.includes(activeStatus)) {
      return 'active';
    }
    // Simple heuristic to see if past
    const order: RunStatus[] = [
      'draft',
      'clarifying',
      'feasibility_scan',
      'planning',
      'checking_plan',
      'filling_gaps',
      'generating_blueprint',
      'blueprint_publishing',
      'task_packet_gen',
      'dispatching_workers',
      'workers_running',
      'worker_blocked',
      'manifest_review',
      'blueprint_governor',
      'merging',
      'conflict_checker',
      'planner_review',
      'redo_required',
      'validating_build',
      'qa_running',
      'dod_check',
      'packaging',
      'previewing',
      'human_qa',
      'ready_for_human_test',
      'released',
    ];
    const currentIndex = order.indexOf(activeStatus);
    const targetIndex = order.indexOf(phases[0]);
    if (currentIndex > targetIndex) {
      return 'completed';
    }
    return 'pending';
  };

  const getStepStyle = (phases: RunStatus[]) => {
    const state = getStepState(phases);
    switch (state) {
      case 'active':
        return 'border-bento-accent text-bento-accent bg-bento-accent/10 shadow-[0_0_15px_rgba(99,102,241,0.15)] animate-pulse';
      case 'completed':
        return 'border-emerald-600/60 text-emerald-400 bg-emerald-950/10';
      default:
        return 'border-bento-border text-bento-text/40 bg-bento-card/20';
    }
  };

  return (
    <div className="bg-bento-card border border-bento-border rounded-xl p-5 flex flex-col gap-6 shadow-xl">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-bento-border pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-bento-accent" />
          <h3 className="font-semibold text-bento-text-bright text-sm tracking-tight">Common Mermaid Mainframe System</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-bento-text/50 font-mono">
          <Info className="w-3.5 h-3.5 text-bento-accent" />
          Real-time dynamic orchestration map v1.0.0
        </div>
      </div>

      {/* Main visual interactive system graph */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-4 text-center text-xs">
        {/* Phase 1: Intake */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['draft', 'clarifying'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 1</span>
          <span className="font-semibold text-[11px]">Prompt Intake</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Classifier + Clarifier</p>
        </div>

        {/* Phase 2: Feasibility */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['feasibility_scan'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 2</span>
          <span className="font-semibold text-[11px]">Feasibility</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Platform + Capability Scan</p>
        </div>

        {/* Phase 3: Planner */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['planning', 'checking_plan', 'filling_gaps', 'generating_blueprint'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 3</span>
          <span className="font-semibold text-[11px]">Planner</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Blueprint + Gap Fill</p>
        </div>

        {/* Phase 4: Blueprint */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['blueprint_publishing', 'task_packet_gen'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 4</span>
          <span className="font-semibold text-[11px]">Blueprint Registry</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Publish + Task Packets</p>
        </div>

        {/* Phase 5: Workers */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['dispatching_workers', 'workers_running', 'worker_blocked'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 5</span>
          <span className="font-semibold text-[11px]">Worker Enclaves</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Parallel Bounded Workspaces</p>
        </div>

        {/* Phase 6: Governor */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['manifest_review', 'blueprint_governor'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 6</span>
          <span className="font-semibold text-[11px]">Governor</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Manifest + Change Classify</p>
        </div>

        {/* Phase 7: Merge */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['merging', 'conflict_checker', 'planner_review', 'redo_required'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 7</span>
          <span className="font-semibold text-[11px]">Integration</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Merge + Conflict Check</p>
        </div>

        {/* Phase 8: Build & QA */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['validating_build', 'qa_running', 'dod_check'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 8</span>
          <span className="font-semibold text-[11px]">Build + QA</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Validate + DoD</p>
        </div>

        {/* Phase 9: Package */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['packaging'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 9</span>
          <span className="font-semibold text-[11px]">Package</span>
          <p className="text-[9px] text-bento-text/50 font-sans">ZIP + SBOM</p>
        </div>

        {/* Phase 10: Preview */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['previewing', 'human_qa'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 10</span>
          <span className="font-semibold text-[11px]">Human QA</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Live Preview + Approval</p>
        </div>

        {/* Phase 11: Release */}
        <div className={`border rounded-lg p-3 flex flex-col justify-center items-center gap-1 transition ${getStepStyle(['ready_for_human_test', 'released'])}`}>
          <span className="font-mono text-[8px] text-bento-text/40">PHASE 11</span>
          <span className="font-semibold text-[11px]">Release</span>
          <p className="text-[9px] text-bento-text/50 font-sans">Sign + Provenance</p>
        </div>
      </div>

      {/* Collapsible Mermaid source code block */}
      <div className="border border-bento-border rounded-lg overflow-hidden bg-bento-bg/40">
        <button
          onClick={() => setShowSource(!showSource)}
          className="w-full px-4 py-3 bg-bento-card/30 flex items-center justify-between text-xs text-bento-text/70 hover:bg-bento-card/60 transition"
        >
          <span className="font-mono font-semibold">Mermaid Source Specification (.mermaid)</span>
          <div className="flex items-center gap-2">
            {showSource ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showSource && (
          <div className="p-4 border-t border-bento-border relative">
            <button
              onClick={copyToClipboard}
              className="absolute top-4 right-4 bg-bento-bg hover:bg-bento-card border border-bento-border text-bento-text/60 hover:text-bento-text-bright p-1.5 rounded transition"
              title="Copy Mermaid Blueprint Source"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <pre className="text-[10px] text-bento-accent font-mono overflow-x-auto whitespace-pre leading-relaxed p-2 max-h-72">
              {source || 'Blueprint not compiled yet. Select a project run to inspect diagrams.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
