function xpToNextLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

function levelFromXp(xp) {
  let remaining = Math.max(0, Number(xp) || 0);
  let level = 0;
  while (remaining >= xpToNextLevel(level) && level < 1000) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  return {
    level,
    progress: remaining,
    needed: xpToNextLevel(level),
  };
}

function totalXpForLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i += 1) {
    total += xpToNextLevel(i);
  }
  return total;
}

function boostMultiplier(boosts) {
  const extra = (boosts || []).reduce((sum, b) => sum + (Number(b.extra_xp) || 0), 0);
  return 1 + extra / 100;
}

module.exports = {
  xpToNextLevel,
  levelFromXp,
  totalXpForLevel,
  boostMultiplier,
};
