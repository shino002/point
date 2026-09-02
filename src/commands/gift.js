const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { formatNum } = require('../lib/format');
const { changeXp } = require('../lib/economy');
const { errorEmbed, successEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('선물')
    .setDescription('다른 유저에게 포인트를 선물합니다')
    .addUserOption((opt) => opt.setName('유저').setDescription('받을 유저').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('금액').setDescription('선물할 포인트').setRequired(true).setMinValue(1)
    ),
  async execute(interaction) {
    const target = interaction.options.getMember('유저');
    const amount = interaction.options.getInteger('금액');
    const guild = db.getGuild(interaction.guildId);

    if (!target || target.user.bot) {
      return interaction.reply({ embeds: [errorEmbed('선물할 수 없는 대상입니다.')], ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('자기 자신에게는 선물할 수 없습니다.')], ephemeral: true });
    }

    const user = db.ensureUser(interaction.guildId, interaction.user.id);
    if (user.xp < amount) {
      return interaction.reply({
        embeds: [errorEmbed(`잔액이 부족합니다. 현재 **${formatNum(user.xp)} ${guild.currency_name}**`)],
        ephemeral: true,
      });
    }

    await changeXp(interaction.member, -amount, { lifetime: false, monthly: false });
    await changeXp(target, amount, { lifetime: false, monthly: false });

    await interaction.reply({
      embeds: [
        successEmbed(
          `${interaction.member} 님이 ${target} 님에게 **${formatNum(amount)} ${guild.currency_name}**를 선물했습니다.`
        ),
      ],
    });
  },
};
