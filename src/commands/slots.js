const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { changeXp, validateBet, cooldownLeft } = require('../lib/economy');
const { pickWeighted } = require('../lib/games');
const { errorEmbed } = require('../lib/embeds');

const SYMBOLS = [
  { emoji: '🍒', weight: 32, triple: 2 },
  { emoji: '🍋', weight: 24, triple: 3 },
  { emoji: '🍇', weight: 18, triple: 5 },
  { emoji: '🍉', weight: 12, triple: 8 },
  { emoji: '⭐', weight: 9, triple: 12 },
  { emoji: '💎', weight: 5, triple: 25 },
];

function spin() {
  return [pickWeighted(SYMBOLS), pickWeighted(SYMBOLS), pickWeighted(SYMBOLS)];
}

function payout(reels, bet) {
  const [a, b, c] = reels;
  if (a.emoji === b.emoji && b.emoji === c.emoji) return { win: bet * a.triple, label: `트리플 ${a.emoji} ×${a.triple}` };
  if (a.emoji === b.emoji || a.emoji === c.emoji || b.emoji === c.emoji) {
    return { win: Math.floor(bet * 1.2), label: '더블 매치 ×1.2' };
  }
  return { win: 0, label: '꽝' };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('슬롯')
    .setDescription('슬롯머신을 돌립니다')
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
    const reels = spin();
    const result = payout(reels, amount);
    if (result.win > 0) {
      await changeXp(interaction.member, result.win, { lifetime: false, monthly: false });
    }
    const profit = result.win - amount;
    db.recordGamble(interaction.guildId, interaction.user.id, {
      win: result.win > 0,
      wagered: amount,
      profit,
    });
    const after = db.getUser(interaction.guildId, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(result.win > amount ? colors.gold : result.win > 0 ? colors.green : colors.red)
      .setTitle('슬롯머신')
      .setDescription(`**${reels.map((r) => r.emoji).join(' | ')}**\n${result.label}`)
      .addFields(
        { name: '배팅', value: formatNum(amount), inline: true },
        { name: '당첨', value: formatNum(result.win), inline: true },
        { name: '잔액', value: `${formatNum(after.xp)} ${guild.currency_name}`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
