'use client';

import { TopBar } from "@/components/TopBar";
import { MainDisplay } from "@/components/MainDisplay";
import { TelemetryPanel } from "@/components/TelemetryPanel";
import { TradePanel } from "@/components/TradePanel";
import { useLlmTrader } from "@/hooks/useLlmTrader";
import { useDerivAccount } from "@/hooks/useDerivAccount";
import { useEffect, useRef, useState } from "react";
import { executeSMCContract, testDerivConnection, forceTestTrade } from "@/lib/derivTrade";

export default function Home() {
  const [timeframe, setTimeframe] = useState('5m');
  
  // Validate timeframe
  const validTimeframes = ['1m', '2m', '5m', '15m', '30m', '60m'];
  const safeTimeframe = validTimeframes.includes(timeframe) ? timeframe : '5m';

  const inference = useLlmTrader(safeTimeframe);
  const [userSettings, setUserSettings] = useState({ token: '', symbol: 'OTC_NDX' });
  const deriv = useDerivAccount(userSettings.token, userSettings.symbol);
  
  const lastSignalTime = useRef<number>(0);

  // --- Profitability & Risk Logic ---
  const nyNow = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyToday = nyNow.split(',')[0];
  
  const dailyLosses = deriv.tradeHistory.filter(t => {
    const sellMs = t.sell_time ? Number(t.sell_time) * 1000 : 0;
    if (!sellMs) return false;
    const sellDate = new Date(sellMs).toLocaleString("en-US", { timeZone: "America/New_York" }).split(',')[0];
    const profit = Number(t.profit ?? (t.sell_price != null ? t.sell_price - (t.buy_price || t.purchase_price) : 0));
    return sellDate === nyToday && profit < 0;
  }).length;

  const systemLocked = dailyLosses >= 2;
  const isWaitingForSession = inference.bias === 'WAITING FOR SESSION';

  // Load initial settings
  useEffect(() => {
    const saved = localStorage.getItem('hft_settings');
    let isAutoTrade = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserSettings(parsed);
        if (parsed.autoTrade) isAutoTrade = true;
      } catch (e) {}
    }
    
    // Final Guardrail Log
    setTimeout(() => {
      inference.addLog(`[System] Maintenance complete. Returning to NAS100 SMC Strategy. Auto-Execution is ${isAutoTrade ? 'ARMED' : 'DISABLED'}.`);
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Handshake logs to UI
  useEffect(() => {
    if (deriv.status === 'CONNECTED') {
       inference.addLog(`[Deriv] Authenticated: Welcome to the System`);
    } else if (deriv.status === 'ERROR') {
       inference.addLog(`[Deriv] AUTH ERROR: ${deriv.errorMsg}`);
    }
  }, [deriv.status, deriv.errorMsg]);

  // Automation Trigger
  useEffect(() => {
    // 1. Safety Lock: Ensure no duplicate trades, no system lock, and session is valid
    const hasActiveTrade = deriv.activeTrades && deriv.activeTrades.length > 0;
    
    if (systemLocked) return; // Prevent any trade if locked
    if (isWaitingForSession) return; // Prevent any trade if outside session

    // 2. Conviction Threshold: Check if setup is valid and confidence is high enough
    if (inference.validSetup && inference.confidence >= 65 && !hasActiveTrade) {
      const now = Date.now();
      // Rate limiting: wait 2 minutes between signal attempts
      if (now - lastSignalTime.current < 120000) return;

      const saved = localStorage.getItem('hft_settings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          if (settings.autoTrade && settings.token) {
            lastSignalTime.current = now;
            const signalType = inference.signal === 'BUY' ? 'BUY' : 'SELL';
            
            inference.addLog(`[Executioner] AUTO-TRIGGER: ${signalType} at ${inference.confidence}% confidence.`);
            
            executeSMCContract(
              signalType as 'BUY'|'SELL', 
              settings, 
              inference.currentPrice || 0,
              inference.candles?.[inference.candles.length - 1]?.low || 0,
              (msg) => {
                inference.addLog(msg);
                // Refresh portfolio if trade succeeds
                if (msg.includes('ACCEPTED') || msg.includes('ORDER PLACED')) {
                  deriv.refreshPortfolio();
                }
              }
            );
          }
        } catch (e) {
          console.error("Automation error", e);
        }
      }
    }
  }, [inference.validSetup, inference.signal, inference.confidence, inference.currentPrice, inference.candles, deriv.activeTrades, systemLocked, isWaitingForSession]);

  return (
    <main className="min-h-screen max-h-screen flex flex-col bg-back-base text-fore-base overflow-hidden font-sans">
      {/* Top Navigation */}
      <div className="flex-none z-50 relative">
        <TopBar 
          price={inference.currentPrice} 
          balance={deriv.balance}
          status={deriv.status}
          errorMsg={deriv.errorMsg}
          onCommit={(token) => {
             const saved = localStorage.getItem('hft_settings');
             if (saved) setUserSettings(JSON.parse(saved));
             testDerivConnection(token, (msg) => inference.addLog(msg));
             deriv.reconnect(token);
          }}
        />
        {systemLocked && (
          <div className="absolute top-[80px] left-1/2 -translate-x-1/2 bg-brand-red text-fore-base px-6 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(239,68,68,0.5)] z-[100]">
             SYSTEM LOCKED - DAILY DRAWDOWN HIT ({dailyLosses}/2 Losses)
          </div>
        )}
        {isWaitingForSession && !systemLocked && (
          <div className="absolute top-[80px] left-1/2 -translate-x-1/2 bg-fore-muted/20 text-fore-muted px-6 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase border border-fore-muted/30 z-[100]">
             WAITING FOR NEW YORK SESSION (9:30 AM EST)
          </div>
        )}
        {inference.validSetup && !systemLocked && !isWaitingForSession && (
          <div className="absolute top-[80px] left-1/2 -translate-x-1/2 bg-brand-neon text-back-base px-6 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(34,211,238,0.5)] animate-bounce z-[100]">
             Valid Setup Detected - Executing SMC Sequence
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 flex gap-6 overflow-hidden">
        
        {/* Left/Center: Main Chart & History */}
        <section className="flex-1 flex flex-col gap-6 h-full min-w-0">
          <div className="flex-[2] min-h-0">
             <MainDisplay 
                candles={inference.candles} 
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                className="h-full" 
             />
          </div>
          <div className="flex-1 min-h-0">
             <TradePanel 
                activeTrades={deriv.activeTrades} 
                tradeHistory={deriv.tradeHistory} 
                className="h-full" 
             />
          </div>
        </section>

        {/* Right: Telemetry Panel */}
        <aside className="w-80 flex-none h-full overflow-y-auto pr-2 custom-scrollbar">
          <TelemetryPanel 
             bias={inference.bias} 
             signal={inference.signal} 
             confidence={inference.confidence} 
             reasoning={inference.reasoning}
             logs={inference.logs}
          />
          
          <div className="mt-4 p-4 rounded-xl border border-border-card bg-back-panel/40 space-y-3 shadow-inner">
             <h3 className="text-[10px] uppercase tracking-widest text-fore-muted font-bold">Metrics Breakdown</h3>
             <div className="flex justify-between items-center text-xs">
                <span className="text-fore-muted font-mono">LIQ SWEEP</span>
                <span className={inference.isLiquiditySweep ? "text-brand-neon font-bold" : "text-fore-muted/30"}>
                   {inference.isLiquiditySweep ? "DETECTED" : "NULL"}
                </span>
             </div>
             <div className="flex justify-between items-center text-xs">
                <span className="text-fore-muted font-mono">CHoCH</span>
                <span className={inference.hasCHoCH ? "text-brand-neon font-bold" : "text-fore-muted/30"}>
                   {inference.hasCHoCH ? "BREAK" : "NULL"}
                </span>
             </div>
          </div>
        </aside>

      </div>
    </main>
  );
}


