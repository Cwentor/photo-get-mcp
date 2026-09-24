<div align="center">

# 📸 photo-get

**Agent Skill：按关键词搜索并下载免版权图片的零依赖 CLI**

一句话指令，从 Pixabay / Picjumbo / Pexels / Freerange / Noun Project / Magnific 搜索免版权图片并直接下载到本地。装进 agent 的 skills 目录后，说"帮我找几张 XX 的图"即可触发。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Deps](https://img.shields.io/badge/dependencies-0-brightgreen)](#-安装)
[![Tests](https://img.shields.io/badge/tests-63%20total-brightgreen)](#-测试)

</div>

---

> **v2.0 重大变更**：本项目已从 MCP 服务器（photo-get-mcp）迁移为 **agent skill 包**。`server.js` 与 `@modelcontextprotocol/sdk`、`zod` 依赖已移除，核心逻辑不变，入口改为零依赖 CLI（`scripts/cli.mjs`），由 skill 指引 agent 通过 shell 调用。已注册旧版 MCP 的用户请改用 skill 安装方式。

## ✨ 功能特性

- 🔍 **按关键词搜索**免版权图片，支持 6 个图库来源
- 🔢 **批量下载** 1–200 张，多来源时自动分配数量并去重
- 👀 **先预览后下载**（`--dry-run` 只搜索不落盘，输出命中列表）
- 📐 **三种尺寸**可选：预览图 / 网络尺寸 / 原始大图
- 🛡️ **安全搜索**过滤成人内容（Pixabay 来源）
- 🔓 **免 Key 即用**：Pixabay（内置公开 Key）+ Freerange（无需 Key）
- 📋 **完整元数据**返回：本地路径、URL、作者、标签、来源等
- ⚠️ **单来源失败不影响整体**：错误记入 `search_warnings`，其余来源照常返回
- 📦 **零依赖**：纯 Node.js ≥ 18 内置模块，无需 `npm install`

## 🖼️ 图片来源

| 来源 | 说明 | API Key |
|:---:| --- |:---:|
| `pixabay` | Pixabay 官方 REST API，结果稳定、元数据完整（宽高、作者等） | 需要¹ |
| `freerangestock` | Freerange Stock 免费图库（freerangestock.com），免 Key、可商用 | 不需要 |
| `pexels` | Pexels 官方 API，高质量摄影图，免费 Key（200 次/小时） | 需要² |
| `picjumbo` | 通过 Web Archive 抓取 picjumbo.com 历史页面解析图片链接，检索较慢 | 不需要 |
| `nounproject` | Noun Project 图标库（约 1000 万个 SVG/PNG **图标**，非照片），OAuth 1.0a 认证 | 需要³ |
| `magnific` | Magnific（原 Freepik API）图库搜索，photo 类型资源；大图走下载端点取原图 | 需要⁴ |

> ¹ 默认内置公开 API Key，可直接使用。
> ² 在 [pexels.com/api/key](https://www.pexels.com/api/key/) 免费申请，设置 `PEXELS_API_KEY`。
> ³ 在 [thenounproject.com/developers/apps](https://thenounproject.com/developers/apps/) 创建，设置 `NOUN_PROJECT_API_KEY` + `NOUN_PROJECT_API_SECRET`。
> ⁴ 在 [Magnific 仪表盘](https://www.magnific.com/user/organization/api-keys) 生成，设置 `MAGNIFIC_API_KEY`（积分制）。
>
> **默认来源为 `pixabay,freerangestock`**——两个免配置来源开箱即用；其余来源配置 Key 后即可用 `--source` 选用。

## 📦 安装

**环境要求：** Node.js ≥ 18（原生 ESM + `fetch`），可访问互联网。**无需 `npm install`**。

### 方式一：安装为 agent skill（推荐）

```powershell
git clone https://github.com/Cat-Drink/photo-get-mcp.git
cd photo-get-mcp
.\install.ps1                        # 安装到 $HOME\.agents\skills\photo-get
# 或指定目录：.\install.ps1 -Destination $HOME\.claude\skills\photo-get
```

Linux / macOS：`./install.sh`

安装后 agent 即按 SKILL.md 的指引通过 shell 调用 CLI。更新 skill 只需 `git pull` 后重跑安装脚本。

### 方式二：直接作为 CLI 使用

```bash
node scripts/cli.mjs --keyword "sunset beach" --count 5 --save-dir D:/images/sunset
```

## 🔑 配置 API Key（可选）

各来源通过环境变量注入 Key，未配置的来源会返回明确的错误提示（记入 `search_warnings` / `source_errors`），不影响其他来源：

| 环境变量 | 来源 | 申请地址 |
| --- |:---:| --- |
| `PHOTO_GET_API_KEY` | pixabay | [pixabay.com/api/docs](https://pixabay.com/api/docs/)（默认已内置，可不配） |
| `PEXELS_API_KEY` | pexels | [pexels.com/api/key](https://www.pexels.com/api/key/)（免费） |
| `NOUN_PROJECT_API_KEY` + `NOUN_PROJECT_API_SECRET` | nounproject | [thenounproject.com/developers/apps](https://thenounproject.com/developers/apps/)（免费创建） |
| `MAGNIFIC_API_KEY` | magnific | [Magnific 仪表盘](https://www.magnific.com/user/organization/api-keys)（积分制） |

```bash
# Linux / macOS
export PEXELS_API_KEY=your_key_here
export NOUN_PROJECT_API_KEY=your_key_here
export NOUN_PROJECT_API_SECRET=your_secret_here
export MAGNIFIC_API_KEY=your_key_here

# Windows (PowerShell)
$env:PEXELS_API_KEY = "your_key_here"
$env:NOUN_PROJECT_API_KEY = "your_key_here"
$env:NOUN_PROJECT_API_SECRET = "your_secret_here"
$env:MAGNIFIC_API_KEY = "your_key_here"
```

`picjumbo` 与 `freerangestock` 来源无需 API Key。

## 🚀 使用方式

### CLI 参数

```bash
node scripts/cli.mjs --keyword <关键词> --save-dir <目录> [选项]
```

| 参数 | 必填 | 默认值 | 说明 |
| --- | :---: | --- | --- |
| `--keyword <kw>` | ✅ | — | 搜索关键词，1–100 字符，如 `nature`、`cat` |
| `--save-dir <dir>` | ✅* | — | 保存目录，不存在会自动创建；*`--dry-run` 模式下可省略 |
| `--count <n>` | — | `10` | 下载数量 1–200，多来源时自动分配 |
| `--size <s>` | — | `webformat` | `preview` / `webformat` / `large`（各来源映射见下表） |
| `--source <list>` | — | `pixabay,freerangestock` | 逗号分隔来源列表 |
| `--no-safesearch` | — | — | 关闭安全搜索（仅对 Pixabay 生效） |
| `--dry-run` | — | — | 只搜索不下载，输出命中列表供预览 |
| `--help` | — | — | 完整帮助 |

支持 `--flag value` 与 `--flag=value` 两种形式。

### 输出协议（agent 友好）

- **成功**：stdout 输出结果 JSON，exit 0
- **失败**：stdout 输出 `{ "error": ..., "issues"? / "source_errors"? }`，exit 1
- **诊断**：人类可读进度走 stderr，**解析结果请只看 stdout 的 JSON 与退出码**

```bash
# 先预览命中（不落盘）
node scripts/cli.mjs --keyword "sunset beach" --count 5 --dry-run

# 确认后下载
node scripts/cli.mjs --keyword "sunset beach" --count 5 --save-dir D:/images/sunset

# 图标：nounproject 是图标库，large 尺寸为 SVG 矢量（需 Key）
node scripts/cli.mjs --keyword "arrow" --count 10 --source nounproject --size large --save-dir D:/icons
```

<details>
<summary><b>📤 返回示例</b>（点击展开）</summary>

```jsonc
{
  "total": 3,
  "sources": ["pixabay", "freerangestock"],
  "source_counts": { "pixabay": 1, "freerangestock": 2 },
  "downloaded": [
    {
      "local_path": "D:/.../nature/164510-child.jpg",
      "original_url": "https://legacy.freerangestock.com/sample/164064/Family_Moments____FZYVYFH6VX.jpg",
      "author": "Family Moments",
      "tags": "family, together, happiness, ...",
      "width": 5616,
      "height": 3744,
      "id": "164510",
      "source": "freerangestock",
      "pixabay_id": "164510" // 向后兼容保留，新代码请用 id + source
    }
    // ...
  ],
  "failed": [],
  "search_warnings": [],  // 单一来源失败（如未配置 Key）会记录在此，不影响整体
  "save_dir": "D:/.../nature",
  "summary": "已下载 3 张图片至 nature，0 张失败。关键词: nature，来源: pixabay, freerangestock"
}
```

`--dry-run` 模式返回 `{ "dry_run": true, "keyword", "sources", "total", "hits": [...], "search_warnings" }`，`hits` 内含各尺寸 URL、作者、宽高，可直接把链接给用户预览。

</details>

**💬 示例指令（装好 skill 后直接对 agent 说）：**

> 帮我从 pexels 搜索 5 张 `sunset beach` 主题的大图，保存到 `D:/images/sunset/`

> 从 freerangestock 和 pixabay 各找几张 `mountain` 保存到 `D:/images/mountain/`

> 帮我从 nounproject 下载 10 个 `arrow` 图标（SVG）到 `D:/icons/`

### 📐 各来源的尺寸对应关系

| 来源 | `preview` | `webformat`（默认） | `large` |
|:---:| --- | --- | --- |
| pixabay | 150px | 640px | 原图 |
| freerangestock | 缩略图 | sample 大图（约 1000px+） | sample（已是公开最大尺寸） |
| pexels | tiny 280px | large 940px | original 原图 |
| picjumbo | 小图 | 中图 | 原图 |
| nounproject | 84px PNG | 200px PNG | SVG 矢量（无 SVG 时回退 200px PNG） |
| magnific | 预览图（约 740px） | 预览图（约 740px） | 原图（走下载端点，逐个解析） |

## 📁 项目结构

```
photo-get/
├── SKILL.md               # Agent skill 入口（触发条件 + 使用指引）
├── scripts/               # 零依赖 CLI（Node ≥ 18，无需 npm install）
│   ├── cli.mjs            # CLI 入口：flags 解析 + JSON 输出协议 + 退出码
│   ├── validate.mjs       # 参数校验与来源归一化（手写，零依赖）
│   ├── search.mjs         # 多来源搜索编排 + 下载编排（含 dry-run）
│   ├── downloader.mjs     # 图片下载 + 目录管理 + 并发控制
│   ├── pixabay.mjs        # Pixabay API 客户端
│   ├── picjumbo.mjs       # Picjumbo 抓取客户端，走 Web Archive
│   ├── pexels.mjs         # Pexels API 客户端
│   ├── freerangestock.mjs # Freerange 免 Key 搜索客户端
│   ├── nounproject.mjs    # Noun Project 图标客户端，OAuth 1.0a 手写签名
│   └── magnific.mjs       # Magnific 图库搜索客户端
├── tests/                 # node --test 测试套件（默认离线，见下）
├── install.ps1 / install.sh  # skill 安装脚本
├── LICENSE
└── README.md
```

## 🧪 测试

```bash
npm test          # 全量套件：默认全离线、确定性（网络用例自动跳过）
npm run test:fast # 跳过 live-sources 套件
```

真实网络测试由 `RUN_LIVE=1` 门控：

```powershell
$env:RUN_LIVE = "1"; npm test        # PowerShell
```
```bash
RUN_LIVE=1 npm test                   # bash
```

覆盖：参数校验与默认值、来源归一化、CLI 参数解析/JSON 协议/退出码、OAuth 1.0a 签名、各客户端 hit 映射、下载文件名与扩展名推断、（RUN_LIVE 下）各来源真实搜索与端到端下载。

```
ℹ tests 63
ℹ pass 51
ℹ skip 12  # 网络用例（默认门控跳过）
ℹ fail 0
```

## 📄 版权与许可

- **Pixabay 图片**：遵循 [Pixabay Content License](https://pixabay.com/service/license-summary/)，免费商用、无需署名。
- **Freerange 图片**：遵循 [Freerange 许可](https://freerangestock.com/licensing.php)，免费商用、无需署名；部分 CC0 画廊作品已进入公有领域。
- **Pexels 图片**：遵循 [Pexels License](https://www.pexels.com/license/)，免费商用、无需署名（禁止转售原图）。
- **Picjumbo 图片**：picjumbo.com 已停止服务，本工具通过 Web Archive 读取其历史页面；遵循原 Picjumbo 免费许可条款。
- **Noun Project 图标**：大多为 [CC-BY 许可](https://thenounproject.com/legal/)，**使用时需按返回的 `tags` 字段中的 attribution 署名**（如 "Parking by I Like Bears from Noun Project"）；免费 API Key 仅可下载公有领域图标。
- **Magnific（Freepik）资源**：freemium 资源遵循 [Freepik 许可](https://www.freepik.com/profile/license/pdf)，**使用时需署名**；premium 资源下载受账号权限限制。
- **本项目代码**：[MIT License](./LICENSE)

## ℹ️ 说明

- **palette.fm**（AI 照片上色）等纯图像处理类 API 不提供按关键词搜索图片的能力，不属于图库搜索来源，故未集成。
- Freerange 官方的 [Free Photo API](https://freerangestock.com/api) 需联系官方审批后发放 Key；本项目使用其网站自身调用的公开搜索接口，能力等价且无需 Key。
- 旧版 MCP 接口的 `search_and_download_images` 工具与 v1.x tag（[v1.2.0](https://github.com/Cat-Drink/photo-get-mcp/tree/v1.2.0)）仍可访问，如需 MCP 形态请固定旧版本。
