const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { defaults } = require('./lib/constants');
const { monthKey } = require('./lib/format');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'bot.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    currency_name TEXT NOT NULL DEFAULT '포인트',
    chat_xp_min INTEGER NOT NULL DEFAULT 15,
    chat_xp_max INTEGER NOT NULL DEFAULT 25,
    chat_cooldown INTEGER NOT NULL DEFAULT 60,
    voice_xp INTEGER NOT NULL DEFAULT 8,
    daily_xp INTEGER NOT NULL DEFAULT 200,
    daily_streak_bonus INTEGER NOT NULL DEFAULT 25,
    gamble_min INTEGER NOT NULL DEFAULT 50,
    gamble_max INTEGER NOT NULL DEFAULT 50000,
    gamble_fee INTEGER NOT NULL DEFAULT 5,
    gamble_cooldown INTEGER NOT NULL DEFAULT 8,
    level_channel_id TEXT,
    level_prefix INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS users (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    lifetime_xp INTEGER NOT NULL DEFAULT 0,
    monthly_xp INTEGER NOT NULL DEFAULT 0,
    month_key TEXT,
    last_message_at INTEGER NOT NULL DEFAULT 0,
    last_daily TEXT,
    streak INTEGER NOT NULL DEFAULT 0,
    total_daily INTEGER NOT NULL DEFAULT 0,
    gamble_wins INTEGER NOT NULL DEFAULT 0,
    gamble_losses INTEGER NOT NULL DEFAULT 0,
    gamble_wagered INTEGER NOT NULL DEFAULT 0,
    gamble_profit INTEGER NOT NULL DEFAULT 0,
    last_gamble_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'role',
    role_id TEXT,
    stock INTEGER NOT NULL DEFAULT -1,
    sold INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    purchased_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ignores (
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, type, target_id)
  );

  CREATE TABLE IF NOT EXISTS boosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target_id TEXT,
    extra_xp INTEGER NOT NULL,
    expires_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_users_xp ON users(guild_id, xp DESC);
  CREATE INDEX IF NOT EXISTS idx_shop_guild ON shop_items(guild_id);
`);

function ensureGuild(guildId) {
  db.prepare(
    `INSERT OR IGNORE INTO guilds (id, currency_name, chat_xp_min, chat_xp_max, chat_cooldown, voice_xp, daily_xp, daily_streak_bonus, gamble_min, gamble_max, gamble_fee, gamble_cooldown, level_prefix)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    guildId,
    defaults.currencyName,
    defaults.chatXpMin,
    defaults.chatXpMax,
    defaults.chatCooldown,
    defaults.voiceXp,
    defaults.dailyXp,
    defaults.dailyStreakBonus,
    defaults.gambleMin,
    defaults.gambleMax,
    defaults.gambleFee,
    defaults.gambleCooldown,
    defaults.levelPrefix
  );
  return db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId);
}

