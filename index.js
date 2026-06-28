require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// ⚡ High-Performance Cache Memory Management to prevent leaks
const processedMints = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Force cache sweep every 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [mint, timestamp] of processedMints.entries()) {
    if (now - timestamp > 60000) processedMints.delete(mint);
  }
}, CLEANUP_INTERVAL);

app.use(express.json());

// Main health-check endpoint
app.get('/', (req, res) => res.status(200).send('🛡️ Quantum Guard Architecture Active\n'));

// Main Webhook Receiver Pipeline
app.post('/webhook', async (req, res) => {
  // CRITICAL RULE 1: Instantly acknowledge Helius to prevent webhook channel backup
  res.sendStatus(200); 

  try {
    const txs = req.body;
    if (!Array.isArray(txs) || txs.length === 0) return;

    for (const tx of txs) {
      // 🕵️ On-Chain Signatures (No string matches - pure transaction layout detection)
      const isNewLaunch = tx.instructions?.some(inst => inst.suggestedInstructionName === 'create');
      const isMigration = tx.type === 'CREATE_POOL' || 
                          tx.instructions?.some(inst => inst.programId === '6EF83uUk4936n7RWdqCw1LKUUY56CgdYSL5LWWTZ96K2'); // Pump.fun Program ID
      
      if (!isNewLaunch && !isMigration) continue;

      // Extract Token Mint Contract Address safely
      const tokenMint = tx.tokenTransfers?.[0]?.mint || tx.instructions?.[0]?.accounts?.[0];
      if (!tokenMint || tokenMint.length < 32 || processedMints.has(tokenMint)) continue;

      // Lock token into anti-spam state machine memory map
      processedMints.set(tokenMint, Date.now());

      const eventTag = isMigration ? "🚀 RAYDIUM GRADUATION" : "💊 PUMP.FUN NEW LAUNCH";
      const waitTime = isMigration ? 15000 : 45000; // On-chain metadata & GMGN engine baking cushions

      console.log(`[📡 TARGET CAPTURED] ${eventTag} | Queuing Security Assessment for: ${tokenMint}`);

      // Async isolated worker context - never clogs your main event loop
      (async () => {
        await new Promise(resolve => setTimeout(resolve, waitTime));

        let securityData = null;
        let tokenInfo = null;

        try {
          // Standard OpenAPI-compliant request config
          const config = {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'application/json'
            },
            timeout: 8000
          };

          // Synchronized API extraction
          const [secRes, infoRes] = await Promise.all([
            axios.get(`https://gmgn.ai/v1/token/security?chain=sol&address=${tokenMint}`, config).catch(() => null),
            axios.get(`https://gmgn.ai/v1/token/info?chain=sol&address=${tokenMint}`, config).catch(() => null)
          ]);

          if (secRes?.data?.data) securityData = secRes.data.data;
          if (infoRes?.data?.data) tokenInfo = infoRes.data.data;
        } catch (apiErr) {
          console.error(`[❌ API ERROR] Failed executing GMGN lookup for: ${tokenMint}`);
        }

        // Drop blind trades instantly if data layers are missing
        if (!securityData) {
          console.log(`[⚠️ SKIP] Security indexes not populated on GMGN yet for: ${tokenMint}`);
          return;
        }

        // 📊 Quantitative Metrics Mapping
        const rugCount = Number(securityData.creator_rug_count || securityData.dev_rug_count || 0);
        const top10Rate = parseFloat(securityData.top_10_holder_rate || 0) * 100;
        const devShare = parseFloat(securityData.dev_team_hold_rate || securityData.creator_balance_rate || 0) * 100;
        
        // Real Solana Hard-Fails (Critical parameters EVM scanners miss)
        const mintRenounced = securityData.renounced_mint === true || securityData.renounced_mint === 'yes'; 
        const freezeRenounced = securityData.renounced_freeze_account === true || securityData.renounced_freeze_account === 'yes'; 

        const symbol = tokenInfo?.symbol || 'UNKNOWN';
        const name = tokenInfo?.name || 'Unknown Token';

        // 🛡️ THE FOUR-GATE QUANT DEFENSIVE SYSTEM
        // 1. Blacklist Check: Instant termination for malicious creators with a history
        if (rugCount > 0) {
          console.log(`[🛑 BLOCKED] ${symbol} - Developer profile has prior rug records (Count: ${rugCount})`);
          return;
        }
        // 2. Authority Check: If dev can infinite-mint tokens or freeze your wallet, drop it!
        if (!mintRenounced || !freezeRenounced) {
          console.log(`[🛑 BLOCKED] ${symbol} - Authority Threat: Mint or Freeze permissions are NOT renounced.`);
          return;
        }
        // 3. Sniper Concentration Gate: Rejects insider/bundled traps (>65%)
        if (top10Rate > 65) {
          console.log(`[🛑 BLOCKED] ${symbol} - Extreme Sniper/Insider Concentration (Top 10: ${top10Rate.toFixed(1)}%)`);
          return;
        }
        // 4. Developer Allocation Gate: Rejects multi-wallet developer hidden supplies (>15%)
        if (devShare > 15) {
          console.log(`[🛑 BLOCKED] ${symbol} - Controlling Dev Allocations detected (Dev Share: ${devShare.toFixed(1)}%)`);
          return;
        }

        // 🎉 Validated Asset Passing All Structural Safety Protocols
        console.log(`[🟢 PASSED] ${symbol} cleared all security gates. Dispatching to Telegram...`);

        const alertMessage = `
<b>${eventTag}</b>
────────────────────────
• <b>Asset:</b> ${name} (${symbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>ON-CHAIN SECURITY AUDIT REPORT</b>
• <b>Mint Authority:</b> Renounced (Safe) ✅
• <b>Freeze Authority:</b> Renounced (Safe) ✅
• <b>Top 10 Concentration:</b> <code>${top10Rate.toFixed(1)}%</code>
• <b>Dev Control / Allocation:</b> <code>${devShare.toFixed(1)}%</code>
• <b>Dev Profile Track:</b> ${tokenInfo?.creator_token_count || 0} Created (0 Rugs)
────────────────────────
▶ <b>FAST-TRACK HIGH VELOCITY TERMINALS</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 GMGN Professional Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-cryptonigh-${tokenMint}">⚡ Sniping Execution (via Trojan Bot)</a>
`;

        for (const chatId of CHAT_IDS) {
          if (!chatId) continue;
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, { 
              parse_mode: 'HTML', 
              disable_web_page_preview: true 
            });
          } catch (tgErr) {
            console.error(`[❌ TG ERROR] Dispatch failed for Chat ID ${chatId}: ${tgErr.message}`);
          }
        }
      })();
    }
  } catch (err) {
    console.error(`[💥 ENGINE CRASH] Handled exception: ${err.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚙️ [SERVER READY] Professional Security Pipeline active on Port ${PORT}`);
});