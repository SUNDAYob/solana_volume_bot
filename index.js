const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = process.env.TELEGRAM_CHAT_ID ? process.env.TELEGRAM_CHAT_ID.split(',') : [];
const GMGN_API_KEY = process.env.GMGN_API_KEY; 
const bot = new Telegraf(BOT_TOKEN);

const processedTokens = new Set();

app.get('/', (req, res) => {
  res.status(200).send('🛰️ GMGN Direct Poller Active.');
});

async function scanNewPairs() {
  try {
    console.log("⏳ Fetching latest Solana pairs from GMGN...");
    
    // UPDATED TO DIRECT FLAT DOMAIN
    const response = await axios.get('https://gmgn.ai/v1/market/new_pairs/sol?limit=20', {
      headers: { 'Authorization': `Bearer ${GMGN_API_KEY}` },
      timeout: 10000 
    });

    if (!response.data || !response.data.data || !response.data.data.pairs) {
      console.log("ℹ️ No new pairs found in this tick.");
      return;
    }

    const pairs = response.data.data.pairs;
    console.log(`👀 Processing ${pairs.length} pairs from feed...`);

    for (const pair of pairs) {
      const tokenMint = pair.token_address;
      const tokenSymbol = pair.symbol || 'UNNAMED';

      if (processedTokens.has(tokenMint)) continue;
      processedTokens.add(tokenMint);
      if (processedTokens.size > 500) processedTokens.delete(processedTokens.values().next().value);

      // UPDATED TO DIRECT FLAT DOMAIN
      const secResponse = await axios.get(`https://gmgn.ai/v1/token/security/sol/${tokenMint}`, {
        headers: { 'Authorization': `Bearer ${GMGN_API_KEY}` },
        timeout: 10000
      });

      if (!secResponse.data || !secResponse.data.data) continue;
      const info = secResponse.data.data;

      // 1. Honey Pot / Rugs
      if (info.is_honeypot || info.rug_ratio > 0.20) {
        console.log(`❌ [BLOCKED] ${tokenSymbol} Honeypot or bad Rug Score.`);
        continue;
      }

      // 2. Concentration Check
      const top10Percentage = info.top_10_holder_percentage || 0;
      if (top10Percentage > 30) {
        console.log(`❌ [BLOCKED] ${tokenSymbol} Failed Concentration: Top 10 holds ${top10Percentage}%.`);
        continue;
      }

      // 3. Liquidity Status
      if (!info.liquidity_is_burned && !info.liquidity_is_locked) {
        console.log(`❌ [BLOCKED] ${tokenSymbol} has unlocked/unburned LP tokens.`);
        continue;
      }

      // 4. Mint Authority
      if (info.is_mintable || !info.renounced_mint) {
        console.log(`❌ [BLOCKED] ${tokenSymbol} has active mint authority.`);
        continue;
      }

      // 5. Volume Indices
      const poolLiquidity = pair.liquidity || 0;
      const volume5m = pair.volume_5m || 0;
      if (poolLiquidity < 15000 && volume5m < 5000) {
        console.log(`❌ [BLOCKED] ${tokenSymbol} Low starting liquidity/volatility index.`);
        continue;
      }

      const kolCount = info.kol_holder_count || 0;
      const smartMoneyCount = info.smart_degen_count || 0;
      const whaleBuyActive = info.whale_buy_detected || false;

      console.log(`🎯 [PASSED ALL SCREENING SELECTION] Dispatching secure coin: ${tokenSymbol}`);

      const template = 
        `🔥 **GMGN INTELLIGENCE LAUNCH FILTERED** 🔥\n` +
        `----------------------------------------\n` +
        `• **Asset:** ${tokenSymbol}\n` +
        `• **Contract:** \`${tokenMint}\`\n` +
        `----------------------------------------\n` +
        `🛡️ **COMPLIANCE CHECKS:**\n` +
        `• Top 10 Allocation: \`${top10Percentage.toFixed(1)}%\` (Limit < 30%)\n` +
        `• Mint Function: \`DEACTIVATED/RENOUNCED ✅\`\n` +
        `• Pool Condition: \`LOCKED/BURNED 🔥\`\n` +
        `• Honeypot Trap: \`CLEAN 🟢\`\n` +
        `----------------------------------------\n` +
        `🐋 **DASHBOARD INSIGHTS:**\n` +
        `• KOL Wallets Injected: \`${kolCount}\` \n` +
        `• Smart Money Buyers: \`${smartMoneyCount}\` \n` +
        `• Massive Whale Buys: \`${whaleBuyActive ? '🚨 YES' : 'NO'}\`\n` +
        `----------------------------------------\n` +
        `▶️ **DIRECT HANDLES**\n` +
        `• 📊 [GMGN Terminal](https://gmgn.ai/sol/token/${tokenMint})\n` +
        `• ⚔️ [Sniping Portal (Trojan)](https://t.me/solana_trojanbot?start=r-user-${tokenMint})`;

      for (const chatId of CHAT_IDS) {
        await bot.telegram.sendMessage(chatId, template, { parse_mode: 'Markdown', disable_web_preview: true });
      }
    }
  } catch (err) {
    console.error("⚠️ Loop Poll Incident:", err.message);
  }
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`GMGN Intel Guard online on port ${PORT}`);
  scanNewPairs();
  setInterval(scanNewPairs, 5000);
});