'use client';

import { useState } from 'react';
import { cn } from "@/lib/utils";
import { History, LayoutGrid, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface TradePanelProps {
  activeTrades: any[];
  tradeHistory: any[];
  className?: string;
}

export function TradePanel({ activeTrades, tradeHistory, className }: TradePanelProps) {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  return (
    <div className={cn("flex flex-col rounded-xl border border-border-card bg-back-card overflow-hidden shadow-2xl", className)}>
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-back-panel/40 border-b border-border-card">
        <button 
          onClick={() => setActiveTab('ACTIVE')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all",
            activeTab === 'ACTIVE' ? "bg-brand-neon/10 text-brand-neon" : "text-fore-muted hover:text-fore-base"
          )}
        >
          <Clock className="w-3 h-3" /> Active Trades
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all",
            activeTab === 'HISTORY' ? "bg-brand-neon/10 text-brand-neon" : "text-fore-muted hover:text-fore-base"
          )}
        >
          <History className="w-3 h-3" /> Trade History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-back-panel/20 via-transparent to-transparent">
        {activeTab === 'ACTIVE' ? (
          <div className="space-y-2">
            {activeTrades.length === 0 ? (
              <div className="h-24 flex flex-col items-center justify-center text-fore-muted/30 border border-dashed border-border-card rounded-lg">
                <LayoutGrid className="w-5 h-5 mb-2" />
                <span className="text-[10px] uppercase tracking-tighter">No Active Positions</span>
              </div>
            ) : (
              activeTrades.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-back-base/50 border border-border-card hover:border-brand-neon/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-1.5 rounded-md", t.contract_type === 'CALL' ? "bg-brand-green/10 text-brand-green" : "bg-brand-red/10 text-brand-red")}>
                      {t.contract_type === 'CALL' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-fore-base uppercase">{t.symbol || '---'} :: {t.contract_id || '---'}</div>
                      <div className="text-[8px] text-fore-muted font-mono">
                        {t.date_start ? new Date(Number(t.date_start) * 1000).toLocaleTimeString() : '--:--'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-brand-neon font-bold">
                      ${(Number(t.buy_price) || 0).toFixed(2)}
                    </div>
                    <div className="text-[8px] text-fore-muted uppercase">Stake</div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tradeHistory.length === 0 ? (
              <div className="h-24 flex flex-col items-center justify-center text-fore-muted/30 border border-dashed border-border-card rounded-lg">
                <History className="w-5 h-5 mb-2" />
                <span className="text-[10px] uppercase tracking-tighter">History Empty</span>
              </div>
            ) : (
              tradeHistory.map((t, i) => {
                // Deriv profit_table uses purchase_price / sell_price or buy_price — handle all cases
                const stake   = Number(t.buy_price ?? t.purchase_price) || 0;
                const profit  = Number(t.profit ?? (t.sell_price != null ? t.sell_price - stake : 0));
                const sellMs  = t.sell_time ? Number(t.sell_time) * 1000 : Date.now();
                return (
                  <div key={i} className="grid grid-cols-4 items-center p-3 rounded-lg bg-back-base/30 border border-border-card text-[10px]">
                     <div className="flex flex-col col-span-2">
                        <span className="text-fore-muted font-bold uppercase truncate">{t.longcode || t.short_code || 'T-ORDER'}</span>
                        <span className="text-[8px] font-mono opacity-50">{new Date(sellMs).toLocaleDateString()}</span>
                     </div>
                     <div className="font-mono text-center">${stake.toFixed(2)}</div>
                     <div className={cn("font-mono text-right font-bold", profit > 0 ? "text-brand-green" : "text-brand-red")}>
                        {profit > 0 ? '+' : ''}{profit.toFixed(2)}
                     </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
