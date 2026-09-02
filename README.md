# 포인트봇

[leaderboard.run](https://leaderboard.run/) 스타일의 디스코드 서버 활성화 봇입니다.
채팅·음성으로 포인트를 얻고, 그 포인트를 서버 재화처럼 도박·선물·상점에 사용합니다.

포인트는 레벨과 같은 값입니다. 상점에서 역할을 사거나 도박에 지면 레벨도 내려갈 수 있습니다.

## 기능

- 채팅 XP (쿨타임), 음성 채널 1분당 XP
- 출석체크 + 연속 보너스
- 레벨 / 랭크 / 리더보드 (전체, 월간, 출석, 도박)
- 역할 상점 (`/상점`, `/상점관리`)
- 선물
- 도박: `/홀짝` (2인), `/도박` (주사위 대결), `/슬롯`, `/주사위`
- 추첨 이벤트
- 역할/채널 부스트, 무시 채널, 레벨 닉네임 접두사
- 관리자 지급/회수

슬롯·주사위는 하우스 마진이 있어 서버 재화가 무한히 불어나지 않습니다. 홀짝/대결은 유저끼리 포인트를 옮기고 수수료만 사라집니다.

## 1. 디스코드 앱 만들기

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 New Application
2. Bot → Add Bot → Reset Token 후 토큰 복사
3. Privileged Gateway Intents에서 켜기
   - **MESSAGE CONTENT INTENT**
   - **SERVER MEMBERS INTENT**
4. OAuth2 → URL Generator
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, `Manage Roles`, `Manage Nicknames`, `Read Message History`, `Connect`, `View Channels`
5. 생성된 URL로 봇을 서버에 초대
6. 서버 역할 목록에서 **봇 역할을 상점 역할보다 위**로 두기

## 2. 실행

```bash
copy .env.example .env
```

`.env` 예시:

```
DISCORD_TOKEN=봇토큰
CLIENT_ID=애플리케이션ID
GUILD_ID=테스트서버ID
```

`GUILD_ID`가 있으면 슬래시 명령어가 그 서버에 바로 등록됩니다. 없으면 전역 등록이라 최대 1시간 걸릴 수 있습니다.

```bash
npm install
npm start
```

## 디스호스트에 올리기

`node_modules`는 올리지 마세요. 패널이 `package.json`을 보고 알아서 설치합니다.

올릴 파일:

- `index.js`
- `package.json`
- `src` 폴더 전체
- `.env` (토큰 넣은 것)

압축할 때 ZIP **안에 또 폴더를 만들지 말고**, 위 파일들이 ZIP 루트에 바로 있게 하세요.

1. [대시보드](https://dishost.kr/dashboard/services/cmtijsdi2005lg37qtu8nv6cg)에서 **패널로 이동** / [panel.dishost.kr](https://panel.dishost.kr)
2. **Files** → Upload → ZIP 업로드 → 우클릭 **Unarchive**
3. Files에서 `.env` 만들기 (숨김 파일 표시를 켜야 보일 수 있음)

```
DISCORD_TOKEN=봇토큰
CLIENT_ID=애플리케이션ID
GUILD_ID=서버ID
```

4. **Startup** → STARTUP FILE 을 `index.js` 로 저장
5. **Console** → Start

콘솔에 봇 로그인과 `길드 명령어 N개 등록됨`이 나오면 성공입니다.

## GitHub 연동 (푸시 후 재시작하면 반영)

실행 중인 봇이 푸시 즉시 바뀌진 않습니다. 디스호스트는 **시작할 때** GitHub를 당겨옵니다.

1. GitHub에 저장소를 만들고 이 프로젝트만 푸시합니다. `.env`와 `data/`는 올리지 마세요.
2. 패널 **Startup**에서 저장합니다.
   - `GIT ADDRESS`: `https://github.com/아이디/저장소이름.git`
   - `BRANCH`: `main`
   - `AUTO_UPDATE`: `1` 또는 `true`
3. 서버에 `.git` 폴더가 있어야 당겨옵니다. 처음 한 번은 콘솔에서:

```bash
git clone https://github.com/아이디/저장소이름.git tmpclone
cp -a tmpclone/. .
rm -rf tmpclone
```

이미 파일이 있으면, 클론한 내용이 `src`, `index.js`, `package.json`을 덮습니다. `.env`와 `data/bot.db`는 git에 없어서 레벨 데이터가 유지됩니다.

4. 코드 수정 → `git push` → 패널에서 **재시작**

재시작하지 않으면 이전 코드가 계속 돌아갑니다.

## 명령어

### 유저

| 명령 | 설명 |
| --- | --- |
| `/랭크` | 레벨, 포인트, 다음 레벨 진행도 |
| `/리더보드` | 레벨 / 월간 / 출석 / 도박 순위 |
| `/레벨` | 목표 레벨까지 필요한 포인트 |
| `/출석체크` | 매일 1회 수령 (한국시간 00:00) |
| `/선물` | 다른 유저에게 포인트 전송 |
| `/상점` | 역할 등 상품 구매 |
| `/홀짝` | 2인 홀짝. 호스트가 먼저 고르고 상대가 참여 |
| `/도박` | 1~100 주사위 대결 호스트 |
| `/슬롯` | 슬롯머신 |
| `/주사위` | 대/소 ×1.9 |
| `/도박전적` | 승패, 순수익 |
| `/도움말` | 명령어 안내 |

### 관리자 (서버 관리 권한)

| 명령 | 설명 |
| --- | --- |
| `/경험치추가` `/경험치제거` | 개인 지급/회수 |
| `/역할경험치추가` | 역할 전원에게 지급 |
| `/상점관리 추가` | 역할을 상품으로 등록 |
| `/추첨` | 참가 버튼 추첨 |
| `/설정 보기` | 현재 수치 확인 |
| `/설정 경험치` | 채팅/음성/출석 값 |
| `/설정 도박` | 최소/최대/수수료/쿨타임 |
| `/설정 레벨` | 알림 채널, 닉네임 `[Lv.n]`, 재화 이름 |
| `/설정 무시` | XP를 안 주는 채널/역할 |
| `/설정 부스트` | 역할·채널 추가 XP % |

## 상점 역할 등록 예시

1. 서버에 `VIP` 역할 만들기
2. 봇 역할을 `VIP`보다 위에 두기
3. `/상점관리 추가 이름:VIP 가격:5000 역할:@VIP 설명:상점 VIP`
4. 유저가 `/상점`에서 구매

## 데이터

데이터는 Node 내장 SQLite(`data/bot.db`)에 저장됩니다. 백업은 이 파일을 복사하면 됩니다. Node.js 22.5 이상이 필요합니다.

## 기본값

- 채팅: 15~25 포인트 / 60초
- 음성: 분당 8 (서버 뮤트·먹통은 제외, 스스로 음소거는 지급)
- 출석: 200 + 연속일 × 25
- 도박: 최소 50, 최대 50,000, 수수료 5%, 쿨타임 8초
