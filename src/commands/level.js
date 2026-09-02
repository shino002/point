const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { formatNum } = require('../lib/format');
const { totalXpForLevel, levelFromXp } = require('../lib/xp');
const { errorEmbed, infoEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('레벨')
    .setDescription('특정 레벨까지 필요한 포인트를 확인합니다')
    .addIntegerOption((opt) =>
      opt.setName('목표').setDescription('확인하고 싶은 레벨').setRequired(true).setMinValue(1).setMaxValue(1000)
    ),
  async execute(interaction) {
    const target = interaction.options.getInteger('목표');
    const guild = db.getGuild(interaction.guildId);
    const user = db.ensureUser(interaction.guildId, interaction.user.id);
    const current = levelFromXp(user.xp);
    const need = totalXpForLevel(target);
    const remain = Math.max(0, need - user.xp);

    if (current.level >= target) {
      return interaction.reply({
        embeds: [errorEmbed(`이미 **${current.level}레벨**입니다. 목표 레벨보다 높거나 같습니다.`)],
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [
        infoEmbed(
          `${target}레벨까지`,
          `현재 **${current.level}레벨** · ${formatNum(user.xp)} ${guild.currency_name}\n` +
            `목표까지 **${formatNum(remain)} ${guild.currency_name}**가 필요합니다.\n` +
            `누적 필요량: ${formatNum(need)} ${guild.currency_name}`
        ),
      ],
    });
  },
};
