import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// CLI 集成测试：spawn 真实进程，验证 flags 解析、JSON 输出协议与退出码。
// 离线用例（help / 参数校验 / 无 Key 错误路径）默认运行；
// 打真实网络的用例由 RUN_LIVE=1 门控。

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, "../scripts/cli.mjs");
const live = process.env.RUN_LIVE === "1";

function runCli(args, { timeout = 30000 } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      encoding: "utf8",
      timeout,
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout || "", stderr: err.stderr || "" };
  }
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

// ---- --help ----

test("cli --help 退出码 0 且输出用法", () => {
  const { code, stdout } = runCli(["--help"]);
  assert.equal(code, 0);
  assert.ok(stdout.includes("--keyword"), "用法应包含 --keyword");
  assert.ok(stdout.includes("--save-dir"), "用法应包含 --save-dir");
  assert.ok(stdout.includes("--dry-run"), "用法应包含 --dry-run");
  assert.ok(stdout.includes("--source"), "用法应包含 --source");
});

// ---- 参数校验错误（离线，exit 1 + stdout JSON） ----

test("cli 无参数 → exit 1 + JSON 错误，含 keyword 与 save_dir issue", () => {
  const { code, stdout } = runCli([]);
  assert.equal(code, 1);
  const json = parseJson(stdout);
  assert.ok(json, `stdout 应为合法 JSON，实际: ${stdout.slice(0, 200)}`);
  assert.equal(typeof json.error, "string");
  assert.ok(Array.isArray(json.issues));
  const fields = json.issues.map((i) => i.field);
  assert.ok(fields.includes("keyword"), `issues 应含 keyword: ${JSON.stringify(fields)}`);
  assert.ok(fields.includes("save_dir"), `issues 应含 save_dir: ${JSON.stringify(fields)}`);
});

test("cli 缺 --save-dir（非 dry-run）→ exit 1，issue 含 save_dir", () => {
  const { code, stdout } = runCli(["--keyword", "cat"]);
  assert.equal(code, 1);
  const json = parseJson(stdout);
  assert.ok(json, "stdout 应为合法 JSON");
  assert.ok(json.issues.some((i) => i.field === "save_dir"));
});

test("cli --count 500 → exit 1，issue 含 count", () => {
  const { code, stdout } = runCli(["--keyword", "cat", "--save-dir", "tmp/x", "--count", "500"]);
  assert.equal(code, 1);
  const json = parseJson(stdout);
  assert.ok(json.issues.some((i) => i.field === "count"));
});

test("cli --count abc（非数字）→ exit 1", () => {
  const { code } = runCli(["--keyword", "cat", "--save-dir", "tmp/x", "--count", "abc"]);
  assert.equal(code, 1);
});

test("cli --size huge → exit 1，issue 含 size", () => {
  const { code, stdout } = runCli(["--keyword", "cat", "--save-dir", "tmp/x", "--size", "huge"]);
  assert.equal(code, 1);
  const json = parseJson(stdout);
  assert.ok(json.issues.some((i) => i.field === "size"));
});

test("cli 未知 flag → exit 1，错误信息指明未知参数", () => {
  const { code, stdout } = runCli(["--keyword", "cat", "--save-dir", "tmp/x", "--bogus", "1"]);
  assert.equal(code, 1);
  const json = parseJson(stdout);
  assert.ok(json, "stdout 应为合法 JSON");
  assert.ok(json.error.includes("bogus") || JSON.stringify(json).includes("bogus"), "错误应提及未知参数名");
});

test("cli --dry-run 但缺 keyword → exit 1，issue 含 keyword 而非 save_dir", () => {
  const { code, stdout } = runCli(["--dry-run"]);
  assert.equal(code, 1);
  const json = parseJson(stdout);
  const fields = json.issues.map((i) => i.field);
  assert.ok(fields.includes("keyword"));
  assert.ok(!fields.includes("save_dir"), "dry-run 模式下 save_dir 不应必填");
});

test("cli 支持 --keyword=cat 等号形式", () => {
  // 等号形式只验证解析路径：值合法但 count 越界，证明 keyword/save-dir 已被正确读取
  const { code, stdout } = runCli(["--keyword=cat", "--save-dir=tmp/x", "--count", "999"]);
  assert.equal(code, 1);
  const json = parseJson(stdout);
  const fields = json.issues.map((i) => i.field);
  assert.deepEqual(fields, ["count"], `只应报 count 错误，实际: ${JSON.stringify(fields)}`);
});

// ---- 无 Key 来源的错误信封（离线：pexels 在 fetch 前即抛错） ----

test("cli --source pexels 无 Key → exit 1，JSON 错误含 PEXELS_API_KEY", { skip: Boolean(process.env.PEXELS_API_KEY) }, () => {
  const { code, stdout } = runCli(["--keyword", "nature", "--count", "1", "--source", "pexels", "--dry-run"]);
  assert.equal(code, 1);
  const json = parseJson(stdout);
  assert.ok(json, "stdout 应为合法 JSON");
  assert.ok(
    JSON.stringify(json).includes("PEXELS_API_KEY"),
    `错误信息应包含环境变量名，实际: ${stdout.slice(0, 300)}`
  );
});

// ---- 真实网络（RUN_LIVE=1 门控） ----

test("cli --dry-run 真实搜索 → exit 0 + JSON hits", { skip: !live, timeout: 90000 }, () => {
  const { code, stdout } = runCli(["--keyword", "nature", "--count", "2", "--dry-run"]);
  assert.equal(code, 0);
  const json = parseJson(stdout);
  assert.ok(json, "stdout 应为合法 JSON");
  assert.equal(json.dry_run, true);
  assert.ok(json.total >= 1, `应至少命中 1 张，实际: ${json.total}`);
  assert.ok(Array.isArray(json.hits) && json.hits.length >= 1);
  for (const hit of json.hits) {
    assert.ok(hit.id, "hit 应有 id");
    assert.ok(hit.webformatURL || hit.previewURL, "hit 应有图片 URL");
  }
});

test("cli 真实下载 → exit 0 + downloaded 文件落盘", { skip: !live, timeout: 120000 }, () => {
  const dir = path.join(__dirname, "..", "tmp", "cli-e2e");
  fs.rmSync(dir, { recursive: true, force: true });
  const { code, stdout } = runCli(["--keyword", "nature", "--count", "2", "--save-dir", dir]);
  assert.equal(code, 0);
  const json = parseJson(stdout);
  assert.ok(json, "stdout 应为合法 JSON");
  assert.ok(json.downloaded.length >= 1, `应至少下载 1 张，实际: ${json.downloaded.length}`);
  for (const item of json.downloaded) {
    assert.ok(fs.existsSync(item.local_path), `文件应存在: ${item.local_path}`);
    assert.ok(fs.statSync(item.local_path).size > 0, `文件非空: ${item.local_path}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
