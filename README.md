# 青禾谷物语

一款原创像素风田园经营游戏：继承爷爷的农场，在白鹭镇种田、钓鱼、挖矿、砍树、交朋友，修复社区中心，目标是三年后爷爷回来评分时点亮四根蜡烛。

**▶ 在线试玩（GitHub Pages）：<https://oldcoffee.github.io/qinghe-valley-tales/>**（存档保存在浏览器本地）

同一套游戏引擎提供两种玩法：

- **网页版（推荐）**：像素风可视化界面，点格子种田、整页切换、弹窗交互，打开浏览器就能玩。
- **终端版**：纯文字 CLI，数字菜单 + 快捷命令。已发布到 npm，终端输 `npx qinghe-valley-tales` 就能玩，不用克隆、不用装。

> 详细产品设计见 [docs/PRD.md](docs/PRD.md)，网页版视觉规范见 [design-system/default/pages/web-game.md](design-system/default/pages/web-game.md)。

---

## 玩法一览

| 系统 | 内容 |
| --- | --- |
| 农场 | 露天农田 6×8 + 温室 2×8；清理、开垦、播种、浇水、收获、出货，四季轮作，雨天自动浇水 |
| 钓鱼 | 海滩（海鱼）、森林（河鱼）、山区（湖鱼）三处水域；鱼种由地点 + 季节 + 天气 + 时段 + 钓鱼等级决定，回合制拉锯小游戏 |
| 矿洞 | 60 层；矿石/宝石/怪物按层分段，每 5 层安全层+电梯点，每 10 层一次性宝箱，60 层有最强武器银河剑 |
| 森林 | 砍树得木材、三个固定采集点（蘑菇圈/野花丛/野果树，随季节产出）、每天一次林间奇遇随机事件 |
| 居民 | 6 位镇民，各有行程、生日与喜好；聊天、送礼涨好感，可交往、求婚、结婚 |
| 社区中心 | 4 个房间 13 个收集包，完成解锁温室、矿车、铱金鱼竿、铁匠半价 |
| 成长 | 5 项技能各 10 级、5/10 级选职业；5 件工具 + 武器都有等级、耐久、升级与修理，耐久耗尽会报废成金属碎片 |
| 长期目标 | 每季节日、技能职业、第 3 年春天爷爷评分（1–4 根蜡烛） |

**一天的循环**：6:00 起床 → 规划行程做事（每个动作都耗时间和体力）→ 晚上回农场睡觉（出货结算、作物生长、存档）→ 次日。凌晨 2 点不睡会昏倒扣医药费。

---

## 快速开始

### 环境要求

- Node.js **>= 20**（见 `package.json` 的 `engines`）
- npm（随 Node 附带）

### 安装

```bash
git clone <仓库地址>
cd StardewValley
npm install
```

### 玩终端版（最简单，不用克隆）

已发布到 npm，任意终端（需要 Node.js >= 20）直接运行：

```bash
npx qinghe-valley-tales
```

- 首次运行会从 npm 自动下载（约几十 KB），之后输数字选菜单或敲命令（`?` 查看全部命令），`quit` 退出。
- 存档自动保存在**你运行命令时所在目录**的 `saves/slot1.json`，下次在同一目录再运行就接着玩；想换存档位置可用环境变量 `QINGHE_SAVE_DIR=/path/to/dir`。
- 可选参数：`npx qinghe-valley-tales -- --seed 42` 用固定随机种子开局（结果可复现，方便调试）。

### 玩终端版（克隆源码方式，适合开发）

```bash
git clone git@github.com:OldCoffee/qinghe-valley-tales.git
cd qinghe-valley-tales
npm install
npm start
```

### 玩网页版

网页版需要先打包，再用任意静态文件服务器打开 `web/` 目录：

```bash
npm run build:web        # 生成 web/app.js
cd web && python3 -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765/
```

也可以用 `npx serve web` 等任意静态服务器。直接双击 `web/index.html` 在部分浏览器也能运行，但推荐走本地服务器。

**界面操作**：

