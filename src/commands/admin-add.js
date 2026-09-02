const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db');
const { formatNum } = require('../lib/format');
const { changeXp } = require('../lib/economy');
const { errorEmbed, successEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('경험치추가')
    .setDescription('유저에게 포인트를 지급합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((opt) => opt.setName('유저').setDescription('대상').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('금액').setDescription('지급할 포인트').setRequired(true).setMinValue(1)
    ),
  async execute(interaction) {
    const target = interaction.options.getMember('유저');
    const amount = interaction.options.getInteger('금액');
    const guild = db.getGuild(interaction.guildId);
    if (!target || target.user.bot) {
      return interaction.reply({ embeds: [errorEmbed('지급할 수 없는 대상입니다.')], ephemeral: true });
    }
    await changeXp(target, amount);
    const after = db.getUser(interaction.guildId, target.id);
    await interaction.reply({
      embeds: [
        successEmbed(
          `${target} 님에게 **${formatNum(amount)} ${guild.currency_name}**를 지급했습니다.\n잔액 ${formatNum(after.xp)}`
        ),
      ],
    });
  },
};
