import { cn } from "@/lib/utils";
import { BrainCircuit, RadioReceiver, ShieldAlert, TerminalSquare, AlertTriangle, CalendarDays } from "lucide-react";
import { NewsEvent } from "@/lib/newsFilter";

interface TelemetryPanelProps {
  bias: string;
  signal: string;
  confidence: number;
  reasoning?: string;
  logs: string[];
  resources: { rss: string; heapUsed: string } | null;
  newsEvents: NewsEvent[];
  className?: string;
}

export function TelemetryPanel({ bias, signal, confidence, reasoning, logs, resources, newsEvents, className }: TelemetryPanelProps) {
  
  // News logic for countdowns
  const now = new Date();
  const upcomingHighImpact = newsEvents
    .filter(e => new Date(e.date) > now && e.impact === 'High')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  const isHighImpactLock = newsEvents.some(e => {
    const diff = Math.abs(new Date(e.date).getTime() - now.getTime());
    return e.impact === 'High' && diff <= 30 * 60 * 1000;
  });

  const getCountdown = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - now.getTime();
    if (diff < 0) return 'NOW';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };
  
  // Dynamic color derivation
  let signalColorClass = "text-fore-muted bg-fore-muted/10 border-fore-muted/30";
  let pulseColorClass = "bg-fore-muted/50";
  let biasGlow = "bg-brand-blue/10";
  let biasText = "text-brand-blue/80";

  if (signal === 'BUY') {
    signalColorClass = "text-brand-green bg-brand-green/10 border-brand-green/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]";
    pulseColorClass = "bg-brand-green animate-ping";
    biasGlow = "bg-brand-green/10";
    biasText = "text-brand-green/90";
  } else if (signal === 'SELL') {
    signalColorClass = "text-brand-red bg-brand-red/10 border-brand-red/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
    pulseColorClass = "bg-brand-red animate-ping";
    biasGlow = "bg-brand-red/10";
    biasText = "text-brand-red/90";
  } else if (signal.includes('SYSTEM LOCKED') || isHighImpactLock) {
    signalColorClass = "text-amber-500 bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse";
    pulseColorClass = "bg-amber-500 animate-ping";
    biasGlow = "bg-amber-500/10";
    biasText = "text-amber-500 font-bold";
  } else if (signal === 'NEUTRAL' || signal === 'WAIT') {
    signalColorClass = "text-fore-muted bg-fore-muted/10 border-border-card";
    pulseColorClass = "bg-fore-muted animate-pulse";
    biasGlow = "bg-brand-blue/10"; // Default blue
    biasText = "text-brand-blue/80";
  }

  // Override if error
  if (bias === 'API ERROR') {
    biasText = "text-brand-red animate-pulse";
    biasGlow = "bg-brand-red/20";
  }

  return (
    <div className={cn("flex flex-col gap-3 w-full h-full max-h-full", className)}>
      
      {/* 1. Active Bias & Confidence (Compact Stack) */}
      <div className="flex flex-col flex-none p-4 rounded-xl border border-border-card bg-back-card/80 backdrop-blur shadow-lg relative overflow-hidden">
        <div className={cn("absolute top-0 right-0 w-20 h-20 rounded-full blur-3xl -mr-10 -mt-10 transition-colors duration-1000", biasGlow)}></div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-3 h-3 text-brand-blue opacity-80" />
            <h3 className="text-[9px] font-bold text-fore-muted uppercase tracking-widest">Active Bias</h3>
          </div>
          <span className="font-mono text-[10px] text-fore-base font-bold">{confidence}%</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className={cn("text-xl font-bold font-mono tracking-tighter transition-colors duration-1000 text-center", biasText, bias === 'CALC...' ? "animate-pulse" : "")}>
            {bias}
          </span>
          <div className="w-full h-1 bg-back-base rounded-full overflow-hidden">
            <div className="h-full bg-brand-red/70 transition-all duration-1000" style={{ width: `${confidence}%` }}></div>
          </div>
        </div>
      </div>

      {/* 2. Upcoming Market Events (High Impact Only) */}
      <div className="flex flex-col flex-none p-4 rounded-xl border border-border-card bg-back-card/60 shadow-lg relative overflow-hidden group">
        <div className="flex items-center gap-2 mb-3 border-b border-border-card pb-2">
          <CalendarDays className="w-3 h-3 text-brand-red" />
          <h3 className="text-[9px] font-bold text-fore-muted uppercase tracking-widest">Upcoming Market Events</h3>
        </div>
        <div className="space-y-2">
          {newsEvents.some(e => e.title === 'FETCH_ERROR') ? (
            <div className="text-[9px] text-brand-red font-bold font-mono py-1 text-center uppercase animate-pulse">
              [NEWS ERROR] FAILED TO SYNC CALENDAR
            </div>
          ) : upcomingHighImpact.length === 0 ? (
            <div className="text-[9px] text-fore-muted/40 font-mono py-1 text-center uppercase tracking-tighter">No High-Impact News Scheduled</div>
          ) : (
            upcomingHighImpact.map((event, i) => (
              <div key={i} className="flex flex-col gap-0.5 border-l border-brand-red/40 pl-2">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold text-brand-red uppercase">{event.impact}</span>
                  <span className="text-[9px] font-mono text-brand-neon font-bold">{getCountdown(event.date)}</span>
                </div>
                <div className="text-[9px] text-fore-muted font-mono truncate">{event.title}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Signal Status */}
      <div className="flex flex-col flex-none p-4 rounded-xl border border-border-card bg-back-card/80 backdrop-blur shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RadioReceiver className="w-3 h-3 text-brand-neon opacity-80" />
            <h3 className="text-[9px] font-bold text-fore-muted uppercase tracking-widest">Signal Status</h3>
          </div>
          <div className={cn("w-1.5 h-1.5 rounded-full", pulseColorClass)}></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className={cn("px-4 py-1.5 rounded-sm border font-mono text-lg font-bold tracking-widest transition-all duration-500", signalColorClass)}>
            {signal}
          </div>
          {isHighImpactLock && (
            <div className="flex items-center gap-1 text-[8px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" /> NEWS LOCK ACTIVE
            </div>
          )}
        </div>
      </div>

      {/* 4. Resource Metrics (Ultra Compact) */}
      <div className="flex flex-none items-center justify-between p-3 rounded-xl border border-border-card bg-back-panel/20 shadow-inner">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-neon/40"></div>
          <span className="text-[8px] font-bold text-fore-muted uppercase">RAM: <span className="text-brand-neon font-mono">{resources?.rss || '---'}</span></span>
        </div>
        <div className="w-24 h-1 bg-back-base rounded-full overflow-hidden">
           <div className="h-full bg-brand-neon/60" style={{ width: resources ? `${Math.min(100, (parseInt(resources.rss) / 512) * 100)}%` : '0%' }}></div>
        </div>
      </div>

      {/* 5. System Logs (Remaining Space) */}
      <div className="flex flex-col flex-1 min-h-0 p-4 rounded-xl border border-border-card bg-[#050505] shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2 border-b border-border-card/50 pb-1">
          <TerminalSquare className="w-3 h-3 text-fore-muted" />
          <h3 className="text-[9px] font-bold text-fore-muted uppercase tracking-widest">Terminal Logs</h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col-reverse">
           <div className="flex flex-col justify-end min-h-full">
              {logs.map((log, i) => (
                <div key={i} className={cn("text-[9px] font-mono mb-0.5 leading-tight", log.includes('Error') || log.includes('Closed') || log.includes('failure') ? "text-brand-red/90" : log.includes('[Executioner]') ? "text-brand-neon" : "text-fore-muted/80")}>
                  <span className="text-fore-muted/30 mr-1.5">{'>'}</span>{log}
                </div>
              ))}
           </div>
        </div>
      </div>

    </div>
  );
}