- 顶部 HUD 的「📍 当前地点」是唯一的切换地点入口，点它打开地图弹窗选目的地；
- 上方四个页签整页切换：场景 / 背包与装备 / 社交与镇民 / 手册与收集；
- 点农田格子弹出该格的操作浮层；点物品、工具、居民、收集包房间会打开对应弹窗；
- 右上角「终端模式（高级）」可以在网页里打开和终端版相同的文字界面，与可视化版共用同一存档。

---

## 开发说明

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm start` | 启动终端版（`tsx` 直接跑 TypeScript，无需预编译） |
| `npm run build:cli` | 用 esbuild 把终端版打包成单文件 `dist/cli.js`（带 shebang，npm 包的入口） |
| `npm run build:web` | 用 esbuild 把 `src/web/main.ts` 打包成 `web/app.js`（压缩、IIFE） |
| `npm test` | 运行全部单元测试（vitest） |
| `npm run typecheck` | TypeScript 类型检查（`tsc --noEmit`） |

改完代码的标准验证流程：

```bash
npm run typecheck && npm test && npm run build:web
```

### 项目结构

```
src/
  data/          # 纯数据定义（改内容优先改这里，不改逻辑）
    config.ts    # 全局数值：时间、体力、成本、耐久、工具升级表…
    crops.ts     # 作物：季节、生长天数、售价
    items.ts     # 物品总表（由作物/鱼/采集物/矿石等自动汇总生成）
    fish.ts      # 鱼种：地点、季节、天气、时段、难度
    forage.ts    # 野外采集物与每日刷新量
    forest.ts    # 森林固定采集点（蘑菇圈/野花丛/野果树）
    mine.ts      # 矿石、宝石、怪物、武器、每 10 层宝箱
    npcs.ts      # 镇民：行程、喜好、生日、对话、心事件挂钩
    bundles.ts   # 社区中心房间与收集包
    shops.ts     # 商店：营业时间、货架、收购类别
    skills.ts    # 技能名、经验曲线、职业
    world.ts     # 地点、移动耗时、天气文案
    festivals.ts / events.ts   # 节日与心事件
  engine/        # 游戏引擎（纯状态机，不依赖任何 UI）
    types.ts     # GameState、Action、事件等核心类型
    actions.ts   # 唯一入口 applyAction(state, action) -> { state, events, ok }
    state.ts     # 新游戏初始状态
    day.ts       # 过夜结算：出货、生长、天气、森林/采集刷新、评分
    systems/     # 各子系统：farming / fishing / mine / forest / social /
                 # economy / equipment（耐久装备）/ tools / bundles / festivals…
  ui/            # 终端 UI：菜单、命令解析（中英文别名）、渲染
  cli/           # 终端入口：存档读写、命令行参数
  web/           # 网页 UI
    main.ts      # 可视化界面（四大整页 + 弹窗 + 微动效，全部逻辑在这一文件）
    terminal.ts  # 网页内嵌终端模式（复用 ui/ 的会话逻辑）
web/
  index.html     # 网页版页面与全部 CSS（像素风样式、动画）
  app.js         # 打包产物（已 gitignore，不要手改，改 src/web 后重新 build）
