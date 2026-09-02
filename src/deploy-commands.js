require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) {
  console.error('DISCORD_TOKEN과 CLIENT_ID가 .env에 필요합니다.');
  process.exit(1);
}

const commands = [];
const dir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(dir, file));
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  if (process.env.GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), { body: commands });
    console.log(`길드 명령어 ${commands.length}개 등록`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`전역 명령어 ${commands.length}개 등록`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
