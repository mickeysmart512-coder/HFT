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
    <div className={cn("flex flex-col gap-4 w-full h-full", className)}>
      
      {/* Active Bias & Reasoning Card */}
      <div className="flex flex-col flex-none min-h-[180px] p-5 rounded-xl border border-border-card bg-back-card/80 backdrop-blur shadow-lg relative overflow-hidden group hover:border-brand-blue/50 transition-colors">
        <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-10 -mt-10 transition-colors duration-1000", biasGlow)}></div>
        <div className="flex items-center gap-3 mb-2">
          <BrainCircuit className="w-4 h-4 text-brand-blue opacity-80" />
          <h3 className="text-[10px] font-semibold text-fore-muted uppercase tracking-widest">Active Bias</h3>
        </div>
        <div className="flex items-center justify-center mb-3">
          <span className={cn("text-2xl font-bold font-mono tracking-tighter transition-colors duration-1000", biasText, bias === 'CALC...' ? "animate-pulse" : "")}>
            {bias}
          </span>
        </div>
        {reasoning && (
          <div className="mt-auto p-2 bg-black/40 overflow-y-auto custom-scrollbar h-16 text-[10px] font-mono text-brand-blue/80 border border-border-card/50 rounded z-10 relative">
            {reasoning}
          </div>
        )}
      </div>

      {/* Signal Status Card */}
      <div className="flex flex-col flex-none min-h-[140px] p-5 rounded-xl border border-border-card bg-back-card/80 backdrop-blur shadow-lg relative overflow-hidden group hover:border-brand-neon/50 transition-colors">
        <div className="absolute top-0 left-0 w-32 h-32 bg-brand-neon/5 rounded-full blur-3xl -ml-16 -mt-16"></div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <RadioReceiver className="w-4 h-4 text-brand-neon opacity-80" />
            <h3 className="text-[10px] font-semibold text-fore-muted uppercase tracking-widest">Signal Status</h3>
          </div>
          <div className={cn("w-2 h-2 rounded-full", pulseColorClass)}></div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className={cn("px-6 py-2 rounded-sm border font-mono text-xl font-bold tracking-widest transition-all duration-500", signalColorClass)}>
            {signal}
          </div>
          {isHighImpactLock && (
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-500 uppercase tracking-[0.2em] animate-pulse">
              <AlertTriangle className="w-3 h-3" /> NEWS LOCK ACTIVE
            </div>
          )}
        </div>
      </div>

      {/* Model Confidence Card */}
      <div className="flex flex-col flex-none min-h-[140px] p-5 rounded-xl border border-border-card bg-back-card/80 backdrop-blur shadow-lg relative overflow-hidden group hover:border-brand-red/50 transition-colors">
        <div className="absolute bottom-0 right-0 w-28 h-28 bg-brand-red/10 rounded-full blur-3xl -mr-10 -mb-10"></div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 text-brand-red opacity-80" />
            <h3 className="text-[10px] font-semibold text-fore-muted uppercase tracking-widest">Model Confidence</h3>
          </div>
          <span className="font-mono text-sm text-fore-base font-bold">{confidence}%</span>
        </div>
        <div className="flex-1 flex items-center justify-center w-full mt-2">
          <div className="w-full h-1.5 bg-back-base rounded-full overflow-hidden border border-border-card">
            <div 
               className="h-full bg-brand-red/70 transition-all duration-1000 ease-out"
               style={{ width: `${confidence}%` }}
            ></div>
          </div>
        </div>
        <div className="mt-4 text-[10px] font-mono text-fore-muted/60 text-center uppercase tracking-widest">
          {confidence > 0 ? "LIVE INFERENCE" : "Awaiting Data..."}
        </div>
      </div>

      {/* Resource & News Group */}
      <div className="flex flex-col gap-4 flex-none">
        {/* Resource Metrics Card */}
        <div className="flex flex-col p-4 rounded-xl border border-border-card bg-back-panel/20 shadow-inner">
          <h3 className="text-[10px] font-semibold text-fore-muted uppercase tracking-widest mb-3">Resource Metrics (Render)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-fore-muted uppercase">RAM Usage</span>
              <span className="font-mono text-xs text-brand-neon font-bold">{resources?.rss || '---'}</span>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span className="text-[9px] text-fore-muted uppercase">Heap Used</span>
              <span className="font-mono text-xs text-brand-blue font-bold">{resources?.heapUsed || '---'}</span>
            </div>
          </div>
          <div className="mt-3 w-full h-1 bg-back-base rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-neon/40 transition-all duration-1000"
              style={{ width: resources ? `${Math.min(100, (parseInt(resources.rss) / 512) * 100)}%` : '0%' }}
            ></div>
          </div>
        </div>

        {/* Upcoming News Widget */}
        <div className="flex flex-col p-4 rounded-xl border border-border-card bg-back-card/60 shadow-lg relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-3 border-b border-border-card pb-2">
            <CalendarDays className="w-4 h-4 text-brand-neon" />
            <h3 className="text-[10px] font-semibold text-fore-muted uppercase tracking-widest">Upcoming Market Events</h3>
          </div>
          <div className="space-y-3">
            {upcomingHighImpact.length === 0 ? (
              <div className="text-[10px] text-fore-muted/40 font-mono py-2 text-center uppercase tracking-tighter">No High-Impact News Scheduled</div>
            ) : (
              upcomingHighImpact.map((event, i) => {
                return (
                  <div key={i} className="flex flex-col gap-1 border-l-2 border-brand-red pl-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase text-brand-red bg-brand-red/10">
                        {event.impact}
                      </span>
                      <span className="text-[10px] font-mono text-brand-neon font-bold">
                        {event.title} in {getCountdown(event.date)}
                      </span>
                    </div>
                    <div className="text-[9px] text-fore-muted/60 font-mono truncate">
                      {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {event.title}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* System Logs Panel */}
      <div className="flex flex-col flex-1 min-h-[200px] p-4 rounded-xl border border-border-card bg-[#0a0a0a] shadow-inner relative overflow-hidden group">
        <div className="flex items-center gap-2 mb-3 border-b border-border-card pb-2">
          <TerminalSquare className="w-4 h-4 text-fore-muted" />
          <h3 className="text-[10px] font-semibold text-fore-muted uppercase tracking-widest">System Logs</h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col-reverse">
           <div className="flex flex-col justify-end min-h-full">
              {logs.map((log, i) => (
                <div key={i} className={cn("text-[10px] font-mono mb-1 leading-relaxed", log.includes('Error') || log.includes('Closed') ? "text-brand-red/90" : "text-brand-neon/70")}>
                  <span className="text-fore-muted/40 mr-2">{'>'}</span>{log}
                </div>
              ))}
           </div>
        </div>
      </div>

    </div>
  );
}
