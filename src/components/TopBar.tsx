'use client';

import { Activity, Bell, Settings, Terminal, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface TopBarProps {
  price?: number | null;
  balance?: number;
  status?: string;
  errorMsg?: string;
  className?: string;
  onCommit?: (token: string) => void;
}

export function TopBar({ price, balance = 0, status, errorMsg, onCommit, className }: TopBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [settings, setSettings] = useState({
    token: '',
    symbol: 'OTCIXNDX',
    lotSize: 0.1,
    autoTrade: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('hft_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);
  
  useEffect(() => {
    if (price) {
      setLastUpdate(Date.now());
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(t);
    }
  }, [price]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdate) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  const saveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('hft_settings', JSON.stringify(newSettings));
  };

  const handleCommit = () => {
    saveSettings(settings);
    if (onCommit && settings.token) {
      onCommit(settings.token);
    }
    setIsOpen(false);
  };

  return (
    <header className={cn("relative flex items-center justify-between px-6 py-4 border-b border-border-card bg-back-panel/50 backdrop-blur-md", className)}>
      <div className="flex items-center gap-3">
        <Terminal className="w-5 h-5 text-brand-neon" />
        <h1 className="text-xl font-bold tracking-widest text-fore-base">
          AI<span className="text-brand-neon">/</span>HFT
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-back-base px-4 py-2 rounded-md border border-border-card shadow-inner relative overflow-hidden">
          <div className={cn(
            "absolute top-0 left-0 w-1 h-full bg-brand-green transition-opacity duration-300",
            pulse ? "opacity-100" : "opacity-0"
          )}></div>
          <Activity className={cn("w-4 h-4 transition-colors", pulse ? "text-brand-green" : "text-brand-red opacity-40")} />
          <div className="flex flex-col">
            <span className="font-mono text-[10px] tracking-wider text-brand-neon font-bold uppercase">
              NAS100: <span className="text-fore-base">{price ? `$${price.toFixed(2)}` : '$---'}</span>
            </span>
            <span className="text-[8px] text-fore-muted/60 font-mono uppercase tracking-tighter">
              Updated: {secondsAgo}s ago
            </span>
          </div>
          {pulse && <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-ping absolute right-2"></div>}
        </div>
        
        <div className="flex items-center gap-2 bg-back-base px-4 py-2 rounded-md border border-border-card shadow-inner">
          <span className="text-[10px] text-fore-muted font-bold uppercase tracking-tighter">Balance:</span>
          <span className="font-mono text-xs text-brand-green font-bold">
            ${balance.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {status === 'ERROR' && (
          <div className="text-[10px] text-brand-red font-bold animate-pulse px-3 py-1 bg-brand-red/10 border border-brand-red/20 rounded truncate max-w-40">
            {errorMsg}
          </div>
        )}
        <button className="p-2 rounded-full hover:bg-back-card transition-colors text-fore-muted hover:text-fore-base">
          <Bell className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={cn("p-2 rounded-full transition-colors text-fore-muted hover:text-fore-base", isOpen && "bg-brand-neon/10 text-brand-neon")}
        >
          <Settings className={cn("w-5 h-5", isOpen && "animate-spin-slow")} />
        </button>
      </div>

      {/* Settings Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-6 mt-2 w-80 bg-back-panel border border-border-card rounded-xl shadow-2xl z-[60] p-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold tracking-widest text-fore-base uppercase">Terminal Config</h3>
            <button onClick={() => setIsOpen(false)} className="text-fore-muted hover:text-fore-base">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-[10px] uppercase tracking-tighter text-fore-muted font-bold">Deriv API Token</label>
                <span className={cn("text-[9px] font-bold uppercase", 
                  status === 'CONNECTED' ? "text-brand-green" : 
                  status === 'AUTH' ? "text-brand-neon animate-pulse" : "text-fore-muted"
                )}>
                  {status === 'CONNECTED' ? '● Verified' : status === 'AUTH' ? 'Authenticating...' : 'Disconnected'}
                </span>
              </div>
              <input 
                type="password"
                value={settings.token}
                onChange={(e) => setSettings({...settings, token: e.target.value})}
                placeholder="Paste Token..."
                className="w-full bg-back-base border border-border-card rounded px-3 py-2 text-xs font-mono text-brand-neon focus:outline-none focus:border-brand-neon/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-tighter text-fore-muted mb-1 font-bold">Symbol</label>
                <input 
                  type="text"
                  value={settings.symbol}
                  onChange={(e) => setSettings({...settings, symbol: e.target.value})}
                  className="w-full bg-back-base border border-border-card rounded px-3 py-2 text-xs font-mono text-fore-base focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-tighter text-fore-muted mb-1 font-bold">Lot Size</label>
                <select 
                  value={settings.lotSize}
                  onChange={(e) => setSettings({...settings, lotSize: parseFloat(e.target.value)})}
                  className="w-full bg-back-base border border-border-card rounded px-3 py-2 text-xs font-mono text-fore-base focus:outline-none appearance-none"
                >
                  {[0.1, 0.5, 1.0, 2.0, 5.0].map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] uppercase tracking-tighter text-fore-muted font-bold">Executioner Mode (Auto)</span>
              <button 
                onClick={() => setSettings({...settings, autoTrade: !settings.autoTrade})}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors",
                  settings.autoTrade ? "bg-brand-neon" : "bg-back-base border border-border-card"
                )}
              >
                <div className={cn(
                  "absolute top-1 left-1 w-3 h-3 rounded-full transition-transform bg-white",
                  settings.autoTrade ? "translate-x-5" : "translate-x-0"
                )} />
              </button>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-border-card flex items-center justify-end gap-2">
             <button 
                onClick={handleCommit}
                className="flex items-center gap-2 bg-brand-neon text-back-base text-[10px] font-bold px-4 py-2 rounded hover:bg-brand-neon/80 transition-colors uppercase tracking-widest"
             >
               <Save className="w-3 h-3" /> Commit Changes
             </button>
          </div>
        </div>
      )}
    </header>
  );
}

