const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db');
const { formatNum } = require('../lib/format');
const { changeXp } = require('../lib/economy');
const { successEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('역할경험치추가')
    .setDescription('해당 역할을 가진 모든 멤버에게 포인트를 지급합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((opt) => opt.setName('역할').setDescription('대상 역할').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('금액').setDescription('지급할 포인트').setRequired(true).setMinValue(1)
    ),
  async execute(interaction) {
    const role = interaction.options.getRole('역할');
    const amount = interaction.options.getInteger('금액');
    const guild = db.getGuild(interaction.guildId);
    await interaction.deferReply();
    await interaction.guild.members.fetch();
    const members = role.members.filter((m) => !m.user.bot);
    let count = 0;
    for (const member of members.values()) {
      await changeXp(member, amount);
      count += 1;
    }
    await interaction.editReply({
      embeds: [
        successEmbed(
          `${role} 역할 **${count}명**에게 각각 **${formatNum(amount)} ${guild.currency_name}**를 지급했습니다.`
        ),
      ],
    });
  },
};