function updateGuild(guildId, patch) {
  ensureGuild(guildId);
  const keys = Object.keys(patch);
  if (!keys.length) return getGuild(guildId);
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE guilds SET ${sets} WHERE id = ?`).run(...keys.map((k) => patch[k]), guildId);
  return getGuild(guildId);
}

function getGuild(guildId) {
  return ensureGuild(guildId);
}

function getUser(guildId, userId) {
  return db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function ensureUser(guildId, userId) {
  ensureGuild(guildId);
  db.prepare(
    `INSERT OR IGNORE INTO users (guild_id, user_id, month_key) VALUES (?, ?, ?)`
  ).run(guildId, userId, monthKey());
  const user = getUser(guildId, userId);
  const currentMonth = monthKey();
  if (user.month_key !== currentMonth) {
    db.prepare('UPDATE users SET monthly_xp = 0, month_key = ? WHERE guild_id = ? AND user_id = ?').run(
      currentMonth,
      guildId,
      userId
    );
    return getUser(guildId, userId);
  }
  return user;
}

function setXp(guildId, userId, xp) {
  const user = ensureUser(guildId, userId);
  db.prepare('UPDATE users SET xp = ? WHERE guild_id = ? AND user_id = ?').run(Math.max(0, xp), guildId, userId);
  return { ...user, xp: Math.max(0, xp) };
}

function addXp(guildId, userId, amount, { lifetime = true, monthly = true } = {}) {
  const user = ensureUser(guildId, userId);
  const delta = Math.trunc(Number(amount) || 0);
  const nextXp = Math.max(0, user.xp + delta);
  const nextLifetime = lifetime && delta > 0 ? user.lifetime_xp + delta : user.lifetime_xp;
  const nextMonthly = monthly && delta > 0 ? user.monthly_xp + delta : user.monthly_xp;
  db.prepare(
    `UPDATE users SET xp = ?, lifetime_xp = ?, monthly_xp = ? WHERE guild_id = ? AND user_id = ?`
  ).run(nextXp, nextLifetime, nextMonthly, guildId, userId);
  return { ...user, xp: nextXp, lifetime_xp: nextLifetime, monthly_xp: nextMonthly, delta };
}

function touchMessage(guildId, userId, at) {
  ensureUser(guildId, userId);
  db.prepare('UPDATE users SET last_message_at = ? WHERE guild_id = ? AND user_id = ?').run(at, guildId, userId);
}

function claimDaily(guildId, userId, today, yesterday) {
  const user = ensureUser(guildId, userId);
  if (user.last_daily === today) return { ok: false, already: true, user };
  const streak = user.last_daily === yesterday ? user.streak + 1 : 1;
  db.prepare(
    `UPDATE users SET last_daily = ?, streak = ?, total_daily = total_daily + 1 WHERE guild_id = ? AND user_id = ?`
  ).run(today, streak, guildId, userId);
  return { ok: true, streak, user: getUser(guildId, userId) };
}

function recordGamble(guildId, userId, { win, wagered, profit }) {
  ensureUser(guildId, userId);
  db.prepare(
    `UPDATE users
     SET gamble_wins = gamble_wins + ?,
         gamble_losses = gamble_losses + ?,
         gamble_wagered = gamble_wagered + ?,
         gamble_profit = gamble_profit + ?,
         last_gamble_at = ?
     WHERE guild_id = ? AND user_id = ?`
  ).run(win ? 1 : 0, win ? 0 : 1, wagered, profit, Date.now(), guildId, userId);
}

function topUsers(guildId, sort = 'xp', limit = 10) {
  const column = {
    xp: 'xp',
    monthly: 'monthly_xp',
    daily: 'total_daily',
    streak: 'streak',
    gamble: 'gamble_profit',
  }[sort] || 'xp';
  return db.prepare(
    `SELECT * FROM users WHERE guild_id = ? ORDER BY ${column} DESC, xp DESC LIMIT ?`
  ).all(guildId, limit);
}

function rankOf(guildId, userId, sort = 'xp') {
  const user = ensureUser(guildId, userId);
  const column = {
    xp: 'xp',
    monthly: 'monthly_xp',
    daily: 'total_daily',
    streak: 'streak',
  }[sort] || 'xp';
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM users WHERE guild_id = ? AND ${column} > ?`
  ).get(guildId, user[column]);
  return row.n + 1;
}

function listShop(guildId) {
  return db.prepare('SELECT * FROM shop_items WHERE guild_id = ? ORDER BY price ASC, id ASC').all(guildId);
}

function getShopItem(id) {
  return db.prepare('SELECT * FROM shop_items WHERE id = ?').get(id);
}

