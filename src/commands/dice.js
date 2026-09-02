const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { changeXp, validateBet, cooldownLeft } = require('../lib/economy');
const { randInt } = require('../lib/games');
const { errorEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('주사위')
    .setDescription('대/소 주사위를 굴립니다')
    .addIntegerOption((opt) => opt.setName('금액').setDescription('배팅할 포인트').setRequired(true).setMinValue(1))
    .addStringOption((opt) =>
      opt
        .setName('선택')
        .setDescription('대(51~100) 또는 소(1~49). 50은 하우스')
        .setRequired(true)
        .addChoices({ name: '대 (51~100) ×1.9', value: 'high' }, { name: '소 (1~49) ×1.9', value: 'low' })
    ),
  async execute(interaction) {
    const guild = db.getGuild(interaction.guildId);
    const amount = interaction.options.getInteger('금액');
    const choice = interaction.options.getString('선택');
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
    const roll = randInt(1, 100);
    const win = (choice === 'high' && roll >= 51) || (choice === 'low' && roll <= 49);
    const payout = win ? Math.floor(amount * 1.9) : 0;
    if (payout) await changeXp(interaction.member, payout, { lifetime: false, monthly: false });
    db.recordGamble(interaction.guildId, interaction.user.id, {
      win,
      wagered: amount,
      profit: payout - amount,
    });
    const after = db.getUser(interaction.guildId, interaction.user.id);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(win ? colors.gold : colors.red)
          .setTitle('주사위')
          .setDescription(`굴림 **${roll}** · 선택 **${choice === 'high' ? '대' : '소'}**\n${win ? '승리!' : roll === 50 ? '50은 하우스 승리' : '패배'}`)
          .addFields(
            { name: '지급', value: formatNum(payout), inline: true },
            { name: '잔액', value: `${formatNum(after.xp)} ${guild.currency_name}`, inline: true }
          ),
      ],
    });
  },
};
