const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { colors } = require('../lib/constants');
const { formatNum } = require('../lib/format');
const { errorEmbed, successEmbed } = require('../lib/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('설정')
    .setDescription('서버 포인트/도박/레벨 설정을 변경합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('보기').setDescription('현재 설정을 확인합니다'))
    .addSubcommand((sub) =>
      sub
        .setName('경험치')
        .setDescription('채팅/음성/출석 경험치 값을 변경합니다')
        .addIntegerOption((opt) => opt.setName('채팅최소').setDescription('채팅 최소 포인트').setMinValue(0))
        .addIntegerOption((opt) => opt.setName('채팅최대').setDescription('채팅 최대 포인트').setMinValue(0))
        .addIntegerOption((opt) => opt.setName('채팅쿨타임').setDescription('채팅 쿨타임(초)').setMinValue(5).setMaxValue(600))
        .addIntegerOption((opt) => opt.setName('음성분당').setDescription('음성 1분당 포인트').setMinValue(0))
        .addIntegerOption((opt) => opt.setName('출석').setDescription('출석 기본 포인트').setMinValue(0))
        .addIntegerOption((opt) => opt.setName('출석보너스').setDescription('연속 출석 1일당 추가 포인트').setMinValue(0))
    )
    .addSubcommand((sub) =>
      sub
        .setName('도박')
        .setDescription('도박 한도와 수수료를 변경합니다')
        .addIntegerOption((opt) => opt.setName('최소').setDescription('최소 배팅').setMinValue(1))
        .addIntegerOption((opt) => opt.setName('최대').setDescription('최대 배팅').setMinValue(1))
        .addIntegerOption((opt) => opt.setName('수수료').setDescription('수수료 %').setMinValue(0).setMaxValue(50))
        .addIntegerOption((opt) => opt.setName('쿨타임').setDescription('도박 쿨타임(초)').setMinValue(0).setMaxValue(300))
    )
    .addSubcommand((sub) =>
      sub
        .setName('레벨')
        .setDescription('레벨 알림 채널과 닉네임 접두사를 설정합니다')
        .addChannelOption((opt) =>
          opt.setName('알림채널').setDescription('레벨 업 알림 채널').addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption((opt) => opt.setName('닉네임접두사').setDescription('닉네임 앞에 [Lv.n]을 붙입니다'))
        .addStringOption((opt) => opt.setName('재화이름').setDescription('재화 이름 (예: 포인트, XP)'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('무시')
        .setDescription('경험치를 주지 않을 채널/역할을 설정합니다')
        .addStringOption((opt) =>
          opt
            .setName('동작')
            .setDescription('추가 또는 제거')
            .setRequired(true)
            .addChoices({ name: '추가', value: 'add' }, { name: '제거', value: 'remove' })
        )
        .addChannelOption((opt) => opt.setName('채널').setDescription('무시할 채널'))
        .addRoleOption((opt) => opt.setName('역할').setDescription('무시할 역할'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('부스트')
        .setDescription('특정 역할/채널에서 경험치를 추가로 줍니다')
        .addIntegerOption((opt) =>
          opt.setName('추가퍼센트').setDescription('추가 지급 % (예: 50이면 1.5배)').setRequired(true).setMinValue(1).setMaxValue(500)
        )
        .addRoleOption((opt) => opt.setName('역할').setDescription('부스트할 역할'))
        .addChannelOption((opt) => opt.setName('채널').setDescription('부스트할 채널'))
        .addIntegerOption((opt) => opt.setName('분').setDescription('지속 시간(분). 비우면 무제한').setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('부스트삭제')
        .setDescription('부스트를 삭제합니다')
        .addIntegerOption((opt) => opt.setName('아이디').setDescription('부스트 ID').setRequired(true))
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === '보기') {
      const g = db.getGuild(guildId);
      const ignoresC = db.listIgnores(guildId, 'channel');
      const ignoresR = db.listIgnores(guildId, 'role');
      const boosts = db.listBoosts(guildId);
      const embed = new EmbedBuilder()
        .setColor(colors.primary)
        .setTitle('서버 설정')
        .addFields(
          { name: '재화', value: g.currency_name, inline: true },
          { name: '채팅', value: `${g.chat_xp_min}~${g.chat_xp_max} / ${g.chat_cooldown}초`, inline: true },
          { name: '음성', value: `${g.voice_xp} / 분`, inline: true },
          { name: '출석', value: `${g.daily_xp} + 스트릭 ${g.daily_streak_bonus}`, inline: true },
          { name: '도박', value: `${formatNum(g.gamble_min)}~${formatNum(g.gamble_max)} · 수수료 ${g.gamble_fee}% · ${g.gamble_cooldown}초`, inline: false },
          { name: '레벨 채널', value: g.level_channel_id ? `<#${g.level_channel_id}>` : '현재 채널/없음', inline: true },
          { name: '닉네임 접두사', value: g.level_prefix ? '켜짐' : '꺼짐', inline: true },
          {
            name: '무시',
            value:
              [...ignoresC.map((i) => `<#${i.target_id}>`), ...ignoresR.map((i) => `<@&${i.target_id}>`)].join(', ') ||
              '없음',
          },
          {
            name: '부스트',
            value:
              boosts
                .map((b) => {
                  const target = b.type === 'role' ? `<@&${b.target_id}>` : b.type === 'channel' ? `<#${b.target_id}>` : '전체';
                  return `ID ${b.id} · ${target} +${b.extra_xp}%`;
                })
                .join('\n') || '없음',
          }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === '경험치') {
      const patch = {};
      const min = interaction.options.getInteger('채팅최소');
      const max = interaction.options.getInteger('채팅최대');
      const cd = interaction.options.getInteger('채팅쿨타임');
      const voice = interaction.options.getInteger('음성분당');
      const daily = interaction.options.getInteger('출석');
      const bonus = interaction.options.getInteger('출석보너스');
      if (min != null) patch.chat_xp_min = min;
      if (max != null) patch.chat_xp_max = max;
      if (cd != null) patch.chat_cooldown = cd;
      if (voice != null) patch.voice_xp = voice;
      if (daily != null) patch.daily_xp = daily;
      if (bonus != null) patch.daily_streak_bonus = bonus;
      if (patch.chat_xp_min != null && patch.chat_xp_max != null && patch.chat_xp_min > patch.chat_xp_max) {
        return interaction.reply({ embeds: [errorEmbed('채팅 최소가 최대보다 클 수 없습니다.')], ephemeral: true });
      }
      db.updateGuild(guildId, patch);
      return interaction.reply({ embeds: [successEmbed('경험치 설정을 저장했습니다.')], ephemeral: true });
    }

    if (sub === '도박') {
      const patch = {};
      const min = interaction.options.getInteger('최소');
      const max = interaction.options.getInteger('최대');
      const fee = interaction.options.getInteger('수수료');
      const cd = interaction.options.getInteger('쿨타임');
      if (min != null) patch.gamble_min = min;
      if (max != null) patch.gamble_max = max;
      if (fee != null) patch.gamble_fee = fee;
      if (cd != null) patch.gamble_cooldown = cd;
      db.updateGuild(guildId, patch);
      return interaction.reply({ embeds: [successEmbed('도박 설정을 저장했습니다.')], ephemeral: true });
    }

    if (sub === '레벨') {
      const patch = {};
      const ch = interaction.options.getChannel('알림채널');
      const prefix = interaction.options.getBoolean('닉네임접두사');
      const name = interaction.options.getString('재화이름');
      if (ch) patch.level_channel_id = ch.id;
      if (prefix != null) patch.level_prefix = prefix ? 1 : 0;
      if (name) patch.currency_name = name.slice(0, 16);
      db.updateGuild(guildId, patch);
      return interaction.reply({ embeds: [successEmbed('레벨/재화 설정을 저장했습니다.')], ephemeral: true });
    }

    if (sub === '무시') {
      const action = interaction.options.getString('동작');
      const channel = interaction.options.getChannel('채널');
      const role = interaction.options.getRole('역할');
      if (!channel && !role) {
        return interaction.reply({ embeds: [errorEmbed('채널 또는 역할을 지정하세요.')], ephemeral: true });
      }
      if (channel) {
        if (action === 'add') db.addIgnore(guildId, 'channel', channel.id);
        else db.removeIgnore(guildId, 'channel', channel.id);
      }
      if (role) {
        if (action === 'add') db.addIgnore(guildId, 'role', role.id);
        else db.removeIgnore(guildId, 'role', role.id);
      }
      return interaction.reply({ embeds: [successEmbed('무시 목록을 업데이트했습니다.')], ephemeral: true });
    }

    if (sub === '부스트') {
      const extra = interaction.options.getInteger('추가퍼센트');
      const role = interaction.options.getRole('역할');
      const channel = interaction.options.getChannel('채널');
      const minutes = interaction.options.getInteger('분');
      const expiresAt = minutes ? Date.now() + minutes * 60 * 1000 : null;
      let type = 'global';
      let targetId = null;
      if (role) {
        type = 'role';
        targetId = role.id;
      } else if (channel) {
        type = 'channel';
        targetId = channel.id;
      }
      const boost = db.addBoost(guildId, { type, targetId, extraXp: extra, expiresAt });
      return interaction.reply({
        embeds: [successEmbed(`부스트 ID **${boost.id}** 를 추가했습니다. (+${extra}%)`)],
        ephemeral: true,
      });
    }

    const id = interaction.options.getInteger('아이디');
    const removed = db.removeBoost(id, guildId);
    if (!removed) return interaction.reply({ embeds: [errorEmbed('해당 부스트가 없습니다.')], ephemeral: true });
    await interaction.reply({ embeds: [successEmbed(`부스트 ${id}를 삭제했습니다.`)], ephemeral: true });
  },
};
