import React from 'react';
import { WorkerRun } from '../../types';
import { ShieldAlert, CheckCircle, HelpCircle, Activity, FileCheck, ShieldAlert as ShieldIcon } from 'lucide-react';

interface WorkerBoardProps {
  workers?: WorkerRun[];
}

export default function WorkerBoard({ workers }: WorkerBoardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
      case 'failed':
        return 'text-rose-400 bg-rose-950/20 border-rose-900/30';
      case 'running':
        return 'text-bento-accent bg-bento-accent/10 border-bento-accent/30 animate-pulse';
      default:
        return 'text-bento-text/40 bg-bento-card/30 border-bento-border/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5" />;
      case 'failed':
        return <ShieldAlert className="w-3.5 h-3.5 animate-bounce" />;
      case 'running':
        return <Activity className="w-3.5 h-3.5 animate-spin" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="bg-bento-card border border-bento-border rounded-xl p-5 shadow-lg">
      <h3 className="font-semibold text-bento-text-bright text-sm tracking-tight mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-bento-accent" />
        Orchestrated Worker Model Status Board
      </h3>

      {!workers || workers.length === 0 ? (
        <p className="text-xs text-bento-text/50 font-mono py-4 text-center">No active worker models dispatched in current step.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workers.map((w) => (
            <div
              key={w.workerName}
              className="border border-bento-border/80 rounded-xl p-4 bg-bento-card/35 flex flex-col gap-3 hover:border-bento-border hover:bg-bento-card/60 transition"
            >
              {/* Card Title & Status Badge */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-bento-text-bright text-xs tracking-tight">{w.workerLabel}</h4>
                  <span className="text-[9px] font-mono text-bento-text/40">{w.modelUsed}</span>
                </div>
                <div className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold flex items-center gap-1 ${getStatusColor(w.status)}`}>
                  {getStatusIcon(w.status)}
                  {w.status.toUpperCase()}
                </div>
              </div>

              {/* Manifest summary */}
              {w.status === 'completed' && w.manifest && (
                <div className="bg-bento-bg/70 border border-bento-border/70 rounded-lg p-2.5 text-[10px] text-bento-text/70 space-y-1.5 font-mono">
                  <div className="flex items-center gap-1 text-[11px] text-bento-text-bright">
                    <FileCheck className="w-3.5 h-3.5 text-bento-accent" />
                    <span>Worker Output Manifest</span>
                  </div>
                  <div>
                    <span className="text-bento-text/50">Created Modules:</span>
                    <ul className="list-disc pl-3 text-[9px] text-bento-text/40 space-y-0.5 mt-0.5">
                      {w.manifest.filesCreated.map(f => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-between text-[9px] border-t border-bento-border/60 pt-1.5 text-bento-text/50">
                    <span>Contracts: {w.manifest.contractsUsed.join(', ')}</span>
                    <span className="text-emerald-400 font-bold">Checked OK</span>
                  </div>
                </div>
              )}

              {/* Logs Stream */}
              <div className="text-[10px] text-bento-text/60 font-mono bg-bento-bg/40 p-2 rounded max-h-24 overflow-y-auto leading-normal whitespace-pre-wrap">
                {w.log || 'Worker enclave standing by...'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
