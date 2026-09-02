const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { changeXp } = require('../lib/economy');
const { errorEmbed, successEmbed } = require('../lib/embeds');

function shopEmbed(guild, items) {
  const lines = items.length
    ? items.map((item) => {
        const stock = item.stock < 0 ? '무제한' : `${Math.max(0, item.stock - item.sold)}개`;
        const role = item.role_id ? ` <@&${item.role_id}>` : '';
        return `**${item.name}**${role}\n가격 ${formatNum(item.price)} ${guild.currency_name} · 재고 ${stock}\n${item.description || '설명 없음'}`;
      })
    : ['등록된 상품이 없습니다. 관리자가 `/상점관리 추가`로 역할을 올려주세요.'];

  return new EmbedBuilder()
    .setColor(colors.gold)
    .setTitle(`${guild.currency_name} 상점`)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: '아래에서 상품을 고른 뒤 구매하세요' });
}

function shopComponents(items) {
  if (!items.length) return [];
  const select = new StringSelectMenuBuilder()
    .setCustomId('shop:select')
    .setPlaceholder('구매할 상품 선택')
    .addOptions(
      items.slice(0, 25).map((item) => ({
        label: item.name.slice(0, 100),
        description: `${item.price} · ${item.description || '역할 상품'}`.slice(0, 100),
        value: String(item.id),
      }))
    );
  return [new ActionRowBuilder().addComponents(select)];
}

async function buyItem(interaction, itemId) {
  const item = db.getShopItem(itemId);
  const guild = db.getGuild(interaction.guildId);
  if (!item || item.guild_id !== interaction.guildId) {
    return interaction.reply({ embeds: [errorEmbed('존재하지 않는 상품입니다.')], ephemeral: true });
  }
  if (item.stock >= 0 && item.sold >= item.stock) {
    return interaction.reply({ embeds: [errorEmbed('품절된 상품입니다.')], ephemeral: true });
  }
  if (db.hasPurchased(interaction.guildId, interaction.user.id, item.id) && item.type === 'role') {
    return interaction.reply({ embeds: [errorEmbed('이미 구매한 상품입니다.')], ephemeral: true });
  }

  const user = db.ensureUser(interaction.guildId, interaction.user.id);
  if (user.xp < item.price) {
    return interaction.reply({
      embeds: [errorEmbed(`잔액이 부족합니다. 필요 **${formatNum(item.price)}**, 보유 **${formatNum(user.xp)}** ${guild.currency_name}`)],
      ephemeral: true,
    });
  }

  if (item.type === 'role' && item.role_id) {
    const role = interaction.guild.roles.cache.get(item.role_id);
    if (!role) {
      return interaction.reply({ embeds: [errorEmbed('역할이 서버에서 삭제되었습니다.')], ephemeral: true });
    }
    if (!role.editable) {
      return interaction.reply({
        embeds: [errorEmbed('봇이 이 역할을 지급할 수 없습니다. 봇 역할을 상점 역할보다 위로 올려주세요.')],
        ephemeral: true,
      });
    }
    if (interaction.member.roles.cache.has(role.id)) {
      return interaction.reply({ embeds: [errorEmbed('이미 해당 역할을 가지고 있습니다.')], ephemeral: true });
    }
    await changeXp(interaction.member, -item.price, { lifetime: false, monthly: false });
    await interaction.member.roles.add(role, '포인트 상점 구매');
  } else {
    await changeXp(interaction.member, -item.price, { lifetime: false, monthly: false });
  }

  db.bumpSold(item.id);
  db.addPurchase(interaction.guildId, interaction.user.id, item.id);
  const after = db.getUser(interaction.guildId, interaction.user.id);

  await interaction.reply({
    embeds: [
      successEmbed(
        `**${item.name}**을(를) 구매했습니다.\n-${formatNum(item.price)} ${guild.currency_name} · 잔액 ${formatNum(after.xp)}`
      ),
    ],
  });
}

module.exports = {
  data: new SlashCommandBuilder().setName('상점').setDescription('포인트로 서버 역할 등 상품을 구매합니다'),
  async execute(interaction) {
    const guild = db.getGuild(interaction.guildId);
    const items = db.listShop(interaction.guildId);
    await interaction.reply({
      embeds: [shopEmbed(guild, items)],
      components: shopComponents(items),
    });
  },
  async handleSelect(interaction) {
    const itemId = Number(interaction.values[0]);
    const item = db.getShopItem(itemId);
    if (!item) {
      return interaction.reply({ embeds: [errorEmbed('존재하지 않는 상품입니다.')], ephemeral: true });
    }
    const guild = db.getGuild(interaction.guildId);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop:buy:${item.id}`)
        .setLabel(`${item.name} 구매 (${formatNum(item.price)})`)
        .setStyle(ButtonStyle.Success)
    );
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor(colors.primary)
          .setTitle(item.name)
          .setDescription(item.description || '설명 없음')
          .addFields(
            { name: '가격', value: `${formatNum(item.price)} ${guild.currency_name}`, inline: true },
            { name: '역할', value: item.role_id ? `<@&${item.role_id}>` : '없음', inline: true }
          ),
      ],
      components: [row],
    });
  },
  async handleButton(interaction) {
    const itemId = Number(interaction.customId.split(':')[2]);
    await buyItem(interaction, itemId);
  },
};
