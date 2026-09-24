<div align="center">

# 📸 photo-get-mcp

**基于 Model Context Protocol (MCP) 的多图库图片抓取服务器**

一句话指令，从 Pixabay / Picjumbo / Pexels / Freerange / Noun Project / Magnific 搜索免版权图片并直接下载到本地。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-7c3aed)](https://modelcontextprotocol.io/)
[![Tests](https://img.shields.io/badge/tests-55%20total-brightgreen)](#-测试)

</div>

---

## ✨ 功能特性

- 🔍 **按关键词搜索**免版权图片，支持 6 个图库来源
- 🔢 **批量下载** 1–200 张，多来源时自动分配数量并去重
- 📐 **三种尺寸**可选：预览图 / 网络尺寸 / 原始大图
- 🛡️ **安全搜索**过滤成人内容（Pixabay 来源）
- 🔓 **免 Key 即用**：Pixabay（内置公开 Key）+ Freerange（无需 Key）
- 📋 **完整元数据**返回：本地路径、URL、作者、标签、来源等
- ⚠️ **单来源失败不影响整体**：错误记入 `search_warnings`，其余来源照常返回

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
> **默认来源为 `['pixabay', 'freerangestock']`**——两个免配置来源开箱即用；其余来源配置 Key 后即可在 `source` 参数中选用。

## 📦 安装

```bash
git clone https://github.com/Cat-Drink/photo-get-mcp.git
cd photo-get-mcp
npm install
```

**环境要求：** Node.js ≥ 18（原生 ESM + `fetch`），可访问互联网。

## 🔑 配置 API Key（可选）

各来源通过环境变量注入 Key，未配置的来源会返回明确的错误提示（记入 `search_warnings`），不影响其他来源：

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

### 1️⃣ 作为 MCP 服务器（推荐）

```bash
npm start
```

服务器通过 stdin/stdout 与 MCP 客户端通信。

### 2️⃣ 在 MCP 客户端中配置

**Claude Desktop**（macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`，Windows: `%APPDATA%\Claude\claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "photo-get-mcp": {
      "command": "node",
      "args": [
        "d:/Program/photo-get-mcp/src/server.js"
      ]
    }
  }
}
```

> 路径请替换为你的实际项目路径，Windows 建议使用正斜杠 `/`。同样适用于 Trae、Cursor 等支持 MCP 的客户端。

重启客户端后，助手即可发现并调用 `search_and_download_images` 工具。

### 3️⃣ 命令行测试

```bash
node src/pixabay.js nature 5        # 搜索 Pixabay "nature"
node src/freerangestock.js ocean 3  # 搜索 Freerange "ocean"（免 Key）
node src/pexels.js nature 3        # 搜索 Pexels（需 PEXELS_API_KEY）
node src/nounproject.js cat 5      # 搜索 Noun Project 图标（需 Key/Secret）
node src/magnific.js nature 5      # 搜索 Magnific（需 MAGNIFIC_API_KEY）
node src/picjumbo.js nature 3      # 搜索 Picjumbo（走 Web Archive，较慢）
node src/downloader.js             # 单独测试下载器
```

## 🛠️ MCP 工具

### `search_and_download_images`

按关键词搜索并下载图片到指定目录。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | :---: | :---: | --- | --- |
| `keyword` | `string` | ✅ | — | 搜索关键词，如 `nature`、`cat`、`landscape` |
| `save_dir` | `string` | ✅ | — | 保存目录（绝对/相对路径），不存在会自动创建 |
| `count` | `number` | — | `10` | 下载数量 1–200，多来源时自动分配 |
| `size` | `string` | — | `webformat` | `preview` / `webformat` / `large`（各来源对应尺寸见下表） |
| `safesearch` | `boolean` | — | `true` | 安全搜索（仅对 Pixabay 生效） |
| `source` | `string \| string[]` | — | `["pixabay","freerangestock"]` | `"pexels"`、`"pixabay,pexels"` 或数组，全部来源见上表 |

### 📐 各来源的尺寸对应关系

| 来源 | `preview` | `webformat`（默认） | `large` |
|:---:| --- | --- | --- |
| pixabay | 150px | 640px | 原图 |
| freerangestock | 缩略图 | sample 大图（约 1000px+） | sample（已是公开最大尺寸） |
| pexels | tiny 280px | large 940px | original 原图 |
| picjumbo | 小图 | 中图 | 原图 |
| nounproject | 84px PNG | 200px PNG | SVG 矢量（无 SVG 时回退 200px PNG） |
| magnific | 预览图（约 740px） | 预览图（约 740px） | 原图（走下载端点，逐个解析） |

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

</details>

**💬 示例指令（告诉助手）：**

> 帮我从 pexels 搜索 5 张 `sunset beach` 主题的大图，保存到 `D:/images/sunset/`

> 从 freerangestock 和 pixabay 各找几张 `mountain` 保存到 `D:/images/mountain/`

> 帮我从 nounproject 下载 10 个 `arrow` 图标（SVG）到 `D:/icons/`

## 📁 项目结构

```
photo-get-mcp/
├── src/
│   ├── server.js          # MCP 服务器入口：薄注册层
│   ├── tools.js           # 工具 schema、handler、多来源搜索（单一事实来源）
│   ├── pixabay.js         # Pixabay API 客户端（含 CLI 入口）
│   ├── picjumbo.js        # Picjumbo 抓取客户端，走 Web Archive（含 CLI 入口）
│   ├── pexels.js          # Pexels API 客户端（含 CLI 入口）
│   ├── freerangestock.js  # Freerange 免 Key 搜索客户端（含 CLI 入口）
│   ├── nounproject.js     # Noun Project 图标客户端，OAuth 1.0a 手写签名（含 CLI 入口）
│   ├── magnific.js        # Magnific 图库搜索客户端（含 CLI 入口）
│   └── downloader.js      # 图片下载 + 目录管理 + 并发控制（含 CLI 入口）
├── tests/
│   ├── tools.test.js            # Zod schema 校验测试
│   ├── sources.test.js          # 来源归一化 + 各客户端映射 + OAuth 签名纯函数测试
│   ├── picjumbo.test.js        # source 参数与 picjumbo/downloader 功能测试
│   ├── freerangestock.test.js  # Freerange 免 Key 实测（真实网络）
│   ├── live-sources.test.js    # 有 Key 来源的实测（无 Key 自动跳过）+ Pixabay 实测
│   ├── server-handshake.test.js # MCP 握手测试
│   └── e2e.test.js              # 端到端真实下载测试（默认双来源）
├── tmp/                 # 测试和下载产物（git 忽略）
├── package.json
├── LICENSE
└── README.md
```

## 🧪 测试

```bash
npm test          # 全量测试（含真实网络下载的 e2e）
npm run test:fast # 跳过 e2e，速度快
```

覆盖：参数校验、多来源 schema、来源归一化、OAuth 1.0a 签名、各客户端 hit 映射、MCP 握手、工具列表、真实网络下载。

```
ℹ tests 55
ℹ pass 52
ℹ skip 3   # 需 API Key 的来源实测，未配置 Key 时自动跳过
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
