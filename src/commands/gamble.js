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
const { createGame, getGame, saveGame, deleteGame, claimExpired, randInt } = require('../lib/games');
const { errorEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('도박')
    .setDescription('주사위 대결 도박을 호스트합니다')
    .addIntegerOption((opt) => opt.setName('금액').setDescription('배팅할 포인트').setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const guild = db.getGuild(interaction.guildId);
    const amount = interaction.options.getInteger('금액');
    const err = validateBet(guild, amount);
    if (err) return interaction.reply({ embeds: [errorEmbed(err)], ephemeral: true });

    const user = db.ensureUser(interaction.guildId, interaction.user.id);
    const wait = cooldownLeft(user, guild);
    if (wait) return interaction.reply({ embeds: [errorEmbed(`도박 쿨타임이 **${wait}초** 남았습니다.`)], ephemeral: true });
    if (user.xp < amount) {
      return interaction.reply({
        embeds: [errorEmbed(`잔액이 부족합니다. 현재 **${formatNum(user.xp)} ${guild.currency_name}**`)],
        ephemeral: true,
      });
    }

    await changeXp(interaction.member, -amount, { lifetime: false, monthly: false, notify: false });
    const game = createGame({
      type: 'duel',
      guildId: interaction.guildId,
      hostId: interaction.user.id,
      bet: amount,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`duel:join:${game.id}`).setLabel('도전하기').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`duel:cancel:${game.id}`).setLabel('취소').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(colors.red)
          .setTitle('주사위 대결')
          .setDescription(
            `${interaction.member} 님이 **${formatNum(amount)} ${guild.currency_name}**를 걸고 대결을 열었습니다.\n` +
              `도전하면 같은 금액을 걸고 1~100 주사위를 굴립니다. 높은 쪽이 수수료를 제외하고 가져갑니다.`
          )
          .setFooter({ text: `수수료 ${guild.gamble_fee}% · 30분 후 만료` }),
      ],
      components: [row],
    });
  },
  async handleButton(interaction) {
    const [, action, gameId] = interaction.customId.split(':');
    const game = getGame(gameId);
    const guild = db.getGuild(interaction.guildId);

    if (!game || game.status === 'resolved') {
      return interaction.reply({ embeds: [errorEmbed('만료되었거나 이미 끝난 게임입니다.')], ephemeral: true });
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
      const host = await interaction.guild.members.fetch(game.hostId).catch(() => null);
      if (host) await changeXp(host, game.bet, { lifetime: false, monthly: false, notify: false });
      deleteGame(game.id);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(colors.dark).setDescription('대결이 취소되어 배팅이 환불되었습니다.')],
        components: [],
      });
      return;
    }

    if (interaction.user.id === game.hostId) {
      return interaction.reply({ embeds: [errorEmbed('자신의 대결에는 참여할 수 없습니다.')], ephemeral: true });
    }

    const challengerUser = db.ensureUser(interaction.guildId, interaction.user.id);
    const wait = cooldownLeft(challengerUser, guild);
    if (wait) return interaction.reply({ embeds: [errorEmbed(`도박 쿨타임이 **${wait}초** 남았습니다.`)], ephemeral: true });
    if (challengerUser.xp < game.bet) {
      return interaction.reply({
        embeds: [errorEmbed(`잔액이 부족합니다. 필요 **${formatNum(game.bet)} ${guild.currency_name}**`)],
        ephemeral: true,
      });
    }

    game.status = 'resolved';
    saveGame(game);

    await changeXp(interaction.member, -game.bet, { lifetime: false, monthly: false, notify: false });
    const host = await interaction.guild.members.fetch(game.hostId).catch(() => null);
    const hostRoll = randInt(1, 100);
    const chalRoll = randInt(1, 100);

    if (hostRoll === chalRoll) {
      if (host) await changeXp(host, game.bet, { lifetime: false, monthly: false, notify: false });
      await changeXp(interaction.member, game.bet, { lifetime: false, monthly: false, notify: false });
      deleteGame(game.id);
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(colors.blue)
            .setTitle('무승부')
            .setDescription(`호스트 **${hostRoll}** vs 도전자 **${chalRoll}**\n같은 숫자가 나와 배팅이 환불되었습니다.`),
        ],
        components: [],
      });
      return;
    }

    const hostWins = hostRoll > chalRoll;
    const winner = hostWins ? host : interaction.member;
    const loser = hostWins ? interaction.member : host;
    const fee = feeOf(game.bet, guild);
    const prize = game.bet * 2 - fee;
    if (winner) await changeXp(winner, prize, { lifetime: false, monthly: false });
    db.recordGamble(interaction.guildId, winner.id, { win: true, wagered: game.bet, profit: game.bet - fee });
    db.recordGamble(interaction.guildId, loser.id, { win: false, wagered: game.bet, profit: -game.bet });
    deleteGame(game.id);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(colors.gold)
          .setTitle('대결 결과')
          .setDescription(
            `${host} **${hostRoll}**  vs  ${interaction.member} **${chalRoll}**\n\n` +
              `승자 ${winner} · **${formatNum(prize)} ${guild.currency_name}** (수수료 ${formatNum(fee)})`
          ),
      ],
      components: [],
    });
  },
};
