  const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(3000);

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== ストップウォッチ管理 =====
let stopwatches = {}; 
let history = {}; 

// ===== Slashコマンド =====
const commands = [
  new SlashCommandBuilder()
    .setName('ストップウォッチ開始')
    .setDescription('ストップウォッチを開始します')
    .addStringOption(o => o.setName('名前').setDescription('ストップウォッチの名前（任意）')),
  new SlashCommandBuilder()
    .setName('ストップウォッチ中断')
    .setDescription('ストップウォッチを一時中断します')
    .addStringOption(o => o.setName('名前').setDescription('名前（任意）')),
  new SlashCommandBuilder()
    .setName('ストップウォッチ再開')
    .setDescription('ストップウォッチを再開します')
    .addStringOption(o => o.setName('名前').setDescription('名前（任意）')),
  new SlashCommandBuilder()
    .setName('ストップウォッチ停止')
    .setDescription('ストップウォッチを停止します')
    .addStringOption(o => o.setName('名前').setDescription('名前（任意）'))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ コマンド登録完了');
  } catch (e) { console.error(e); }
})();

// ===== 動作ロジック =====
client.on('ready', () => console.log(`✅ ${client.user.tag} が起動しました！`));

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;
  const userId = i.user.id;
  const name = i.options.getString('名前') || 'default';

  switch (i.commandName) {
    case 'ストップウォッチ開始': {
      if (!stopwatches[userId]) stopwatches[userId] = {};
      stopwatches[userId][name] = { start: new Date(), pauses: [], totalPaused: 0 };
      await i.reply(`🟢 ストップウォッチ「${name}」を開始しました！`);
      break;
    }
    case 'ストップウォッチ中断': {
      const s = stopwatches[userId]?.[name];
      if (!s) return i.reply('❌ 起動中のストップウォッチがありません。');
      s.pauses.push(new Date());
      await i.reply(`⏸️ 「${name}」を一時中断しました。`);
      break;
    }
    case 'ストップウォッチ再開': {
      const s = stopwatches[userId]?.[name];
      if (!s || !s.pauses.length) return i.reply('❌ 中断中のストップウォッチがありません。');
      const pauseEnd = new Date();
      const pauseStart = s.pauses.pop();
      s.totalPaused += pauseEnd - pauseStart;
      await i.reply(`▶️ 「${name}」を再開しました！`);
      break;
    }
    case 'ストップウォッチ停止': {
      const s = stopwatches[userId]?.[name];
      if (!s) return i.reply('❌ 起動中のストップウォッチがありません。');
      const end = new Date();
      const duration = end - s.start - s.totalPaused;
      if (!history[userId]) history[userId] = [];
      history[userId].unshift({ name, start: s.start, end, duration });
      history[userId] = history[userId].slice(0, 3);
      delete stopwatches[userId][name];
      let total = 0;
      let msg = `⏹️ 「${name}」を停止しました。\n経過時間: ${Math.floor(duration / 60000)}分\n\n📜 履歴:\n`;
      history[userId].forEach((h, i) => {
        const mins = Math.floor(h.duration / 60000);
        total += h.duration;
        msg += `#${i + 1} ${h.name}: ${h.start.toLocaleTimeString()} - ${h.end.toLocaleTimeString()} (${mins}分)\n`;
      });
      msg += `🧮 合計: ${Math.floor(total / 60000)}分`;
      await i.reply(msg);
      break;
    }
  }
});

client.login(TOKEN);
