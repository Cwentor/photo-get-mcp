---
name: photo-get
description: Use when the user asks to find, search for, preview, or download royalty-free / copyright-free stock photos or icons by keyword and save them locally — triggers include 找图、搜图、配图、下载图片、免版权图片、无版权图片、素材图、找几张图、下载图标、image search、stock photos、free images、royalty-free. Covers Pixabay, Picjumbo, Pexels, Freerange, Noun Project, Magnific.
---

# photo-get

按关键词从 6 个免版权图库搜索并下载图片到本地目录。零依赖 CLI（Node ≥ 18，无需 npm install），脚本位于本 skill 目录的 `scripts/cli.mjs`（相对本 SKILL.md 所在目录解析）。

## 何时使用

用户要**按关键词找图并保存到本地**：找图 / 搜图 / 配图 / 下载素材图 / 免版权图片 / 下载图标。

不适用：只要图片链接展示、不落盘（直接联网搜索即可）；要 AI 生成图片（本工具只搜真实图库）。

## 快速开始

```bash
# 先预览命中（不落盘，推荐）
node <skill目录>/scripts/cli.mjs --keyword "sunset beach" --count 5 --dry-run

# 确认后下载
node <skill目录>/scripts/cli.mjs --keyword "sunset beach" --count 5 --save-dir "D:/images/sunset"
```

完整参数表运行 `--help` 查看。支持 `--flag value` 与 `--flag=value`；保存目录不存在会自动创建。

## 输出协议（必须遵守）

- 判断成败只看**退出码与 stdout 的 JSON**：exit 0 = 成功；exit 1 = 失败（`{error, issues?}` 或 `{error, source_errors?}`）
- 进度诊断走 stderr，不要解析它
- 成功时 `downloaded[].local_path` 是本地文件绝对路径，直接引用；`search_warnings` 是单来源非致命错误

## 来源选择

| 来源 | 特点 | API Key |
|---|---|---|
| `pixabay`（默认） | 照片，元数据全 | 内置公开 Key，免配置 |
| `freerangestock`（默认） | 照片，可商用 | 免 |
| `picjumbo` | 照片，走 Web Archive，**慢** | 免 |
| `pexels` | 高质量摄影 | `PEXELS_API_KEY` |
| `nounproject` | **图标**（SVG/PNG），非照片 | `NOUN_PROJECT_API_KEY` + `NOUN_PROJECT_API_SECRET` |
| `magnific` | Freepik 图库照片 | `MAGNIFIC_API_KEY` |

默认 `pixabay,freerangestock` **零配置可用**。指定来源：`--source pexels,pixabay`。

- 用户要**图标** → `nounproject`
- 用户没配 Key → 只用免 Key 来源；缺 Key 来源的报错会进 `source_errors`，不影响其余来源

## 常见坑

- 忘了 `--save-dir` 且未用 `--dry-run` → exit 1（save_dir 必填）
- `--size`（preview / webformat / large）各来源映射不同，`--help` 有对照表；图标要矢量用 `--size large`（nounproject 返回 SVG）
- picjumbo 慢：该命令至少给 120 秒超时
- 署名义务：nounproject 图标为 CC-BY、magnific（Freepik）需署名——把 `downloaded[].tags` 中的 attribution 转告用户；pixabay / freerange / pexels 免署名
- 下载文件名格式为 `<id>-<tag>.<ext>`，不可指定文件名，向用户报告 `local_path` 即可
