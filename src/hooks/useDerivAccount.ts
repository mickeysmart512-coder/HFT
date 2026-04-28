import { useState, useEffect, useCallback, useRef } from 'react';
import { updateContractStopLoss } from '../lib/derivTrade';

export interface DerivAccountData {
  balance: number;
  currency: string;
  loginid: string;
  activeTrades: any[];
  tradeHistory: any[];
  status: 'IDLE' | 'AUTH' | 'CONNECTED' | 'ERROR';
  errorMsg: string;
}

export function useDerivAccount(token: string | null, symbol: string) {
  const [data, setData] = useState<DerivAccountData>({
    balance: 0,
    currency: 'USD',
    loginid: '',
    activeTrades: [],
    tradeHistory: [],
    status: 'IDLE',
    errorMsg: ''
  });

  const wsRef = useRef<WebSocket | null>(null);
  const beTriggeredRef = useRef<Set<number>>(new Set());

  const connect = useCallback(async (manualToken?: string) => {
    const activeToken = manualToken || token;
    if (!activeToken) return;

    setData(prev => ({ ...prev, status: 'AUTH', errorMsg: '' }));

    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: activeToken }));
    };

    ws.onmessage = (msg) => {
      const res = JSON.parse(msg.data);

      if (res.error) {
        if (!res.error.code || res.error.code === 'AuthorizationRequired' || res.error.code === 'InvalidToken') {
          setData(prev => ({ ...prev, status: 'ERROR', errorMsg: res.error.message }));
          ws.close();
        } else {
          setData(prev => ({ ...prev, errorMsg: res.error.message }));
        }
        return;
      }

      if (res.msg_type === 'authorize') {
        setData(prev => ({ 
          ...prev, 
          status: 'CONNECTED', 
          loginid: res.authorize.loginid,
          balance: res.authorize.balance,
          currency: res.authorize.currency
        }));

        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        ws.send(JSON.stringify({ portfolio: 1 }));
        ws.send(JSON.stringify({ profit_table: 1 }));
        // Subscribe to all open contract updates
        ws.send(JSON.stringify({ proposal_open_contract: 1, subscribe: 1 }));
      }

      if (res.msg_type === 'balance') {
        setData(prev => ({ ...prev, balance: res.balance.balance }));
      }

      if (res.msg_type === 'portfolio') {
        setData(prev => ({ ...prev, activeTrades: res.portfolio.contracts || [] }));
      }

      if (res.msg_type === 'profit_table') {
        setData(prev => ({ ...prev, tradeHistory: res.profit_table.transactions || [] }));
      }

      if (res.msg_type === 'proposal_open_contract') {
        const contract = res.proposal_open_contract;
        if (!contract) return;

        // Update active trades list with latest contract data
        setData(prev => {
          const others = prev.activeTrades.filter(t => t.contract_id !== contract.contract_id);
          // If contract is closed, don't re-add it
          if (contract.is_sold) return { ...prev, activeTrades: others };
          return { ...prev, activeTrades: [contract, ...others] };
        });

        // --- 'FREE RIDE' Logic (Trailing SL to BE at 1:1 RR) ---
        if (!contract.is_sold && contract.contract_id && !beTriggeredRef.current.has(contract.contract_id)) {
          const entry = Number(contract.entry_tick);
          const current = Number(contract.current_spot);
          const initialSL = Number(contract.limit_order?.stop_loss?.order_amount || contract.limit_order?.stop_loss);
          const currentTP = Number(contract.limit_order?.take_profit?.order_amount || contract.limit_order?.take_profit);
          
          if (entry && current && initialSL) {
            const isBuy = contract.contract_type === 'MULTUP';
            const risk = Math.abs(entry - initialSL);
            
            // Check if we are already at BE (to prevent re-triggering if ref reset)
            const isAlreadyBE = isBuy ? (initialSL >= entry) : (initialSL <= entry);

            if (!isAlreadyBE && risk > 0) {
              const profitPoints = isBuy ? (current - entry) : (entry - current);
              
              // 1:1 RR Hit?
              if (profitPoints >= risk) {
                beTriggeredRef.current.add(contract.contract_id);
                
                // Buffer: 1 pip (Assuming 1.0 point for NAS100)
                const buffer = 1.0;
                const newSL = isBuy ? (entry + buffer) : (entry - buffer);
                
                console.log(`[Free Ride] Triggered for #${contract.contract_id}. Moving SL to ${newSL}`);
                updateContractStopLoss(activeToken, contract.contract_id, newSL, currentTP, (m) => console.log(m));
              }
            }
          }
        }
      }
    };

    ws.onerror = () => {
      setData(prev => ({ ...prev, status: 'ERROR', errorMsg: 'Connection Refused' }));
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  useEffect(() => {
    if (token) connect();
  }, [token, connect]);

  return { 
    ...data, 
    reconnect: connect,
    refreshPortfolio: () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ portfolio: 1 }));
        wsRef.current.send(JSON.stringify({ profit_table: 1 }));
      }
    }
  };
}
