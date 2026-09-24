#!/usr/bin/env node
// photo-get CLI —— agent 通过 shell 调用的唯一入口。
// 协议：stdout 恒定输出 JSON（成功为结果 payload，失败为 {error, issues?/source_errors?}），
//       人类可读诊断走 stderr；成功 exit 0，失败 exit 1。
import { validateArgs } from "./validate.mjs";
import { searchAndDownload, searchOnly } from "./search.mjs";

const USAGE = `photo-get —— 按关键词搜索并下载免版权图片

用法:
  node cli.mjs --keyword <关键词> --save-dir <目录> [选项]
  node cli.mjs --keyword <关键词> --dry-run [选项]

必选参数:
  --keyword <kw>     搜索关键词，1-100 字符，例如 nature、cat、landscape
  --save-dir <dir>   图片保存目录（不存在会自动创建）；--dry-run 模式下可省略

可选参数:
  --count <n>        下载张数，1-200，默认 10
  --size <s>         preview | webformat | large，默认 webformat（约 640px）
  --source <list>    来源，逗号分隔：pixabay, picjumbo, pexels, freerangestock, nounproject, magnific
                     默认 pixabay,freerangestock（两者均免配置）
  --no-safesearch    关闭安全搜索（仅对 Pixabay 生效）
  --dry-run          只搜索不下载，输出命中列表供预览
  --help             显示本帮助

来源与 API Key（环境变量，可选）:
  pixabay        内置公开 Key，可用 PHOTO_GET_API_KEY 覆盖
  freerangestock 免 Key
  picjumbo       免 Key（经 web.archive.org 抓取，速度较慢）
  pexels         需 PEXELS_API_KEY（https://www.pexels.com/api/key/ 免费申请）
  nounproject    需 NOUN_PROJECT_API_KEY + NOUN_PROJECT_API_SECRET（图标库，https://thenounproject.com/developers/apps/）
  magnific       需 MAGNIFIC_API_KEY（https://www.magnific.com/user/organization/api-keys）

输出:
  成功 → stdout JSON（downloaded 列表含本地路径、原始 URL、作者等信息），exit 0
  失败 → stdout JSON（{error, issues?} 或 {error, source_errors?}），exit 1`;

const VALUE_FLAGS = new Set(["keyword", "save-dir", "count", "size", "source"]);
const BOOL_FLAGS = new Set(["no-safesearch", "dry-run", "help"]);

// 解析 argv 为原始对象（不做业务校验，只做形式解析）。
// 支持 --flag value 与 --flag=value 两种形式；未知 flag / 裸位置参数报错。
function parseArgv(argv) {
  const raw = {};
  const issues = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      issues.push({ field: "args", message: `无法识别的参数 '${token}'（仅支持 --flag 形式，--help 查看用法）` });
      continue;
    }
    let name;
    let value;
    let inline;
    const eq = token.indexOf("=");
    if (eq !== -1) {
      name = token.slice(2, eq);
      value = token.slice(eq + 1);
      inline = true;
    } else {
      name = token.slice(2);
      value = undefined;
      inline = false;
    }
    const norm = name.toLowerCase();
    if (VALUE_FLAGS.has(norm)) {
      if (!inline) {
        value = argv[++i];
        if (value === undefined) {
          issues.push({ field: norm, message: `--${norm} 需要一个值` });
          continue;
        }
      }
      if (norm === "save-dir") {
        raw.save_dir = value;
      } else if (norm === "count") {
        // 能转数字则转，转不动保留原值交给校验层报错
        const n = Number(value);
        raw.count = Number.isFinite(n) ? n : value;
      } else {
        raw[norm] = value;
      }
    } else if (BOOL_FLAGS.has(norm)) {
      if (norm === "no-safesearch") raw.safesearch = false;
      else if (norm === "dry-run") raw.dryRun = true;
      else raw.help = true;
    } else {
      issues.push({ field: "args", message: `未知参数 --${norm}（--help 查看用法）` });
    }
  }
  return { raw, issues };
}

function printJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

function fail(obj) {
  printJson(obj);
  process.exit(1);
}

async function main() {
  const { raw, issues: parseIssues } = parseArgv(process.argv.slice(2));

  if (raw.help) {
    process.stdout.write(USAGE + "\n");
    process.exit(0);
  }

  if (parseIssues.length > 0) {
    fail({ error: "参数校验失败", issues: parseIssues });
  }

  const validated = validateArgs(raw);
  if (!validated.ok) {
    fail({ error: "参数校验失败", issues: validated.issues });
  }

  const args = validated.value;
  process.stderr.write(
    `[photo-get] ${args.dryRun ? "dry-run 搜索" : "搜索并下载"} keyword="${args.keyword}" ` +
      `sources=${args.sources.join(",")} count=${args.count} size=${args.size}\n`
  );

  const run = args.dryRun ? searchOnly : searchAndDownload;
  let result;
  try {
    result = await run(args);
  } catch (err) {
    result = { ok: false, error: `未知错误: ${err && err.message ? err.message : String(err)}` };
  }

  if (!result.ok) {
    const payload = { error: result.error };
    if (Array.isArray(result.source_errors) && result.source_errors.length > 0) {
      payload.source_errors = result.source_errors;
    }
    fail(payload);
  }

  printJson(result.payload);
  process.exit(0);
}

main().catch((err) => {
  printJson({ error: `未知错误: ${err && err.message ? err.message : String(err)}` });
  process.exit(1);
});
