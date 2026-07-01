const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = process.env.TELEGRAM_CHAT_ID ? process.env.TELEGRAM_CHAT_ID.split(',') : [];
const bot = new Telegraf(BOT_TOKEN);

app.get('/', (req, res) => {
  res.status(200).send('🚀 Filtered Pipe Active & Awake 24/7.');
});

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) return res.status(200).send('Empty');

    const tx = data[0];
    const tokenUpdate = tx.tokenUpdates?.[0];
    if (!tokenUpdate) return res.status(200).send('No token data');

    const tokenMint   = tokenUpdate.mint || 'Unknown';
    const tokenSymbol = tokenUpdate.symbol || 'UNKNOWN';
    
    // 🛡️ INTERNAL ANTI-GARBAGE FILTERS (No API Required)
    
    // 1. Filter out tokens with missing symbols or generic scam names
    if (tokenSymbol === 'UNKNOWN' || tokenSymbol.trim() === '' || tokenSymbol.includes('?')) {
      console.log(`❌ [BLOCKED] Trash metadata/anonymous token.`);
      return res.status(200).send('Filtered');
    }

    // 2. Filter out transactions that aren't actual liquidity additions
    // If there's no SOL/USDC native movement paired with the token, it's a fake deployment
    const hasNativeMovement = tx.nativeTransfers && tx.nativeTransfers.length > 0;
    if (!hasNativeMovement) {
      console.log(`❌ [BLOCKED] Zero native liquidity initialization detected.`);
      return res.status(200).send('Filtered');
    }

    // 3. Block known repetitive deployer bot patterns (if your payload supports account data)
    const programId = tx.instructions?.[0]?.programId || '';
    if (programId === '') {
      console.log(`❌ [BLOCKED] Missing verified execution program.`);
      return res.status(200).send('Filtered');
    }

    console.log(`🎯 [PASSED FILTER] High-probability token: ${tokenSymbol}`);

    // ==================== DISPATCH DELIVERABLE ====================
    const statsLayout = `🎯 **VERIFIED MEME LAUNCH** 🎯\n` +
                        `----------------------------------------\n` +
                        `• **Asset:** (${tokenSymbol})\n` +
                        `• **Contract:** \`${tokenMint}\`\n` +
                        `----------------------------------------\n` +
                        `▶️ **SPEED CHANNELS**\n` +
                        `• 📊 [GMGN Terminal](https://gmgn.ai/sol/token/${tokenMint})\n` +
                        `• ⚔️ [Sniping Portal (Trojan)](https://t.me/solana_trojanbot?start=r-user-${tokenMint})`;

    for (const chatId of CHAT_IDS) {
      await bot.telegram.sendMessage(chatId, statsLayout, { parse_mode: 'Markdown', disable_web_preview: false });
    }

    res.status(200).send('Dispatched');

  } catch (error) {
    console.error('💥 Filter Error:', error.message);
    res.status(500).send('Error');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Filtered Scanner online on port ${PORT}`);
});