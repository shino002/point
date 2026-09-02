const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { changeXp } = require('../lib/economy');
const { createGame, getGame, saveGame, deleteGame } = require('../lib/games');
const { errorEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('추첨')
    .setDescription('포인트 추첨 이벤트를 엽니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) =>
      opt.setName('금액').setDescription('당첨 포인트').setRequired(true).setMinValue(1)
    )
    .addIntegerOption((opt) =>
      opt.setName('초').setDescription('접수 시간(초)').setMinValue(10).setMaxValue(600)
    ),
  async execute(interaction) {
    const amount = interaction.options.getInteger('금액');
    const seconds = interaction.options.getInteger('초') || 60;
    const guild = db.getGuild(interaction.guildId);
    const game = createGame({
      type: 'raffle',
      guildId: interaction.guildId,
      hostId: interaction.user.id,
      prize: amount,
      users: [],
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`raffle:join:${game.id}`).setLabel('참가').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`raffle:end:${game.id}`).setLabel('즉시 추첨').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(colors.gold)
          .setTitle('포인트 추첨')
          .setDescription(
            `당첨금 **${formatNum(amount)} ${guild.currency_name}**\n버튼을 눌러 참가하세요. **${seconds}초** 후 자동 추첨합니다.`
          ),
      ],
      components: [row],
    });

    setTimeout(() => settle(interaction, game.id).catch(() => {}), seconds * 1000);
  },
  async handleButton(interaction) {
    const [, action, gameId] = interaction.customId.split(':');
    const game = getGame(gameId);
    if (!game || game.expired || game.status !== 'open') {
      return interaction.reply({ embeds: [errorEmbed('이미 끝난 추첨입니다.')], ephemeral: true });
    }

    if (action === 'join') {
      if (game.users.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [errorEmbed('이미 참가했습니다.')], ephemeral: true });
      }
      game.users.push(interaction.user.id);
      saveGame(game);
      return interaction.reply({ content: `참가 완료! 현재 ${game.users.length}명`, ephemeral: true });
    }

    if (action === 'end') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild) && interaction.user.id !== game.hostId) {
        return interaction.reply({ embeds: [errorEmbed('관리자만 즉시 추첨할 수 있습니다.')], ephemeral: true });
      }
      await settle(interaction, game.id, true);
    }
  },
};

async function settle(interaction, gameId, fromButton = false) {
  const game = getGame(gameId);
  if (!game || game.status !== 'open') return;
  game.status = 'resolved';
  saveGame(game);
  const guild = db.getGuild(interaction.guildId);

  if (!game.users.length) {
    const payload = {
      embeds: [new EmbedBuilder().setColor(colors.dark).setDescription('참가자가 없어 추첨이 취소되었습니다.')],
      components: [],
    };
    deleteGame(game.id);
    if (fromButton) await interaction.update(payload);
    else await interaction.editReply(payload).catch(() => {});
    return;
  }

  const winnerId = game.users[Math.floor(Math.random() * game.users.length)];
  const winner = await interaction.guild.members.fetch(winnerId).catch(() => null);
  if (winner) await changeXp(winner, game.prize);

  const payload = {
    embeds: [
      new EmbedBuilder()
        .setColor(colors.gold)
        .setTitle('추첨 결과')
        .setDescription(
          `참가 ${game.users.length}명\n승자: ${winner || `<@${winnerId}>`}\n**+${formatNum(game.prize)} ${guild.currency_name}**`
        ),
    ],
    components: [],
  };
  deleteGame(game.id);
  if (fromButton) await interaction.update(payload);
  else await interaction.editReply(payload).catch(() => {});
}
