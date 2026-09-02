const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { changeXp, validateBet, feeOf, cooldownLeft, refundHostBet } = require('../lib/economy');
const { createGame, getGame, saveGame, deleteGame, claimExpired } = require('../lib/games');
const { errorEmbed } = require('../lib/embeds');

function buttons(gameId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`oddeven:odd:${gameId}`).setLabel('홀').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`oddeven:even:${gameId}`).setLabel('짝').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`oddeven:cancel:${gameId}`).setLabel('취소').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
}

function gameEmbed(guild, game, extra = '') {
  const pick = game.hostPick ? (game.hostPick === 'odd' ? '홀' : '짝') : '선택 대기';
  return new EmbedBuilder()
    .setColor(colors.primary)
    .setTitle('홀짝')
    .setDescription(
      `<@${game.hostId}> 님이 **${formatNum(game.bet)} ${guild.currency_name}**를 배팅했습니다.\n` +
        `호스트 선택: **${pick}**\n` +
        `수수료 ${guild.gamble_fee}%\n\n` +
        '호스트가 먼저 홀/짝을 고르고, 상대는 반대 또는 같은 쪽을 고릅니다.\n' +
        '상대가 **같은 쪽**을 고르면 상대 승리, **다른 쪽**이면 호스트 승리.\n' +
        extra
    )
    .setFooter({ text: '30분 안에 참여자가 없으면 만료되어 환불됩니다' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('홀짝')
    .setDescription('2인용 홀짝 도박을 호스트합니다')
    .addIntegerOption((opt) => opt.setName('금액').setDescription('배팅할 포인트').setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const guild = db.getGuild(interaction.guildId);
    const amount = interaction.options.getInteger('금액');
    const err = validateBet(guild, amount);
    if (err) return interaction.reply({ embeds: [errorEmbed(err)], ephemeral: true });

    const user = db.ensureUser(interaction.guildId, interaction.user.id);
    const wait = cooldownLeft(user, guild);
    if (wait) {
      return interaction.reply({ embeds: [errorEmbed(`도박 쿨타임이 **${wait}초** 남았습니다.`)], ephemeral: true });
    }
    if (user.xp < amount) {
      return interaction.reply({
        embeds: [errorEmbed(`잔액이 부족합니다. 현재 **${formatNum(user.xp)} ${guild.currency_name}**`)],
        ephemeral: true,
      });
    }

    await changeXp(interaction.member, -amount, { lifetime: false, monthly: false, notify: false });
    const game = createGame({
      type: 'oddeven',
      guildId: interaction.guildId,
      hostId: interaction.user.id,
      bet: amount,
      hostPick: null,
    });

    await interaction.reply({
      embeds: [gameEmbed(guild, game)],
      components: [buttons(game.id)],
    });
  },
  async handleButton(interaction) {
    const [, action, gameId] = interaction.customId.split(':');
    const game = getGame(gameId);
    const guild = db.getGuild(interaction.guildId);

    if (!game || game.status === 'resolved') {
      return interaction.reply({
        embeds: [errorEmbed('만료되었거나 이미 끝난 게임입니다.')],
        ephemeral: true,
      });
    }
    if (game.expired) {
      const claimed = claimExpired(gameId);
      if (claimed) await refundHostBet(interaction.client, claimed);
      return interaction.reply({
        embeds: [errorEmbed('시간이 만료되어 호스트에게 배팅이 환불되었습니다.')],
        ephemeral: true,
      });
    }

    if (action === 'cancel') {
      if (interaction.user.id !== game.hostId) {
        return interaction.reply({ embeds: [errorEmbed('호스트만 취소할 수 있습니다.')], ephemeral: true });
      }
      if (game.hostPick) {
        return interaction.reply({ embeds: [errorEmbed('이미 선택이 끝나 취소할 수 없습니다.')], ephemeral: true });
      }
      const host = await interaction.guild.members.fetch(game.hostId).catch(() => null);
      if (host) await changeXp(host, game.bet, { lifetime: false, monthly: false, notify: false });
      deleteGame(game.id);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(colors.dark).setDescription('게임이 취소되어 배팅이 환불되었습니다.')],
        components: [],
      });
      return;
    }

    const pick = action === 'odd' ? 'odd' : 'even';

    if (!game.hostPick) {
      if (interaction.user.id !== game.hostId) {
        return interaction.reply({ embeds: [errorEmbed('호스트가 먼저 홀/짝을 선택해야 합니다.')], ephemeral: true });
      }
      game.hostPick = pick;
      saveGame(game);
      await interaction.update({
        embeds: [gameEmbed(guild, game, '\n상대방의 참여를 기다립니다.')],
        components: [buttons(game.id)],
      });
      return;
    }

    if (interaction.user.id === game.hostId) {
      return interaction.reply({ embeds: [errorEmbed('호스트는 상대 선택을 할 수 없습니다.')], ephemeral: true });
    }

    const challengerUser = db.ensureUser(interaction.guildId, interaction.user.id);
    const wait = cooldownLeft(challengerUser, guild);
    if (wait) {
      return interaction.reply({ embeds: [errorEmbed(`도박 쿨타임이 **${wait}초** 남았습니다.`)], ephemeral: true });
    }
    if (challengerUser.xp < game.bet) {
      return interaction.reply({
        embeds: [errorEmbed(`잔액이 부족합니다. 필요 **${formatNum(game.bet)} ${guild.currency_name}**`)],
        ephemeral: true,
      });
    }

    game.status = 'resolved';
    saveGame(game);

    const challenger = interaction.member;
    const host = await interaction.guild.members.fetch(game.hostId).catch(() => null);
    await changeXp(challenger, -game.bet, { lifetime: false, monthly: false, notify: false });

    const challengerWins = pick === game.hostPick;
    const winner = challengerWins ? challenger : host;
    const loser = challengerWins ? host : challenger;
    const fee = feeOf(game.bet, guild);
    const prize = game.bet * 2 - fee;

    if (winner) await changeXp(winner, prize, { lifetime: false, monthly: false });
    db.recordGamble(interaction.guildId, winner?.id || game.hostId, { win: true, wagered: game.bet, profit: game.bet - fee });
    db.recordGamble(interaction.guildId, loser?.id || interaction.user.id, { win: false, wagered: game.bet, profit: -game.bet });
    deleteGame(game.id);

    const pickLabel = (v) => (v === 'odd' ? '홀' : '짝');
    const embed = new EmbedBuilder()
      .setColor(colors.gold)
      .setTitle('홀짝 결과')
      .setDescription(
        `호스트: ${pickLabel(game.hostPick)} · 상대: ${pickLabel(pick)}\n\n` +
          `승자 ${winner} 님이 **${formatNum(prize)} ${guild.currency_name}**를 가져갑니다.\n` +
          `수수료 ${formatNum(fee)} ${guild.currency_name}`
      );

    await interaction.update({ embeds: [embed], components: [] });
  },
};
