const { EmbedBuilder } = require('discord.js');
const { colors } = require('./constants');
const { formatNum, progressBar } = require('./format');
const { levelFromXp } = require('./xp');

function rankEmbed(member, user, guild, rank) {
  const info = levelFromXp(user.xp);
  const pct = info.needed ? Math.floor((info.progress / info.needed) * 100) : 100;
  return new EmbedBuilder()
    .setColor(colors.primary)
    .setAuthor({ name: `${member.displayName}의 랭크`, iconURL: member.displayAvatarURL() })
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '레벨', value: `**${info.level}**`, inline: true },
      { name: '순위', value: `**#${rank}**`, inline: true },
      { name: guild.currency_name, value: `**${formatNum(user.xp)}**`, inline: true },
      {
        name: '다음 레벨',
        value: `${progressBar(info.progress, info.needed)}  ${formatNum(info.progress)} / ${formatNum(info.needed)} (${pct}%)`,
      },
      { name: '이번 달 획득', value: formatNum(user.monthly_xp), inline: true },
      { name: '출석 스트릭', value: `${user.streak}일`, inline: true }
    )
    .setFooter({ text: member.guild.name })
    .setTimestamp();
}

function errorEmbed(text) {
  return new EmbedBuilder().setColor(colors.red).setDescription(text);
}

function successEmbed(text) {
  return new EmbedBuilder().setColor(colors.green).setDescription(text);
}

function infoEmbed(title, text) {
  return new EmbedBuilder().setColor(colors.primary).setTitle(title).setDescription(text);
}

module.exports = {
  rankEmbed,
  errorEmbed,
  successEmbed,
  infoEmbed,
};
