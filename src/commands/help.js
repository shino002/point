const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('../lib/constants');

module.exports = {
  data: new SlashCommandBuilder().setName('도움말').setDescription('봇 명령어와 사용법을 확인합니다'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(colors.primary)
      .setTitle('포인트봇 도움말')
      .setDescription(
        '채팅·음성 활동으로 포인트를 얻고, 레벨이 오릅니다.\n포인트는 서버 재화라서 도박·선물·상점에 쓸 수 있습니다. 쓰면 레벨이 내려갈 수 있습니다.'
      )
      .addFields(
        {
          name: '유저',
          value:
            '`/랭크` `/리더보드` `/레벨` `/출석체크` `/선물` `/상점` `/봇` `/도움말`',
        },
        {
          name: '도박',
          value: '`/홀짝` `/도박` `/슬롯` `/주사위` `/도박전적`',
        },
        {
          name: '관리자',
          value: '`/경험치추가` `/경험치제거` `/역할경험치추가` `/상점관리` `/추첨` `/설정`',
        },
        {
          name: '포인트 얻는 법',
          value: '채팅(쿨타임마다) · 음성 채널 1분당 · 매일 출석 · 관리자 이벤트',
        }
      )
      .setFooter({ text: 'leaderboard.run 스타일의 활동형 경제 봇' });

    await interaction.reply({ embeds: [embed] });
  },
};
