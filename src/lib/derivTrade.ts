/**
 * Deriv Execution Engine — Multiplier Contract Mode
 * Opens MULTUP/MULTDOWN contracts on the Options/Multipliers wallet.
 */

export interface TradeSettings {
  token: string;
  symbol: string;
  lotSize: number;
  autoTrade: boolean;
}

export function forceTestTrade(
  token: string,
  symbol: string,
  price: number,
  stake: number,
  appendLog: (msg: string) => void,
  onSuccess?: () => void
) {
  if (!token) { appendLog('[TEST] ERROR: No token configured.'); return; }

  const stopLoss   = parseFloat((price - 50).toFixed(2));
  const takeProfit = parseFloat((price + 100).toFixed(2));

  appendLog(`[TEST] Forcing MULTUP on ${symbol} @ $${price.toFixed(2)}`);
  appendLog(`[TEST] SL: $${stopLoss} | TP: $${takeProfit} | Stake: $${stake} | Mult: x40`);

  const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

  ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));

  ws.onmessage = (msg) => {
    const res = JSON.parse(msg.data);
    
    // Log the full raw Deriv response
    appendLog(`[Deriv RAW] ${JSON.stringify(res)}`);
    console.log('[Deriv RAW Response]', res);

    if (res.error) {
      appendLog(`[TEST] REJECTED: ${res.error.message} (${res.error.code})`);
      ws.close();
      return;
    }

    if (res.msg_type === 'authorize') {
      // Step 1: Fetch ALL available symbols (no product_type filter to avoid rejection)
      appendLog('[TEST] Querying Deriv for available symbols...');
      ws.send(JSON.stringify({ active_symbols: 'brief' }));
    }

    if (res.msg_type === 'active_symbols') {
      const allSymbols: any[] = res.active_symbols || [];
      console.log('[Deriv] Full active_symbols list:', allSymbols);

      // Log EVERY indices symbol so user can find the correct NAS100 name
      const indices = allSymbols.filter((s: any) => s.market === 'indices');
      appendLog(`[Deriv] ${allSymbols.length} total symbols | ${indices.length} in "indices" market:`);
      indices.forEach((s: any) => {
        appendLog(`  ${s.symbol}  →  "${s.display_name}"  [${s.submarket_display_name}]`);
      });

      // Step 2: Send the actual trade now that we have the symbol info
      const payload = {
        buy: 1,
        price: stake,
        parameters: {
          amount:        stake,
          basis:         'stake',
          contract_type: 'MULTUP',
          currency:      'USD',
          multiplier:    40,
          symbol,
        }
      };
      appendLog(`[TEST] Sending trade payload: ${JSON.stringify(payload.parameters)}`);
      ws.send(JSON.stringify(payload));
    }

    if (res.msg_type === 'buy') {
      appendLog(`[TEST] ✓ ACCEPTED — Contract #${res.buy.contract_id}`);
      appendLog(`[TEST] ${res.buy.longcode}`);
      ws.close();
      // Trigger portfolio refresh after 1 second
      setTimeout(() => onSuccess?.(), 1000);
    }
  };

  ws.onerror = () => appendLog('[TEST] CONNECTION ERROR');
}

export async function executeSMCContract(
  signal: 'BUY' | 'SELL', 
  settings: TradeSettings, 
  price: number,
  sweepLow: number,
  appendLog: (msg: string) => void
) {
  if (!settings.token || !settings.autoTrade) return;

  appendLog(`[Executioner] SMC Signal received: ${signal} on ${settings.symbol} @ $${price.toFixed(2)}`);

  const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

  ws.onopen = () => {
    ws.send(JSON.stringify({ authorize: settings.token }));
  };

  ws.onmessage = (msg) => {
    const response = JSON.parse(msg.data);

    if (response.error) {
      appendLog(`[Deriv] ERROR: ${response.error.message} (code: ${response.error.code})`);
      ws.close();
      return;
    }

    if (response.msg_type === 'authorize') {
      appendLog('[Deriv] Connection Verified: Account Active');
      appendLog('[Deriv] Bot is ARMED and awaiting valid SMC Setup to execute.');
      
      const isBuy = signal === 'BUY';
      
      // SL is the exact sweep candle low
      // TP = Entry + (2 × Risk) for 1:2 RR
      const risk        = Math.abs(price - sweepLow) || 10;
      const stopLoss    = isBuy ? sweepLow            : price + risk;
      const takeProfit  = isBuy ? price + (risk * 2)  : price - (risk * 2);

      const payload = {
        buy: 1,
        price: settings.lotSize,
        parameters: {
          amount:        settings.lotSize,
          basis:         'stake',
          contract_type: isBuy ? 'MULTUP' : 'MULTDOWN',
          currency:      'USD',
          multiplier:    100,
          symbol:        settings.symbol,
          limit_order: {
            stop_loss:   parseFloat(stopLoss.toFixed(2)),
            take_profit: parseFloat(takeProfit.toFixed(2)),
          }
        }
      };

      // Log the full payload so it's visible in System Logs for verification
      appendLog(`[Deriv] Sending payload: ${JSON.stringify(payload)}`);
      console.log('[Deriv] Full trade payload:', payload);

      ws.send(JSON.stringify(payload));
    }

    if (response.msg_type === 'buy') {
      const { contract_id, longcode } = response.buy;
      appendLog(`[Deriv] ✓ ORDER PLACED: #${contract_id}`);
      appendLog(`[Deriv] Contract: ${longcode}`);
      ws.close();
    }
  };

  ws.onerror = (err: any) => {
    appendLog('[Deriv] CONNECTION ERROR: Socket failed. Check internet/token.');
    console.error(err);
  };
}

/**
 * Modifies an existing contract's Stop Loss (e.g., for Trailing SL / Breakeven)
 */
export async function updateContractStopLoss(
  token: string,
  contractId: number,
  newStopLoss: number,
  currentTakeProfit: number,
  appendLog: (msg: string) => void
) {
  const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

  ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));

  ws.onmessage = (msg) => {
    const res = JSON.parse(msg.data);
    
    if (res.error) {
      appendLog(`[Deriv] SL Update Error: ${res.error.message}`);
      ws.close();
      return;
    }

    if (res.msg_type === 'authorize') {
      ws.send(JSON.stringify({
        contract_update: 1,
        contract_id: contractId,
        limit_order: {
          stop_loss: parseFloat(newStopLoss.toFixed(2)),
          take_profit: parseFloat(currentTakeProfit.toFixed(2))
        }
      }));
    }

    if (res.msg_type === 'contract_update') {
      appendLog(`[Free Ride] ✓ SL moved to Breakeven ($${newStopLoss.toFixed(2)}) for #${contractId}`);
      ws.close();
    }
  };

  ws.onerror = () => appendLog('[Deriv] SL Update Failed: Connection Error');
}

/**
 * Standalone auth test — used by Settings panel "Commit Changes" button
 */
export function testDerivConnection(token: string, appendLog: (msg: string) => void) {
  const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

  ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));

  ws.onmessage = (msg) => {
    const res = JSON.parse(msg.data);
    if (res.error) {
      appendLog(`[Deriv] AUTH ERROR: ${res.error.message}`);
    } else if (res.msg_type === 'authorize') {
      appendLog(`[Deriv] Authenticated: Welcome, ${res.authorize.email} (${res.authorize.loginid})`);
      appendLog('[Deriv] Bot is ARMED and awaiting valid SMC Setup to execute.');
    }
    ws.close();
  };

  ws.onerror = () => appendLog('[Deriv] AUTH ERROR: Connection Refused');
}
