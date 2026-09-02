const { EmbedBuilder } = require('discord.js');
const db = require('../db');
const { colors } = require('./constants');
const { formatNum } = require('./format');
const { levelFromXp, boostMultiplier } = require('./xp');

function currency(guild) {
  return guild?.currency_name || '포인트';
}

function applyBoost(base, boosts) {
  return Math.max(0, Math.round(base * boostMultiplier(boosts)));
}

async function changeXp(member, amount, options = {}) {
  const guildId = member.guild.id;
  const userId = member.id;
  const before = db.ensureUser(guildId, userId);
  const oldLevel = levelFromXp(before.xp).level;
  const after = db.addXp(guildId, userId, amount, options);
  const next = levelFromXp(after.xp);
  const guild = db.getGuild(guildId);

  if (guild.level_prefix && oldLevel !== next.level) {
    await updateNickname(member, next.level).catch(() => {});
  }

  if (oldLevel !== next.level && options.notify !== false) {
    await notifyLevelChange(member, oldLevel, next.level, after.xp, guild).catch(() => {});
  }

  return { before, after, oldLevel, newLevel: next.level, info: next };
}

async function updateNickname(member, level) {
  if (!member.manageable) return;
  const base = (member.nickname || member.user.username).replace(/^\[Lv\.\d+\]\s*/, '');
  const nick = `[Lv.${level}] ${base}`.slice(0, 32);
  if (member.displayName !== nick) {
    await member.setNickname(nick);
  }
}

async function notifyLevelChange(member, oldLevel, newLevel, xp, guild) {
  const up = newLevel > oldLevel;
  const embed = new EmbedBuilder()
    .setColor(up ? colors.gold : colors.red)
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
    .setTitle(up ? `레벨 업!  ${oldLevel} → ${newLevel}` : `레벨 다운  ${oldLevel} → ${newLevel}`)
    .setDescription(
      up
        ? `활동을 인정받아 **${newLevel}레벨**이 되었습니다.`
        : `포인트 소모로 **${newLevel}레벨**이 되었습니다.`
    )
    .addFields({ name: guild.currency_name, value: `${formatNum(xp)}`, inline: true })
    .setTimestamp();

  const channel =
    (guild.level_channel_id && member.guild.channels.cache.get(guild.level_channel_id)) ||
    null;
  if (channel?.isTextBased()) {
    await channel.send({ content: `${member}`, embeds: [embed] });
    return;
  }
}

function canAfford(user, amount) {
  return (user?.xp || 0) >= amount;
}

function validateBet(guild, amount) {
  if (!Number.isInteger(amount) || amount <= 0) return '배팅 금액이 올바르지 않습니다.';
  if (amount < guild.gamble_min) {
    return `최소 배팅은 **${formatNum(guild.gamble_min)} ${guild.currency_name}**입니다.`;
  }
  if (amount > guild.gamble_max) {
    return `최대 배팅은 **${formatNum(guild.gamble_max)} ${guild.currency_name}**입니다.`;
  }
  return null;
}

function feeOf(amount, guild) {
  return Math.floor(amount * (guild.gamble_fee / 100));
}

function cooldownLeft(user, guild) {
  const remain = (user.last_gamble_at || 0) + guild.gamble_cooldown * 1000 - Date.now();
  return remain > 0 ? Math.ceil(remain / 1000) : 0;
}

async function refundHostBet(client, game) {
  if (!game?.bet || !game.hostId || !game.guildId || game.refunded) return;
  game.refunded = true;
  const guild = client.guilds.cache.get(game.guildId);
  const member = await guild?.members.fetch(game.hostId).catch(() => null);
  if (member) {
    await changeXp(member, game.bet, { lifetime: false, monthly: false, notify: false });
  }
}

module.exports = {
  currency,
  applyBoost,
  changeXp,
  updateNickname,
  canAfford,
  validateBet,
  feeOf,
  cooldownLeft,
  refundHostBet,
};
