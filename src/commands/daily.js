const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum, kstDateString, yesterdayKst } = require('../lib/format');
const { changeXp, applyBoost } = require('../lib/economy');
const { errorEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('출석체크').setDescription('매일 출석하고 포인트를 받습니다'),
  async execute(interaction) {
    const guild = db.getGuild(interaction.guildId);
    const today = kstDateString();
    const result = db.claimDaily(interaction.guildId, interaction.user.id, today, yesterdayKst());
    if (!result.ok) {
      return interaction.reply({
        embeds: [errorEmbed('오늘은 이미 출석했습니다. 내일 다시 받아주세요. (자정 기준: 한국시간)')],
        ephemeral: true,
      });
    }

    const boosts = db.activeBoosts(interaction.guildId, {
      roleIds: [...interaction.member.roles.cache.keys()],
    });
    const dailyBoosts = boosts.filter((b) => b.type === 'global' || b.type === 'role' || b.type === 'daily');
    const streakBonus = (result.streak - 1) * guild.daily_streak_bonus;
    const amount = applyBoost(guild.daily_xp + streakBonus, dailyBoosts);
    await changeXp(interaction.member, amount);

    const embed = new EmbedBuilder()
      .setColor(colors.gold)
      .setTitle('출석 완료')
      .setDescription(`${interaction.member} 님이 출석했습니다.`)
      .addFields(
        { name: '지급', value: `**+${formatNum(amount)} ${guild.currency_name}**`, inline: true },
        { name: '연속 출석', value: `**${result.streak}일**`, inline: true },
        { name: '누적 출석', value: `${result.user.total_daily}회`, inline: true }
      )
      .setFooter({ text: '매일 한국시간 00:00에 초기화됩니다' });

    await interaction.reply({ embeds: [embed] });
  },
};
