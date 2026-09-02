const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { errorEmbed, successEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('상점관리')
    .setDescription('포인트 상점 상품을 관리합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('추가')
        .setDescription('역할 상품을 상점에 올립니다')
        .addStringOption((opt) => opt.setName('이름').setDescription('상품 이름').setRequired(true))
        .addIntegerOption((opt) => opt.setName('가격').setDescription('포인트 가격').setRequired(true).setMinValue(1))
        .addRoleOption((opt) => opt.setName('역할').setDescription('구매 시 지급할 역할').setRequired(true))
        .addStringOption((opt) => opt.setName('설명').setDescription('상품 설명'))
        .addIntegerOption((opt) => opt.setName('재고').setDescription('재고 수량. 비우면 무제한').setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('삭제')
        .setDescription('상품을 삭제합니다')
        .addIntegerOption((opt) => opt.setName('아이디').setDescription('상품 ID').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('목록').setDescription('상점 상품 목록을 봅니다')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === '추가') {
      const role = interaction.options.getRole('역할');
      if (role.managed || role.id === interaction.guild.id) {
        return interaction.reply({ embeds: [errorEmbed('이 역할은 상품으로 등록할 수 없습니다.')], ephemeral: true });
      }
      if (!role.editable) {
        return interaction.reply({
          embeds: [errorEmbed('봇이 이 역할보다 아래에 있습니다. 봇 역할을 위로 올려주세요.')],
          ephemeral: true,
        });
      }
      const item = db.addShopItem(interaction.guildId, {
        name: interaction.options.getString('이름'),
        price: interaction.options.getInteger('가격'),
        role_id: role.id,
        description: interaction.options.getString('설명') || '',
        stock: interaction.options.getInteger('재고') ?? -1,
        type: 'role',
      });
      const guild = db.getGuild(interaction.guildId);
      return interaction.reply({
        embeds: [
          successEmbed(
            `상품 **${item.name}** (ID ${item.id})을 등록했습니다.\n가격 ${formatNum(item.price)} ${guild.currency_name} · 역할 ${role}`
          ),
        ],
      });
    }

    if (sub === '삭제') {
      const id = interaction.options.getInteger('아이디');
      const item = db.deleteShopItem(id, interaction.guildId);
      if (!item) {
        return interaction.reply({ embeds: [errorEmbed('해당 ID의 상품이 없습니다.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [successEmbed(`**${item.name}** 상품을 삭제했습니다.`)] });
    }

    const items = db.listShop(interaction.guildId);
    const guild = db.getGuild(interaction.guildId);
    const desc = items.length
      ? items
          .map(
            (item) =>
              `ID \`${item.id}\` · **${item.name}** · ${formatNum(item.price)} ${guild.currency_name}` +
              (item.role_id ? ` · <@&${item.role_id}>` : '')
          )
          .join('\n')
      : '상품이 없습니다.';
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(colors.primary).setTitle('상점 목록').setDescription(desc)],
      ephemeral: true,
    });
  },
};
