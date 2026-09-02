const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { levelFromXp } = require('../lib/xp');
const { errorEmbed } = require('../lib/embeds');

const medals = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('리더보드')
    .setDescription('서버 순위를 확인합니다')
    .addStringOption((opt) =>
      opt
        .setName('종류')
        .setDescription('순위 기준')
        .addChoices(
          { name: '레벨 / 포인트', value: 'xp' },
          { name: '이번 달 획득', value: 'monthly' },
          { name: '누적 출석', value: 'daily' },
          { name: '연속 출석', value: 'streak' },
          { name: '도박 수익', value: 'gamble' }
        )
    ),
  async execute(interaction) {
    const sort = interaction.options.getString('종류') || 'xp';
    const guild = db.getGuild(interaction.guildId);
    const rows = db.topUsers(interaction.guildId, sort, 10);
    if (!rows.length) {
      return interaction.reply({ embeds: [errorEmbed('아직 순위 데이터가 없습니다.')], ephemeral: true });
    }

    const titles = {
      xp: '레벨 순위',
      monthly: '이번 달 획득 순위',
      daily: '누적 출석 순위',
      streak: '연속 출석 순위',
      gamble: '도박 수익 순위',
    };

    const lines = await Promise.all(
      rows.map(async (row, i) => {
        const member = await interaction.guild.members.fetch(row.user_id).catch(() => null);
        const name = member ? member.displayName : `<@${row.user_id}>`;
        const medal = medals[i] || `**${i + 1}.**`;
        const info = levelFromXp(row.xp);
        const extra = {
          xp: `Lv.${info.level} · ${formatNum(row.xp)} ${guild.currency_name}`,
          monthly: `${formatNum(row.monthly_xp)} ${guild.currency_name}`,
          daily: `${formatNum(row.total_daily)}회`,
          streak: `${row.streak}일`,
          gamble: `${row.gamble_profit >= 0 ? '+' : ''}${formatNum(row.gamble_profit)} ${guild.currency_name}`,
        }[sort];
        return `${medal} ${name} — ${extra}`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor(colors.gold)
      .setTitle(`🏆 ${titles[sort]}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: interaction.guild.name })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
