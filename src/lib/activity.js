const db = require('../db');
const { applyBoost, changeXp } = require('./economy');
const { randInt } = require('./games');

async function grantChatXp(message) {
  if (!message.guild || !message.member || message.author.bot) return;
  if (message.system || !message.content || message.content.length < 2) return;

  const guild = db.getGuild(message.guild.id);
  if (db.isIgnored(message.guild.id, 'channel', message.channel.id)) return;
  if (message.member && [...message.member.roles.cache.keys()].some((id) => db.isIgnored(message.guild.id, 'role', id))) {
    return;
  }

  const user = db.ensureUser(message.guild.id, message.author.id);
  const now = Date.now();
  if (now - (user.last_message_at || 0) < guild.chat_cooldown * 1000) return;

  db.touchMessage(message.guild.id, message.author.id, now);
  const base = randInt(guild.chat_xp_min, guild.chat_xp_max);
  const boosts = db.activeBoosts(message.guild.id, {
    roleIds: [...message.member.roles.cache.keys()],
    channelId: message.channel.id,
  });
  const amount = applyBoost(base, boosts);
  await changeXp(message.member, amount);
}

async function grantVoiceTick(client) {
  for (const guild of client.guilds.cache.values()) {
    const settings = db.getGuild(guild.id);
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isVoiceBased()) continue;
      if (db.isIgnored(guild.id, 'channel', channel.id)) continue;
      for (const member of channel.members.values()) {
        if (member.user.bot) continue;
        if (member.voice.selfDeaf || member.voice.deaf) continue;
        if ([...member.roles.cache.keys()].some((id) => db.isIgnored(guild.id, 'role', id))) continue;
        const boosts = db.activeBoosts(guild.id, {
          roleIds: [...member.roles.cache.keys()],
          channelId: channel.id,
        });
        const amount = applyBoost(settings.voice_xp, boosts);
        if (amount > 0) await changeXp(member, amount, { notify: true });
      }
    }
  }
}

module.exports = { grantChatXp, grantVoiceTick };
