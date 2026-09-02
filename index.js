const fs = require('fs');
const path = require('path');

function findBotEntry(dir) {
  const direct = path.join(dir, 'src', 'index.js');
  if (fs.existsSync(direct)) return direct;

  const names = fs.readdirSync(dir);
  for (const name of names) {
    const nested = path.join(dir, name, 'src', 'index.js');
    if (fs.existsSync(nested)) return nested;
  }

  throw new Error(
    [
      'src 폴더가 없습니다. index.js만 있고 봇 코드가 없습니다.',
      `현재 파일: ${names.join(', ') || '(없음)'}`,
      'Files에서 src 폴더 전체를 index.js와 같은 위치에 업로드하세요.',
    ].join('\n')
  );
}

require(findBotEntry(__dirname));
