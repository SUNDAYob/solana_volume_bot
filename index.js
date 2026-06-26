require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const recentMints = new Set();

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('⚡ GMGN Ultra-Fast Alpha Sniper (Fresh Wallets Allowed): Online\n');
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
      setTimeout(() => recentMints.delete(tokenMint), 60000); 

      // Immediate Parallel Processing
      (async () => {
        try {
          let tokenData = null;
          
          // Pull Realtime Stats from GMGN
          try {
            const gmgnRes = await axios.get(`https://gmgn.ai/api/v1/token_info/sol/${tokenMint}`, {
              headers: { 'Authorization': `Bearer ${process.env.GMGN_API_KEY || ''}` },
              timeout: 3000 
            });
            if (gmgnRes.data && gmgnRes.data.data) {
              tokenData = gmgnRes.data.data;
            }
          } catch (e) {
            return; 
          }

          if (!tokenData) return;

          // --- RULE 1: STRICT SECURITY CHECK ---
          const devRugHistoryCount = Number(tokenData.creator_rug_count || 0);
          const isHoneypot = tokenData.is_honeypot === 'yes' || tokenData.honeypot_risk === true;
          const isLpLocked = tokenData.lp_locked === true || tokenData.burn_ratio === 100 || tokenData.lp_burned === true;
          const isMintRenounced = tokenData.renounced_mint === true || tokenData.is_renounced === 1;

          if (devRugHistoryCount > 0) return; // ❌ Absolute Drop: Scammer history detected
          if (isHoneypot || !isMintRenounced) return; // ❌ Absolute Drop: Vulnerable / Mintable contract
          if (!isLpLocked) return; // ❌ Absolute Drop: Dev can pull the rug floor 🔒

          // --- RULE 2: WALLET PROFILE AGNOSTIC (Allows Fresh Deployers) ---
          const devAddress = tokenData.creator || "Unknown";
          const totalDevLaunches = Number(tokenData.creator_token_count || 0);
          
          // NOTE: We no longer drop if totalDevLaunches is 0. Fresh wallets are greenlit!

          // --- RULE 3: HIGH VOLUME VELOCITY ---
          const volume24h = Number(tokenData.volume_24h || 0);
          if (volume24h < 15000) return; // 🔥 Keeps notifications lightning fast by targeting real volume momentum

          // --- RULE 4: TRACK WHALES FOOTPRINT ---
          const whaleBuyCount = Number(tokenData.whale_buy_count || tokenData.whales_tracked || 0);
          const largeTxCount = Number(tokenData.large_transaction_count || 0);
          if (whaleBuyCount < 1 && largeTxCount < 1) return; // 🐋 Must have early smart money backing

          // ✨ CONDITIONS SECURED -> FORWARD DISPATCH
          const tokenName = tokenData.name || 'Alpha Token';
          const tokenSymbol = tokenData.symbol || 'ALPH';
          const liquidityUsd = Number(tokenData.liquidity || 0);

          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const gmgnInterfaceLink = `https://gmgn.ai/sol/token/${tokenMint}`;

          const telegramAlert = `
🚨 <b>FAST ALPHAS SNIPER MATCH</b> 🚨
────────────────────────
▶ <b>TOKEN PROFILE</b>
• <b>Asset:</b> <b>${tokenName} (${tokenSymbol})</b>
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>🛡️ 1. SECURITY STATUS: PASS</b>
• <b>Dev Rug History:</b> 0 Rugs Found (Clean) 👤 ✅
• <b>Honeypot Threat:</b> Defended (Mint Renounced) 🚫
• <b>Liquidity Pool:</b> Locked / Burned 🔒 ✅
────────────────────────
▶ <b>👤 2. DEVELOPER FOOTPRINT</b>
• <b>Dev Address:</b> <code>${devAddress}</code>
• <b>Profile Status:</b> ${totalDevLaunches === 0 ? '🆕 Brand New Wallet' : `💼 Established (${totalDevLaunches} Launches)`}
────────────────────────
▶ <b>📈 3 & 4. VOLOCITY & WHALE METRICS</b>
• <b>Trade Volume Depth:</b> <code>$${volume24h.toLocaleString()}</code> 🚀
• <b>Total Pool Liquidity:</b> <code>$${liquidityUsd.toLocaleString()}</code>
• <b>Tracked Whales Buying:</b> <b>${whaleBuyCount} Whales Active</b> 🐋 🔥
────────────────────────
▶ <b>⚔️ SPEED BUY LINKS</b>
• <a href="${gmgnInterfaceLink}">GMGN Candlestick Chart</a>
• <a href="${trojanTradeLink}">⚔️ Sniper Instant Entry via Trojan Bot</a>
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
  console.log(`🚀 Lightning Sniper V15 (All-Wallet Core) Listening on Port ${PORT}`);
});