const { gameExpireMs } = require('./constants');

const games = new Map();

function createGame(payload) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const game = {
    id,
    createdAt: Date.now(),
    status: 'open',
    ...payload,
  };
  games.set(id, game);
  return game;
}

function getGame(id) {
  const game = games.get(id);
  if (!game) return null;
  if (game.status === 'open' && Date.now() - game.createdAt > gameExpireMs) {
    return { ...game, status: 'expired', expired: true };
  }
  return game;
}

function saveGame(game) {
  games.set(game.id, game);
  return game;
}

function deleteGame(id) {
  games.delete(id);
}

function consumeExpired() {
  const now = Date.now();
  const expired = [];
  for (const [id, game] of games) {
    if (now - game.createdAt > gameExpireMs && game.status === 'open') {
      game.status = 'expired';
      expired.push(game);
      games.delete(id);
    }
  }
  return expired;
}

function claimExpired(id) {
  const game = games.get(id);
  if (!game || game.status !== 'open') return null;
  if (Date.now() - game.createdAt <= gameExpireMs) return null;
  game.status = 'expired';
  games.delete(id);
  return game;
}

function pickWeighted(items) {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  createGame,
  getGame,
  saveGame,
  deleteGame,
  consumeExpired,
  claimExpired,
  pickWeighted,
  randInt,
};