function addShopItem(guildId, item) {
  const info = db.prepare(
    `INSERT INTO shop_items (guild_id, name, description, price, type, role_id, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    guildId,
    item.name,
    item.description || '',
    item.price,
    item.type || 'role',
    item.role_id || null,
    item.stock ?? -1
  );
  return getShopItem(Number(info.lastInsertRowid));
}

function deleteShopItem(id, guildId) {
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?').get(id, guildId);
  if (!item) return null;
  db.prepare('DELETE FROM shop_items WHERE id = ?').run(id);
  return item;
}

function bumpSold(id) {
  db.prepare('UPDATE shop_items SET sold = sold + 1 WHERE id = ?').run(id);
}

function addPurchase(guildId, userId, itemId) {
  db.prepare(
    'INSERT INTO purchases (guild_id, user_id, item_id, purchased_at) VALUES (?, ?, ?, ?)'
  ).run(guildId, userId, itemId, Date.now());
}

function hasPurchased(guildId, userId, itemId) {
  return Boolean(
    db.prepare('SELECT 1 FROM purchases WHERE guild_id = ? AND user_id = ? AND item_id = ?').get(
      guildId,
      userId,
      itemId
    )
  );
}

function addIgnore(guildId, type, targetId) {
  db.prepare('INSERT OR IGNORE INTO ignores (guild_id, type, target_id) VALUES (?, ?, ?)').run(
    guildId,
    type,
    targetId
  );
}

function removeIgnore(guildId, type, targetId) {
  db.prepare('DELETE FROM ignores WHERE guild_id = ? AND type = ? AND target_id = ?').run(
    guildId,
    type,
    targetId
  );
}

function listIgnores(guildId, type) {
  return db.prepare('SELECT * FROM ignores WHERE guild_id = ? AND type = ?').all(guildId, type);
}

function isIgnored(guildId, type, targetId) {
  return Boolean(
    db.prepare('SELECT 1 FROM ignores WHERE guild_id = ? AND type = ? AND target_id = ?').get(
      guildId,
      type,
      targetId
    )
  );
}

function addBoost(guildId, { type, targetId, extraXp, expiresAt }) {
  const info = db.prepare(
    `INSERT INTO boosts (guild_id, type, target_id, extra_xp, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).run(guildId, type, targetId || null, extraXp, expiresAt || null);
  return db.prepare('SELECT * FROM boosts WHERE id = ?').get(Number(info.lastInsertRowid));
}

function listBoosts(guildId) {
  const now = Date.now();
  db.prepare('DELETE FROM boosts WHERE expires_at IS NOT NULL AND expires_at <= ?').run(now);
  return db.prepare('SELECT * FROM boosts WHERE guild_id = ?').all(guildId);
}

function removeBoost(id, guildId) {
  const row = db.prepare('SELECT * FROM boosts WHERE id = ? AND guild_id = ?').get(id, guildId);
  if (!row) return null;
  db.prepare('DELETE FROM boosts WHERE id = ?').run(id);
  return row;
}

function activeBoosts(guildId, { roleIds = [], channelId = null } = {}) {
  const boosts = listBoosts(guildId);
  return boosts.filter((b) => {
    if (b.type === 'global') return true;
    if (b.type === 'channel' && channelId && b.target_id === channelId) return true;
    if (b.type === 'role' && roleIds.includes(b.target_id)) return true;
    return false;
  });
}

function usersWithRoleHint(_guildId) {
  return [];
}

function allUserIds(guildId) {
  return db.prepare('SELECT user_id FROM users WHERE guild_id = ?').all(guildId).map((r) => r.user_id);
}

module.exports = {
  db,
  getGuild,
  updateGuild,
  getUser,
  ensureUser,
  setXp,
  addXp,
  touchMessage,
  claimDaily,
  recordGamble,
  topUsers,
  rankOf,
  listShop,
  getShopItem,
  addShopItem,
  deleteShopItem,
  bumpSold,
  addPurchase,
  hasPurchased,
  addIgnore,
  removeIgnore,
  listIgnores,
  isIgnored,
  addBoost,
  listBoosts,
  removeBoost,
  activeBoosts,
  usersWithRoleHint,
  allUserIds,
};
