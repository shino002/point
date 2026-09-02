function formatNum(n) {
  return Number(n || 0).toLocaleString('ko-KR');
}

function progressBar(current, max, size = 12) {
  if (max <= 0) return '█'.repeat(size);
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

function kstDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

function monthKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' })
    .format(date)
    .slice(0, 7);
}

function yesterdayKst() {
  return kstDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

function percent(n) {
  return `${Number(n || 0)}%`;
}

function truncate(text, max = 80) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

module.exports = {
  formatNum,
  progressBar,
  kstDateString,
  monthKey,
  yesterdayKst,
  percent,
  truncate,
};
