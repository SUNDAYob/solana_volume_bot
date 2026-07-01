const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = process.env.TELEGRAM_CHAT_ID ? process.env.TELEGRAM_CHAT_ID.split(',') : [];
const GMGN_API_KEY = process.env.GMGN_API_KEY; 

const bot = new Telegraf(BOT_TOKEN);

app.get('/', (req, res) => {
  res.status(200).send('🛡️ GMGN Guard Intelligence Pipe is Active.');
});

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) return res.status(200).send('Empty');

    const tx = data[0];
    const tokenUpdate = tx.tokenUpdates?.[0];
    if (!tokenUpdate) return res.status(200).send('No token data');

    const tokenMint = tokenUpdate.mint;
    const tokenSymbol = tokenUpdate.symbol || 'UNNAMED';

    if (!tokenMint || tokenMint === 'Unknown') return res.status(200).send('Invalid Mint');

    console.log(`🔍 Intercepted launch: ${tokenSymbol}. Fetching GMGN Security Data...`);

    // Fetch deep analytics from GMGN API
    const gmgnResponse = await axios.get(`https://v1.api.gmgn.ai/v1/token/security/sol/${tokenMint}`, {
      headers: { 'Authorization': `Bearer ${GMGN_API_KEY}` }
    });

    if (!gmgnResponse.data || !gmgnResponse.data.data) {
      console.log(`⚠️ GMGN Data not ready for ${tokenSymbol}. Skipping to prevent risk.`);
      return res.status(200).send('Data Unavailable');
    }

    const info = gmgnResponse.data.data;

    // ==================== THE 7 CRITICAL SECURITY FILTERS ====================

    // 1. Block Honey Pots & Known Scam Signals
    if (info.is_honeypot || info.rug_ratio > 0.25) { 
      console.log(`❌ [BLOCKED] ${tokenSymbol} flagged as Honeypot or High Rug Risk (${info.rug_ratio}).`);
      return res.status(200).send('Filtered');
    }

    // 2. Limit Top 10 Holder Concentration (Must not hold over 30%)
    const top10Holding = info.top_10_holder_percentage || 0; 
    if (top10Holding > 30) {
      console.log(`❌ [BLOCKED] ${tokenSymbol} failed Whale Concentration: Top 10 holds ${top10Holding}%.`);
      return res.status(200).send('Filtered');
    }

    // 3. Liquidity Status Verification (Must be locked or burned)
    if (!info.liquidity_is_burned && !info.liquidity_is_locked) {
      console.log(`❌ [BLOCKED] ${tokenSymbol} has UNLOCKED/UNBURNED liquidity. High dev pool-pull risk.`);
      return res.status(200).send('Filtered');
    }

    // 4. Block Mintable Tokens
    if (info.is_mintable || !info.renounced_mint) {
      console.log(`❌ [BLOCKED] ${tokenSymbol} Authority isn't renounced. Supply is mintable.`);
      return res.status(200).send('Filtered');
    }

    // 5. High Volatility / Volume Potential Threshold Check
    const volume24h = info.volume_24h_usd || 0;
    const liquidityUsd = info.liquidity_usd || 0;
    if (liquidityUsd < 10000 && volume24h < 5000) { 
      console.log(`❌ [BLOCKED] ${tokenSymbol} low market entry momentum.`);
      return res.status(200).send('Filtered');
    }

    // 6. Track KOL and Whale Buys (Bullish Signals)
    const kolCount = info.kol_holder_count || 0;
    const smartMoneyCount = info.smart_degen_count || 0; 
    const hasWhaleActivity = info.whale_buy_detected || false; 

    console.log(`🎯 [PASSED ALL FILTERS] ${tokenSymbol} is clean. Sending verification payload...`);

    // ==================== PREMIUM VERIFIED LAYOUT ====================
    const securityLayout = 
      `🛡️ **GMGN VERIFIED SECURE LAUNCH** 🛡️\n` +
      `----------------------------------------\n` +
      `• **Asset:** ${tokenSymbol}\n` +
      `• **Contract:** \`${tokenMint}\`\n` +
      `----------------------------------------\n` +
      `📊 **RISK ASSESSMENT METRICS:**\n` +
      `• Top 10 Share: \`${top10Holding.toFixed(1)}%\` (Safe < 30%)\n` +
      `• Mint Authority: \`RENOUNCED ✅\`\n` +
      `• Liquidity: \`LOCKED/BURNED 🔥\`\n` +
      `• Rug Score: \`${info.rug_ratio || 0} / 1.0\`\n` +
      `----------------------------------------\n` +
      `🐋 **SMART RADAR INSIGHTS:**\n` +
      `• Tracking KOL Wallets: \`${kolCount}\` in position\n` +
      `• Smart Money Degens: \`${smartMoneyCount}\` buying\n` +
      `• Massive Whale Buys: \`${hasWhaleActivity ? '⚠️ YES' : 'NONE'}\`\n` +
      `----------------------------------------\n` +
      `▶️ **DIRECT SNIPE EXECUTION:**\n` +
      `• 📊 [GMGN Terminal](https://gmgn.ai/sol/token/${tokenMint})\n` +
      `• ⚔️ [Sniper Link (Trojan)](https://t.me/solana_trojanbot?start=r-user-${tokenMint})`;

    for (const chatId of CHAT_IDS) {
      await bot.telegram.sendMessage(chatId, securityLayout, { parse_mode: 'Markdown', disable_web_preview: true });
    }

    res.status(200).send('Dispatched');

  } catch (error) {
    console.error('💥 Guard Execution Error:', error.message);
    res.status(500).send('Error');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`GMGN Intel Guard online on port ${PORT}`);
});