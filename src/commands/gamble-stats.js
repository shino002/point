const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { errorEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('도박전적')
    .setDescription('도박 전적을 확인합니다')
    .addUserOption((opt) => opt.setName('유저').setDescription('확인할 유저')),
  async execute(interaction) {
    const target = interaction.options.getMember('유저') || interaction.member;
    if (!target || target.user.bot) {
      return interaction.reply({ embeds: [errorEmbed('봇의 전적은 없습니다.')], ephemeral: true });
    }
    const user = db.ensureUser(interaction.guildId, target.id);
    const guild = db.getGuild(interaction.guildId);
    const games = user.gamble_wins + user.gamble_losses;
    const rate = games ? Math.round((user.gamble_wins / games) * 100) : 0;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(colors.primary)
          .setAuthor({ name: `${target.displayName}의 도박 전적`, iconURL: target.displayAvatarURL() })
          .addFields(
            { name: '승리', value: `${user.gamble_wins}회`, inline: true },
            { name: '패배', value: `${user.gamble_losses}회`, inline: true },
            { name: '승률', value: `${rate}%`, inline: true },
            { name: '총 배팅', value: `${formatNum(user.gamble_wagered)} ${guild.currency_name}`, inline: true },
            {
              name: '순수익',
              value: `${user.gamble_profit >= 0 ? '+' : ''}${formatNum(user.gamble_profit)} ${guild.currency_name}`,
              inline: true,
            }
          ),
      ],
    });
  },
};
