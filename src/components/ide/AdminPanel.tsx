import React, { useState } from 'react';
import { Shield, Server, Coins, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface AdminPanelProps {
  apiActive: boolean;
}

export default function AdminPanel({ apiActive }: AdminPanelProps) {
  const [modelType, setModelType] = useState('gemini-3.5-flash');
  const [sandboxPolicy, setSandboxPolicy] = useState('Chrooted Sandbox Containers');
  const [budgetLimit, setBudgetLimit] = useState('5.00');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-bento-card border border-bento-border rounded-xl p-6 shadow-2xl flex flex-col gap-6">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-bento-border pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-bento-accent" />
          <h3 className="font-bold text-bento-text-bright text-sm tracking-tight">Eburon Codebox Administration Console</h3>
        </div>
        <span className="text-[10px] text-bento-text/40 font-mono">Platform Admin Level 1</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Key Connection Status */}
        <div className="border border-bento-border/60 p-4 rounded-xl bg-bento-card/30 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-bento-accent" />
            <h4 className="font-semibold text-bento-text-bright text-xs">AI Key Connection Link</h4>
          </div>
          <div className={`p-4 rounded-lg flex flex-col gap-1.5 border ${
            apiActive 
              ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-300' 
              : 'bg-amber-950/10 border-amber-900/40 text-amber-300'
          }`}>
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              {apiActive ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
              <span>{apiActive ? 'Gemini API link ACTIVE' : 'API Sandbox Simulator Active'}</span>
            </div>
            <p className="text-[11px] text-bento-text/70 leading-normal font-sans">
              {apiActive 
                ? 'Your system environment has a valid Gemini API key. System is executing live model runs for planning and code optimization.' 
                : 'No API key is configured in Secrets panel. Eburon is utilizing its high-fidelity compiler-simulation models.'}
            </p>
          </div>
        </div>

        {/* Configurations Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 border border-bento-border/60 p-4 rounded-xl bg-bento-card/30 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-bento-accent" />
            <h4 className="font-semibold text-bento-text-bright text-xs">Worker Routing Configuration</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-bento-text/50 mb-1">
                Eburon Main Planner Model
              </label>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                className="w-full bg-bento-bg border border-bento-border rounded-lg px-3 py-2 text-bento-text-bright text-xs focus:outline-none focus:border-bento-accent"
              >
                <option value="gemini-3.5-flash">Eburon Flash (gemini-3.5-flash)</option>
                <option value="gemini-3.1-pro-preview">Eburon Pro (gemini-3.1-pro-preview)</option>
                <option value="ollama-deepseek">Local Ollama DeepSeek R1</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-bento-text/50 mb-1">
                Security Sandbox Isolation
              </label>
              <select
                value={sandboxPolicy}
                onChange={(e) => setSandboxPolicy(e.target.value)}
                className="w-full bg-bento-bg border border-bento-border rounded-lg px-3 py-2 text-bento-text-bright text-xs focus:outline-none focus:border-bento-accent"
              >
                <option value="Chrooted Sandbox Containers">Chrooted Sandbox Containers</option>
                <option value="Hypervisor MicroVM Containment">Hypervisor MicroVM Containment</option>
                <option value="Local Process Mock Sandbox">Local Process Mock Sandbox</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-bento-text/50 mb-1 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-bento-accent" />
                Budget Warning Limit ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                className="w-full bg-bento-bg border border-bento-border rounded-lg px-3 py-2 text-bento-text-bright text-xs focus:outline-none focus:border-bento-accent font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-bento-accent hover:bg-bento-accent-hover text-white font-semibold text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
            >
              {saved ? <Check className="w-3.5 h-3.5" /> : null}
              {saved ? 'Settings Saved' : 'Apply Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
