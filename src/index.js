const fs = require('fs');
const path = require('path');
require('dotenv').config();
const {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');
const { voiceTickMs } = require('./lib/constants');
const { grantChatXp, grantVoiceTick } = require('./lib/activity');
const { consumeExpired } = require('./lib/games');
const { refundHostBet } = require('./lib/economy');

if (!process.env.DISCORD_TOKEN) {
  console.error('.env 파일에 DISCORD_TOKEN을 넣어주세요.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

async function deployCommands() {
  const body = [...client.commands.values()].map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const clientId = process.env.CLIENT_ID || client.user.id;
  if (process.env.GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), { body });
    console.log(`길드 명령어 ${body.length}개 등록됨`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`전역 명령어 ${body.length}개 등록됨 (반영까지 최대 1시간)`);
  }
}

client.once('ready', async () => {
  console.log(`${client.user.tag} 로그인 · public GitHub 배포`);
  try {
    await deployCommands();
  } catch (err) {
    console.error('명령어 등록 실패:', err);
  }

  setInterval(() => {
    grantVoiceTick(client).catch((err) => console.error('voice xp', err));
  }, voiceTickMs).unref();

  setInterval(async () => {
    const expired = consumeExpired();
    for (const game of expired) {
      await refundHostBet(client, game);
    }
  }, 30 * 1000).unref();
});

client.on('messageCreate', (message) => {
  grantChatXp(message).catch((err) => console.error('chat xp', err));
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('shop:')) {
      await client.commands.get('상점').handleSelect(interaction);
      return;
    }

    if (interaction.isButton()) {
      const [prefix] = interaction.customId.split(':');
      const map = {
        shop: '상점',
        oddeven: '홀짝',
        duel: '도박',
        raffle: '추첨',
      };
      const name = map[prefix];
      const command = name && client.commands.get(name);
      if (command?.handleButton) await command.handleButton(interaction);
    }
  } catch (err) {
    console.error(err);
    const payload = { content: '명령 처리 중 오류가 발생했습니다.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
