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
  res.status(200).send('⚡ GMGN Ultra-Fast Alpha Sniper (Fresh Wallets Enabled): Online\n');
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

      // High-speed execution thread
      (async () => {
        try {
          let tokenData = null;
          
          // Request real-time intelligence directly from GMGN API
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

          // 🛡️ 1. SECURITY CHECKS (ZERO TOLERANCE)
          const devRugHistoryCount = Number(tokenData.creator_rug_count || 0);
          const isHoneypot = tokenData.is_honeypot === 'yes' || tokenData.honeypot_risk === true;
          const isLpLocked = tokenData.lp_locked === true || tokenData.burn_ratio === 100 || tokenData.lp_burned === true;
          const isMintRenounced = tokenData.renounced_mint === true || tokenData.is_renounced === 1;

          if (devRugHistoryCount > 0) return;          // ❌ DROP: Dev wallet has blacklisted scam record
          if (isHoneypot || !isMintRenounced) return;  // ❌ DROP: Contract is open to malicious alterations
          if (!isLpLocked) return;                     // ❌ DROP: Liquidity pool must be locked/burned 🔒

          // 💼 2. WALLET REPUTATION (AGNOSTIC)
          const devAddress = tokenData.creator || "Unknown";
          const totalDevLaunches = Number(tokenData.creator_token_count || 0);
          // Greenlit: We pass both 0-launch fresh wallets and clean veteran developers!

          // 📈 3. HIGH-VOLUME MOMENTUM METRICS
          const volume24h = Number(tokenData.volume_24h || 0);
          const volume5m = Number(tokenData.volume_5m || 0);
          
          // Use either 24h volume baseline or an immediate 5m breakout rush to capture ultra-fresh tokens fast
          if (volume24h < 15000 && volume5m < 3000) return; 

          // 🐋 4. WHALES & SMART MONEY FOOTPRINT
          const whaleBuyCount = Number(tokenData.whale_buy_count || tokenData.whales_tracked || 0);
          const largeTxCount = Number(tokenData.large_transaction_count || 0);
          if (whaleBuyCount < 1 && largeTxCount < 1) return; // ❌ DROP: Requires confirmed big buyers entering

          // 🎉 CRITERIA ACCOMPLISHED -> SEND FAST NOTIFICATION
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
▶ <b>🛡️ 1. SECURITY MATRIX: PASSED</b>
• <b>Dev Rug Record:</b> 0 Rugs Found (Clean) 👤 ✅
• <b>Honeypot Threat:</b> Safe (Mint Authority Renounced) 🚫
• <b>Liquidity Pool:</b> Locked or Burned 🔒 ✅
────────────────────────
▶ <b>👤 2. DEVELOPER INFRASTRUCTURE</b>
• <b>Dev Address:</b> <code>${devAddress}</code>
• <b>Profile Status:</b> ${totalDevLaunches === 0 ? '🆕 Fresh Wallet Approved' : `💼 Veteran (${totalDevLaunches} Launches)`}
────────────────────────
▶ <b>📈 3 & 4. VELOCITY & WHALE ACTIVITY</b>
• <b>Accumulated Volume:</b> <code>$${(volume24h || volume5m).toLocaleString()}</code> 🚀
• <b>Liquidity Depth:</b> <code>$${liquidityUsd.toLocaleString()}</code>
• <b>Whales Positioned:</b> <b>${whaleBuyCount} Whales In Block</b> 🐋 🔥
────────────────────────
▶ <b>⚔️ SPEED ENTRY CHANNELS</b>
• <a href="${gmgnInterfaceLink}">GMGN Candlestick Chart Terminal</a>
• <a href="${trojanTradeLink}">⚔️ Execute Fast Entry via Trojan Bot</a>
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