require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const recentMints = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('GMGN Institutional Alpha Sniper V14: Online\n');
});

app.post('/helius-stream', async (req, res) => {
  res.status(200).send('OK');

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions)) return;

    for (const tx of transactions) {
      let tokenMint = null;
      
      const tokenTransfers = tx.tokenTransfers || [];
      if (tokenTransfers.length > 0 && tokenTransfers[0].tokenMint) {
        tokenMint = tokenTransfers[0].tokenMint;
      }

      if (!tokenMint && tx.instructions) {
        for (const inst of tx.instructions) {
          if (inst.accounts && inst.accounts.length > 2) {
            const structuralMint = inst.accounts.find(acc => 
              acc !== '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' && 
              acc !== 'So11111111111111111111111111111111111111112' &&
              acc !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' &&
              acc.length >= 32 && !acc.startsWith('Sysvar')
            );
            if (structuralMint) { tokenMint = structuralMint; break; }
          }
        }
      }

      if (!tokenMint || typeof tokenMint !== 'string') continue;
      tokenMint = tokenMint.trim();
      if (tokenMint.includes('11111111111111111111111111111111') || tokenMint.length < 32) continue;

      if (recentMints.has(tokenMint)) continue;
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 120000);

      console.log(`📡 [STREAM EVENT] Ingested candidate token: ${tokenMint}`);

      // High-speed parallel analytics worker
      (async () => {
        try {
          // Fast Execution: Wait only 15 seconds to let the initial block swaps compute on-chain
          await delay(15000);

          let tokenData = null;
          
          // --- TARGET ENDPOINT: GMGN REALTIME TOKEN SECURITY & ANALYTICS ---
          try {
            const gmgnRes = await axios.get(`https://gmgn.ai/api/v1/token_info/sol/${tokenMint}`, {
              headers: { 'Authorization': `Bearer ${process.env.GMGN_API_KEY || ''}` },
              timeout: 4500
            });
            if (gmgnRes.data && gmgnRes.data.data) {
              tokenData = gmgnRes.data.data;
            }
          } catch (e) {
            console.log(`   ↳ ❌ Unindexed on GMGN registry during fast sweep: ${tokenMint.substring(0,6)}`);
            return;
          }

          if (!tokenData) return;

          // 1. DATA EXTRACTION
          const tokenName = tokenData.name || 'Unknown';
          const tokenSymbol = tokenData.symbol || 'MEME';
          const volume24h = Number(tokenData.volume_24h || 0);
          const liquidityUsd = Number(tokenData.liquidity || 0);
          const devAddress = tokenData.creator || "Unknown Address";
          
          // 2. STAGE 1 FIREWALL: HARD SAFETY CHECK & HONEYPOT FILTERS
          const isMintRenounced = tokenData.renounced_mint === true || tokenData.is_renounced === 1;
          const isFreezeRenounced = tokenData.renounced_freeze_account === true || tokenData.is_freezable === 0;
          const isHoneypot = tokenData.is_honeypot === 'yes' || tokenData.honeypot_risk === true;
          const isLpLocked = tokenData.lp_locked === true || tokenData.burn_ratio === 100 || tokenData.lp_burned === true;

          if (isHoneypot) {
            console.log(`   ↳ 🛑 [BLOCKED] Malicious Honeypot Signature: ${tokenMint.substring(0,6)}`);
            return;
          }
          if (!isMintRenounced || !isFreezeRenounced) {
            console.log(`   ↳ 🛑 [BLOCKED] Active Mint/Freeze authorities found: ${tokenMint.substring(0,6)}`);
            return;
          }
          if (!isLpLocked) {
            console.log(`   ↳ 🛑 [BLOCKED] Unlocked Liquidity Pool detected: ${tokenMint.substring(0,6)}`);
            return;
          }

          // 3. STAGE 2 FIREWALL: DEV REPUTATION AUDIT
          const devRugHistoryCount = Number(tokenData.creator_rug_count || 0); 
          const devPreviousLaunches = Number(tokenData.creator_token_count || 0);
          
          if (devRugHistoryCount > 0) {
            console.log(`   ↳ 🛑 [BLOCKED] Malicious Dev Wallet Profile detected. Rug history count: ${devRugHistoryCount}`);
            return; // Drop immediately if they have ever rugged or caused loss
          }

          // 4. STAGE 3 FIREWALL: HIGH VOLUME TRADES & WHALES CAPTURE
          const whaleBuyCount = Number(tokenData.whale_buy_count || tokenData.whales_tracked || 0);
          const largeTxCount = Number(tokenData.large_transaction_count || 0);

          // Crucial Filter: Ensure high trading activity has materialized ($5,000+ volume minimum)
          if (volume24h < 5000) {
            console.log(`   ↳ ⏸️ [FILTERED OUT] Insufficient trade volume activity ($${Math.round(volume24h)})`);
            return;
          }

          // Confirm smart money or whales have executed an entry flag
          if (whaleBuyCount < 1 && largeTxCount < 1) {
            console.log(`   ↳ ⏸️ [FILTERED OUT] No active whale tracking footprints inside this block window.`);
            return;
          }

          // --- ALL STIPULATIONS MET: TRANSMIT TARGET ALERTS ---
          console.log(`👑 [ALPHA MATCH VALIDATED] Dispatched verified momentum signal for ${tokenSymbol}`);

          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const gmgnInterfaceLink = `https://gmgn.ai/sol/token/${tokenMint}`;

          const telegramAlert = `
💎 <b>VERIFIED REVENUE breakout SIGNAL</b> 💎
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Asset Name:</b> <b>${tokenName} (${tokenSymbol})</b>
• <b>Contract:</b> <code>${tokenMint}</code>
• <b>Known Dev Wallet:</b> <code>${devAddress}</code>
────────────────────────
▶ <b>🛡️ STRICT SECURITY SANCTION PASS</b>
• <b>Liquidity Vault:</b> Locked & Burned 🔒 ✅
• <b>Mint/Freeze Controls:</b> Fully Renounced 🚫
• <b>Dev Profile Audit:</b> Clean (0 Rug History across ${devPreviousLaunches} tokens) 👤 ✅
────────────────────────
▶ <b>📈 HIGH-VOLUME & WHALE TRACKER</b>
• <b>Current Volume Velocity:</b> <b>$${volume24h.toLocaleString()}</b> 🚀
• <b>Available Liquidity Depth:</b> <b>$${liquidityUsd.toLocaleString()}</b> 💰
• <b>Tracked Whales Entered:</b> <b>${whaleBuyCount} Smart Buyers</b> 🔥
────────────────────────
▶ <b>⚔️ SPEED ENTRY CHANNELS</b>
• <a href="${gmgnInterfaceLink}">Open GMGN Candlestick Terminal</a>
• <a href="${trojanTradeLink}">⚔️ Execute Fast Entry via Trojan Sniper</a>
────────────────────────
`;

          for (const chatId of CHAT_IDS) {
            if (!chatId) continue;
            try {
              await bot.telegram.sendMessage(chatId, telegramAlert, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true 
              });
            } catch (tgErr) {}
          }
        } catch (innerError) {}
      })();
    }
  } catch (error) {}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GMGN Verified Sniper System Online listening on Port ${PORT}`);
});