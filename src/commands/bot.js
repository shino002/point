const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('../lib/constants');

module.exports = {
  data: new SlashCommandBuilder().setName('봇').setDescription('봇 정보를 확인합니다'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(colors.primary)
      .setTitle('포인트봇')
      .setDescription(
        '서버 활동으로 포인트를 모으고, 레벨·상점·도박으로 쓰는 경제 봇입니다.\n' +
          '채팅과 음성 참여가 곧 재화가 됩니다.'
      )
      .addFields(
        { name: '서버', value: `${interaction.client.guilds.cache.size}개`, inline: true },
        { name: '핑', value: `${interaction.client.ws.ping}ms`, inline: true },
        { name: '도움말', value: '`/도움말`', inline: true }
      )
      .setFooter({ text: '가상 포인트 전용 · 현금 환전 없음' });
    await interaction.reply({ embeds: [embed] });
  },
};
