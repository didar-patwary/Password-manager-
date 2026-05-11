import React, { useState, useRef, useEffect } from 'react';
import { LogEntry } from '../types';
import { Terminal as TerminalIcon, Sparkles, Send, Trash2 } from 'lucide-react';

interface TerminalProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  onExecuteCommand: (command: string) => string | void;
}

export default function Terminal({ logs, onClearLogs, onExecuteCommand }: TerminalProps) {
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll terminal to bottom
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;

    // Add to command local history
    setHistory(prev => [cmd, ...prev].slice(0, 50));
    setHistoryIndex(-1);

    // Call execution
    onExecuteCommand(cmd);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInputVal(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInputVal(history[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  return (
    <div id="diagnostics-terminal" className="bg-[#0b0c10]/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden flex flex-col h-[340px] font-mono text-xs shadow-2xl relative z-10 animate-fade-in">
      {/* Terminal Titlebar */}
      <div className="bg-white/5 px-4.5 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          </div>
          <span className="text-slate-200 font-bold text-[11px] tracking-wide flex items-center gap-1.5 uppercase ml-2 select-none">
            <TerminalIcon className="w-4 h-4 text-emerald-400" />
            HermitDB Core Sync Engine v1.0.4-local
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 uppercase flex items-center gap-1 font-bold select-none">
            <Sparkles className="w-2.5 h-2.5 animate-pulse" /> Sandbox Mode
          </span>
          <button 
            type="button"
            id="clear-logs-btn"
            onClick={onClearLogs}
            className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-white/5 rounded-xl transition cursor-pointer"
            title="Clear Diagnostics Frame"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Scrolling Logs */}
      <div className="flex-1 overflow-y-auto p-4.5 space-y-2 selection:bg-emerald-500/30 selection:text-white leading-relaxed">
        <div className="text-slate-550 italic text-[10px] mb-2.5 border-b border-white/5 pb-1 select-none">
          -- System initialized. Type 'help' in console box to inspect system procedures. --
        </div>
        
        {logs.map((log) => {
          let logColor = 'text-slate-300';
          let badgeColor = 'bg-white/5 border-white/5 text-slate-400';
          
          if (log.type === 'success') {
            logColor = 'text-[#5cd6ff] font-semibold';
            badgeColor = 'bg-cyan-500/10 border-cyan-500/15 text-cyan-400';
          } else if (log.type === 'warn') {
            logColor = 'text-amber-400';
            badgeColor = 'bg-amber-500/10 border-amber-500/15 text-amber-500';
          } else if (log.type === 'error') {
            logColor = 'text-rose-400 font-bold';
            badgeColor = 'bg-rose-500/10 border-rose-500/15 text-rose-400';
          } else if (log.type === 'crypto') {
            logColor = 'text-fuchsia-400';
            badgeColor = 'bg-fuchsia-500/10 border-fuchsia-500/15 text-fuchsia-400';
          } else if (log.type === 'sync') {
            logColor = 'text-emerald-450 text-emerald-400 font-medium';
            badgeColor = 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400';
          }

          const padSource = (log.source + '          ').substring(0, 10);

          return (
            <div key={log.id} className="leading-relaxed flex items-start gap-2.5 select-text">
              <span className="text-slate-600 shrink-0 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className={`shrink-0 border px-1.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${badgeColor} select-none`}>
                {padSource}
              </span>
              <span className={`${logColor} break-all`}>{log.message}</span>
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Interactive Input Box */}
      <form onSubmit={handleSubmit} className="border-t border-white/5 flex items-center bg-black/45 px-4.5 py-2.5 shadow-inner">
        <label htmlFor="terminal-command-input" className="text-emerald-400 mr-2 shrink-0 select-none font-bold">hermitdb~$&gt;</label>
        <div className="flex-1 relative flex items-center">
          <input
            id="terminal-command-input"
            type="text"
            className="w-full bg-transparent focus:outline-none text-emerald-400 font-mono text-xs placeholder:text-slate-700 font-medium"
            placeholder="Type 'help', 'status', 'compact', or 'sync'..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
          {inputVal === '' && <span className="terminal-cursor absolute left-0 pr-1 select-none pointer-events-none"></span>}
        </div>
        <button
          type="submit"
          id="send-cmd-btn"
          className="text-slate-500 hover:text-emerald-400 p-1 rounded transition ml-1 shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
