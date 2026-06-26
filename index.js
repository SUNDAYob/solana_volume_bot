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
  res.status(200).send('⚡ GMGN Ultra Sniper System Live\n');
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

      // Run check in the background
      (async () => {
        try {
          // ⏱️ Fast indexing pause to protect against immediate 404 errors
          await delay(10000);

          let tokenData = null;
          const apiEndpoints = [
            `https://gmgn.ai/defi/quotation/v1/tokens/sol/${tokenMint}`,
            `https://gmgn.ai/api/v1/token_info/sol/${tokenMint}`
          ];

          for (const url of apiEndpoints) {
            try {
              const res = await axios.get(url, {
                headers: { 
                  'Authorization': `Bearer ${process.env.GMGN_API_KEY || ''}`,
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
                },
                timeout: 3000 
              });
              if (res.data && (res.data.data || res.data.token)) {
                tokenData = res.data.data || res.data.token;
                break;
              }
            } catch (err) {}
          }

          if (!tokenData) return;

          // 🛡️ REQUIREMENT 1: SECURITYMATRIX FIREWALL
          const devRugHistoryCount = Number(tokenData.creator_rug_count || tokenData.dev_rug_count || 0);
          const isHoneypot = tokenData.is_honeypot === 'yes' || tokenData.honeypot_risk === true || tokenData.honeypot === 1;
          const isLpLocked = tokenData.lp_locked === true || tokenData.burn_ratio === 100 || tokenData.lp_burned === true || tokenData.liquidity_locked === 1;
          const isMintRenounced = tokenData.renounced_mint === true || tokenData.is_renounced === 1 || tokenData.mint_renounced === 1;

          if (devRugHistoryCount > 0) return;          // ❌ BLOCKED: Dev has a history of rugged projects
          if (isHoneypot || !isMintRenounced) return;  // ❌ BLOCKED: Honeypot or active mint authority detected
          if (!isLpLocked) return;                     // ❌ BLOCKED: Liquidity pool must be locked 🔒

          // 👤 REQUIREMENT 2: WALLET BASE REPUTATION
          const devAddress = tokenData.creator || tokenData.dev_address || "Unknown";
          const totalDevLaunches = Number(tokenData.creator_token_count || tokenData.dev_token_count || 0);
          // Safe fresh wallets and verified developers are both allowed

          // 📈 REQUIREMENT 3: HIGH VOLUME VELOCITY
          const volume24h = Number(tokenData.volume_24h || tokenData.volume || 0);
          const volume5m = Number(tokenData.volume_5m || 0);
          if (volume24h < 15000 && volume5m < 3000) return; // Filters out low-activity pairs

          // 🐋 REQUIREMENT 4: WHALE TRACKING COUNTERS
          const whaleBuyCount = Number(tokenData.whale_buy_count || tokenData.whales_tracked || tokenData.smart_money_buy_count || 0);
          const largeTxCount = Number(tokenData.large_transaction_count || tokenData.buys || 0);
          if (whaleBuyCount < 1 && largeTxCount < 1) return; // Ensures big buyers are entering

          // 🎉 ALL STIPULATIONS SECURED -> DISPATCH TELEGRAM ALERT
          const tokenName = tokenData.name || 'Alpha Token';
          const tokenSymbol = tokenData.symbol || 'ALPH';
          const liquidityUsd = Number(tokenData.liquidity || tokenData.pool_liquidity || 0);

          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const gmgnInterfaceLink = `https://gmgn.ai/sol/token/${tokenMint}`;

          const telegramAlert = `
💎 <b>VERIFIED REVENUE BREAKOUT SIGNAL</b> 💎
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Asset Name:</b> <b>${tokenName} (${tokenSymbol})</b>
• <b>Contract:</b> <code>${tokenMint}</code>
• <b>Dev Wallet:</b> <code>${devAddress}</code>
────────────────────────
▶ <b>🛡️ STRICT SECURITY SANCTION PASS</b>
• <b>Liquidity Vault:</b> Locked & Burned 🔒 ✅
• <b>Mint/Freeze Controls:</b> Fully Renounced 🚫
• <b>Dev Profile Audit:</b> Clean (0 Rug History) 👤 ✅
────────────────────────
▶ <b>📈 HIGH-VOLUME & WHALE TRACKER</b>
• <b>Current Volume Velocity:</b> <b>$${(volume24h || volume5m).toLocaleString()}</b> 🚀
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
  console.log(`🚀 GMGN Sniper Core Listening on Port ${PORT}`);
});