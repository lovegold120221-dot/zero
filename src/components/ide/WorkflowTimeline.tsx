import React, { useEffect, useRef } from 'react';
import { LogEntry, RunStatus } from '../../types';
import { Terminal, Shield, Play, CheckCircle2, AlertTriangle, Cpu, Box } from 'lucide-react';

interface WorkflowTimelineProps {
  logs: LogEntry[];
  currentStatus: RunStatus;
}

export default function WorkflowTimeline({ logs, currentStatus }: WorkflowTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'error':
        return <Shield className="w-4 h-4 text-rose-500" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Cpu className="w-4 h-4 text-bento-accent" />;
    }
  };

  const getLogBg = (level: string) => {
    switch (level) {
      case 'success':
        return 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300';
      case 'error':
        return 'bg-rose-950/20 border-rose-900/40 text-rose-300';
      case 'warn':
        return 'bg-amber-950/15 border-amber-900/30 text-amber-300';
      default:
        return 'bg-bento-bg/60 border-bento-border text-bento-text/60';
    }
  };

  const formatPhaseLabel = (phase: string) => {
    return phase.toUpperCase().replace(/_/g, ' ');
  };

  return (
    <div className="flex flex-col h-full bg-bento-card rounded-xl border border-bento-border overflow-hidden">
      {/* Header Panel */}
      <div className="px-5 py-4 bg-bento-card/30 border-b border-bento-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-bento-accent" />
          <h3 className="font-semibold text-bento-text-bright text-sm tracking-tight">Eburon Live Telemetry Stream</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-bento-bg border border-bento-border rounded-lg px-2.5 py-1 text-xs">
          <span className="w-2 h-2 bg-bento-accent animate-ping rounded-full" />
          <span className="text-[10px] font-mono text-bento-accent font-bold">{currentStatus.toUpperCase()}</span>
        </div>
      </div>

      {/* Main Timeline Log list */}
      <div ref={containerRef} className="flex-1 p-5 overflow-y-auto font-mono space-y-4">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-bento-text/40">
            <Box className="w-8 h-8 text-bento-text/30 mb-2 animate-bounce" />
            <p className="text-xs">Waiting for autonomous compiler stream initialization...</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-4 items-start group">
              {/* Dot & Line Connector */}
              <div className="flex flex-col items-center flex-shrink-0 mt-1">
                <div className={`p-1 rounded-full border ${getLogBg(log.level)}`}>
                  {getLogIcon(log.level)}
                </div>
                <div className="w-0.5 h-full bg-bento-border mt-2 min-h-[20px]" />
              </div>

              {/* Log Card */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-bento-text/40 font-semibold">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="bg-bento-bg text-[9px] text-bento-accent px-1.5 py-0.5 rounded border border-bento-border font-bold">
                    {formatPhaseLabel(log.phase)}
                  </span>
                </div>
                <div className="bg-bento-bg/50 border border-bento-border/70 rounded-lg p-3">
                  <p className="text-xs text-bento-text-bright leading-relaxed font-sans">{log.message}</p>
                  {log.details && (
                    <pre className="text-[10px] text-bento-text/50 mt-2 bg-bento-bg p-2.5 rounded border border-bento-border overflow-x-auto leading-normal whitespace-pre-wrap">
                      {log.details}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
