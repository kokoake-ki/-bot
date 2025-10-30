const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(3000);

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // Discord Developer Portal から取得
const GUILD_ID = process.env.GUILD_ID;   // テスト用サーバーID

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== タイマー管理 =====
let timers = {}; // { userId: { name: { start: Date, pauses: [Date], totalPaused: ms } } }
let history = {}; // { userId: [ { name, start, end, duration } ] }

// ===== Slash Command登録 =====
const commands = [
  new SlashCommandBuilder()
    .setName('タイマー起動')
    .setDescription('作業タイマーを起動します')
    .addStringOption(option =>
      option.setName('名前').setDescription('タイマーの名前（任意）')
    ),
  new SlashCommandBuilder()
    .setName('タイマー中断')
    .setDescription('タイマーを一時中断します')
    .addStringOption(option =>
      option.setName('名前').setDescription('タイマーの名前（任意）')
    ),
  new SlashCommandBuilder()
    .setName('タイマー再開')
    .setDescription('中断したタイマーを再開します')
    .addStringOption(option =>
      option.setName('名前').setDescription('タイマーの名前（任意）')
    ),
  new SlashCommandBuilder()
    .setName('タイマーストップ')
    .setDescription('タイマーを停止し、作業時間を表示します')
    .addStringOption(option =>
      option.setName('名前').setDescription('タイマーの名前（任意）')
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slashコマンド登録完了');
  } catch (e) {
    console.error(e);
  }
})();

// ===== Bot動作 =====
client.on('ready', () => console.log(`✅ ${client.user.tag} がオンラインです！`));

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;
  const name = interaction.options.getString('名前') || 'default';

  switch (interaction.commandName) {
    case 'タイマー起動': {
      if (!timers[userId]) timers[userId] = {};
      timers[userId][name] = { start: new Date(), pauses: [], totalPaused: 0 };
      await interaction.reply(`⏱️ タイマー「${name}」を開始しました！`);
      break;
    }

    case 'タイマー中断': {
      const t = timers[userId]?.[name];
      if (!t) return interaction.reply('❌ 起動中のタイマーがありません。');
      t.pauses.push(new Date());
      await interaction.reply(`⏸️ タイマー「${name}」を一時中断しました。`);
      break;
    }

    case 'タイマー再開': {
      const t = timers[userId]?.[name];
      if (!t || !t.pauses.length) return interaction.reply('❌ 中断中のタイマーがありません。');
      const pauseEnd = new Date();
      const pauseStart = t.pauses.pop();
      t.totalPaused += pauseEnd - pauseStart;
      await interaction.reply(`▶️ タイマー「${name}」を再開しました！`);
      break;
    }

    case 'タイマーストップ': {
      const t = timers[userId]?.[name];
      if (!t) return interaction.reply('❌ 起動中のタイマーがありません。');
      const end = new Date();
      const duration = end - t.start - t.totalPaused;

      // 履歴に追加（最大3件）
      if (!history[userId]) history[userId] = [];
      history[userId].unshift({ name, start: t.start, end, duration });
      history[userId] = history[userId].slice(0, 3);

      delete timers[userId][name];

      const totalMinutes = Math.floor(duration / 60000);
      let msg = `⏹️ タイマー「${name}」を停止しました。\n作業時間: ${totalMinutes}分\n\n📜 過去3回の履歴:\n`;
      let total = 0;
      history[userId].forEach((h, i) => {
        const durMin = Math.floor(h.duration / 60000);
        total += h.duration;
        msg += `#${i + 1} ${h.name}: ${h.start.toLocaleTimeString()} - ${h.end.toLocaleTimeString()} (${durMin}分)\n`;
      });
      msg += `🧮 合計: ${Math.floor(total / 60000)}分`;
      await interaction.reply(msg);
      break;
    }
  }
});

client.login(TOKEN);