tests/           # vitest 单元测试（按系统分文件，helpers.ts 提供 freshGame/run 工具）
docs/PRD.md      # 产品设计文档与版本决策记录
design-system/   # 网页版设计系统与页面覆盖规范
```

### 架构约定

- **引擎与 UI 完全分离**：引擎只做 `(state, action) → (newState, events[])`，不打印、不读文件。终端、网页可视化、网页内嵌终端三种前端都调用同一个 `applyAction`。
- **数据驱动**：加一种作物/鱼/物品，优先在 `src/data/` 加一条定义，`items.ts` 会自动汇总；只有引入新机制时才改 `engine/systems/`。
- **可复现随机**：随机种子存在存档里（`rngState`），同一存档同一步操作结果一致，测试因此可以写确定性断言。
- **存档兼容**：`GameState.version` 为存档版本；新增状态字段时要在 `ensureEquipment` / `ensureForest` 一类迁移函数里给老存档补默认值，不要直接升版本丢弃老存档。

### 存档位置

| 前端 | 位置 |
| --- | --- |
| 终端版 | `saves/slot1.json`（已 gitignore）；可用环境变量 `QINGHE_SAVE_DIR` 改目录；`NO_COLOR=1` 关闭终端颜色 |
| 网页版 | 浏览器 `localStorage`，键名 `qinghe-valley-save`；网页内嵌终端模式共用这份存档 |

注意：终端版和网页版的存档互相独立。网页版换浏览器或清缓存会丢档，重要存档可从开发者工具里导出 localStorage 内容备份。

---

## 部署说明（网页版）

网页版是纯静态站点，部署只需两步：**安装依赖并打包，然后把 `web/` 目录发布出去**。

```bash
npm ci                  # 按 package-lock.json 精确安装（CI/服务器推荐）
npm run build:web       # 生成 web/app.js
```

### 方式一：任意静态托管（GitHub Pages / Netlify / Vercel / 对象存储）

- 构建命令：`npm run build:web`
- 发布目录：`web/`
- 无需任何服务端运行时；存档在玩家浏览器本地，不同玩家互不影响。

以 GitHub Pages 为例：把仓库推到 GitHub 后，在 Actions 里用 Node 20 执行上面两条命令，再把 `web/` 作为 Pages 工件上传即可（`web/app.js` 被 gitignore，必须在 CI 里现打包，不能只推源码）。

### 方式二：自己的服务器（nginx 示例）

```bash
npm ci && npm run build:web
```

把 `web/` 拷到服务器后：

```nginx
server {
    listen 80;
    server_name your-domain.example;
    root /var/www/qinghe/web;
    index index.html;
    location / {
        try_files $uri $uri/ =404;
    }
}
```

### 方式三：本地/局域网临时分享

```bash
npm run build:web
cd web && python3 -m http.server 8765
```

同一局域网的人访问 `http://<你的内网IP>:8765/` 即可游玩（各自存档独立）。

### 部署注意事项

- **`web/app.js` 不在仓库里**：每次改了 `src/` 下的代码，都要重新 `npm run build:web` 再发布，只更新 `web/index.html` 不会带上新逻辑。
- **字体走 Google Fonts CDN**：`web/index.html` 引用了 Press Start 2P / VT323；无外网环境会自动回退系统等宽字体，不影响游玩。
- **没有后端、没有账号系统**：所有状态在浏览器 localStorage，不收集任何数据。

---

## 发布终端版到 npm（维护者）

终端版以单文件包发布，玩家 `npx qinghe-valley-tales` 即可游玩。发布流程：

```bash
npm login              # 首次需要在浏览器完成 npm 登录
npm version patch      # 按需改版本号（patch/minor/major）
npm publish            # 发布；prepublishOnly 会自动跑类型检查、测试并重新构建 dist/cli.js
```

- 包入口是 `dist/cli.js`（esbuild 打包的单文件，已带可执行权限），`files` 白名单只发布 `dist`；`dist/` 本身被 gitignore，不进 Git 仓库。
- 发版前可用 `npm pack` 生成 tarball，在空目录用 `npx --package ./qinghe-valley-tales-<版本>.tgz qinghe-valley-tales` 先本地验证一次再正式发布。

---

## 测试

```bash
npm test                          # 全部测试
npx vitest run tests/mine.test.ts # 只跑某个文件
```

测试按系统拆分（农场、矿洞、经济、社交、装备、室外、进度、命令解析），写新机制时请在对应文件里补用例；`tests/helpers.ts` 的 `freshGame()` 提供晴天、全草地农场的确定性开局。

---

## 版本与文档

- 产品设计与历次决策（含 v1.1 可视化、v1.2 装备耐久、v1.3 多页面弹窗、v1.4 矿洞提示与森林扩充）：[docs/PRD.md](docs/PRD.md)
- 网页版配色、布局与动效规范：[design-system/default/pages/web-game.md](design-system/default/pages/web-game.md)
