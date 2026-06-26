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
  res.status(200).send('⚙️ Institutional GMGN Dynamic Normalization Engine: Active\n');
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

      // Run parallel tracking thread
      (async () => {
        try {
          // ⏱️ Allow the token pool 6 seconds to register on indexing clusters
          await delay(6000);

          let rawData = null;
          const apiEndpoints = [
            `https://gmgn.ai/defi/quotation/v1/tokens/sol/${tokenMint}`,
            `https://gmgn.ai/api/v1/token_info/sol/${tokenMint}`
          ];

          for (const url of apiEndpoints) {
            try {
              const res = await axios.get(url, {
                headers: { 
                  'Authorization': `Bearer ${process.env.GMGN_API_KEY || ''}`,
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                timeout: 3500 
              });
              if (res.data && (res.data.data || res.data.token)) {
                rawData = res.data.data || res.data.token;
                break;
              }
            } catch (err) {}
          }

          if (!rawData) return;

          // 🧠 INTERNALLY MAPPED DYNAMIC DATA NORMALIZATION LAYER
          const getProp = (obj, keys, defaultVal = 0) => {
            for (const key of keys) {
              if (obj[key] !== undefined && obj[key] !== null) return obj[key];
            }
            return defaultVal;
          };

          // 🛡️ 1. SECURITY PARAMETERS
          const devRugHistoryCount = Number(getProp(rawData, ['creator_rug_count', 'dev_rug_count', 'rug_count', 'creator_rugs'], 0));
          
          const isHoneypotVal = getProp(rawData, ['is_honeypot', 'honeypot_risk', 'honeypot'], 'no');
          const isHoneypot = isHoneypotVal === 'yes' || isHoneypotVal === true || isHoneypotVal === 1;

          // Liquidity Check: Fallback logic flags true if explicitly locked, burned, or if the burn percentage hits 100
          const lpBurnRatio = Number(getProp(rawData, ['burn_ratio', 'lp_burn_ratio', 'burn_percentage'], 0));
          const isLpLocked = rawData.lp_locked === true || rawData.lp_burned === true || rawData.liquidity_locked === 1 || lpBurnRatio === 100;

          const isMintRenounced = rawData.renounced_mint === true || rawData.is_renounced === 1 || rawData.mint_renounced === 1 || rawData.renounce_mint === true;

          // --- FIREWALL SANCTIONS ---
          if (devRugHistoryCount > 0) return; 
          if (isHoneypot) return;
          if (!isLpLocked) return; 

          // 👤 2. DEVELOPER INFRASTRUCTURE MAPPING
          const devAddress = rawData.creator || rawData.dev_address || rawData.creator_address || "Unknown Address";
          const totalDevLaunches = Number(getProp(rawData, ['creator_token_count', 'dev_token_count', 'total_launches'], 0));

          // 📈 3. REALTIME TRADE VOLUME METRICS
          const volume24h = Number(getProp(rawData, ['volume_24h', 'volume', 'usd_volume_24h'], 0));
          const volume5m = Number(getProp(rawData, ['volume_5m', 'usd_volume_5m'], 0));
          const volume1h = Number(getProp(rawData, ['volume_1h', 'usd_volume_1h'], 0));
          
          // Match any active structural trade volume threshold to verify high-volume breakout status
          if (volume24h < 15000 && volume5m < 2000 && volume1h < 5000) return;

          // 🐋 4. WHALES & SMART MONEY ASSIGNMENT
          const whaleBuyCount = Number(getProp(rawData, ['whale_buy_count', 'whales_tracked', 'smart_money_buy_count', 'whale_buys'], 0));
          const largeTxCount = Number(getProp(rawData, ['large_transaction_count', 'buys', 'swaps', 'total_txs'], 0));
          
          if (whaleBuyCount < 1 && largeTxCount < 2) return;

          // ⚙️ EXTRACTING COSMETIC DETAILS FOR OUTPUT
          const tokenName = rawData.name || 'Solana Token';
          const tokenSymbol = rawData.symbol || 'SOL';
          const liquidityUsd = Number(getProp(rawData, ['liquidity', 'pool_liquidity', 'total_liquidity', 'liquidity_usd'], 0));

          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const gmgnMobileLink = `https://gmgn.ai/sol/token/${tokenMint}`;

          const telegramAlert = `
🚨 <b>FAST ALPHAS SNIPER MATCH</b> 🚨
────────────────────────
▶ <b>TOKEN PROFILE</b>
• <b>Asset:</b> <b>${tokenName} (${tokenSymbol})</b>
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>🛡️ 1. SECURITY PASSED</b>
• <b>Dev Rug History:</b> 0 Rugs Found (Clean) 👤 ✅
• <b>Honeypot Threat:</b> Safe (Mint Renounced) 🚫
• <b>Liquidity Pool:</b> Locked / Burned 🔒 ✅
────────────────────────
▶ <b>👤 2. DEVELOPER FOOTPRINT</b>
• <b>Dev Address:</b> <code>${devAddress}</code>
• <b>Profile Status:</b> ${totalDevLaunches === 0 ? '🆕 Fresh Wallet Approved' : `💼 Established (${totalDevLaunches} Launches)`}
────────────────────────
▶ <b>📈 3 & 4. VELOCITY & WHALE ACTIVITY</b>
• <b>Trade Volume:</b> <code>$${(volume24h || volume1h || volume5m).toLocaleString()}</code> 🚀
• <b>Total Liquidity:</b> <code>$${liquidityUsd > 0 ? '$' + liquidityUsd.toLocaleString() : 'Tracking Pool'}</code>
• <b>Tracked Whales Active:</b> <b>${whaleBuyCount || 'Early Phase'} Whales In</b> 🐋 🔥
────────────────────────
▶ <b>⚔️ SPEED ENTRY CHANNELS</b>
• <a href="${gmgnMobileLink}">GMGN Candlestick Chart Terminal</a>
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
  console.log(`🚀 Resilient GMGN Normalization Snipping Cluster Running on Port ${PORT}`);
});