const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { rankEmbed, errorEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('랭크')
    .setDescription('나와 다른 유저의 레벨과 포인트를 확인합니다')
    .addUserOption((opt) => opt.setName('유저').setDescription('확인할 유저')),
  async execute(interaction) {
    const target = interaction.options.getMember('유저') || interaction.member;
    if (!target || target.user.bot) {
      return interaction.reply({ embeds: [errorEmbed('봇의 랭크는 확인할 수 없습니다.')], ephemeral: true });
    }
    const user = db.ensureUser(interaction.guildId, target.id);
    const guild = db.getGuild(interaction.guildId);
    const rank = db.rankOf(interaction.guildId, target.id);
    await interaction.reply({ embeds: [rankEmbed(target, user, guild, rank)] });
  },
};
