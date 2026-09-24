import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArgs, normalizeSources } from "../scripts/validate.mjs";

// ---- normalizeSources（自原 tools.js 搬迁，行为不变） ----

test("normalizeSources 默认返回 ['pixabay','freerangestock']", () => {
  assert.deepEqual(normalizeSources(undefined), ["pixabay", "freerangestock"]);
  assert.deepEqual(normalizeSources(null), ["pixabay", "freerangestock"]);
});

test("normalizeSources 接受单个新来源字符串", () => {
  assert.deepEqual(normalizeSources("pexels"), ["pexels"]);
  assert.deepEqual(normalizeSources("freerangestock"), ["freerangestock"]);
  assert.deepEqual(normalizeSources("nounproject"), ["nounproject"]);
  assert.deepEqual(normalizeSources("magnific"), ["magnific"]);
  assert.deepEqual(normalizeSources("Picjumbo"), ["picjumbo"]);
});

test("normalizeSources 接受逗号分隔字符串并去重", () => {
  assert.deepEqual(normalizeSources("pixabay,pexels"), ["pixabay", "pexels"]);
  assert.deepEqual(normalizeSources("pexels, pexels ,pixabay"), ["pexels", "pixabay"]);
});

test("normalizeSources 接受数组并去重", () => {
  assert.deepEqual(normalizeSources(["pexels", "magnific", "pexels"]), ["pexels", "magnific"]);
});

test("normalizeSources 对非法值回退到默认来源", () => {
  assert.deepEqual(normalizeSources("not-a-source"), ["pixabay", "freerangestock"]);
  assert.deepEqual(normalizeSources(["bad1", "bad2"]), ["pixabay", "freerangestock"]);
});

// ---- validateArgs 校验失败 ----

test("validateArgs 对 keyword='' 校验失败", () => {
  const result = validateArgs({ keyword: "", save_dir: "./tmp/test" });
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.field === "keyword"),
    "应存在 keyword 字段的校验错误"
  );
});

test("validateArgs 对缺失 keyword 校验失败", () => {
  const result = validateArgs({ save_dir: "./tmp/test" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "keyword"));
});

test("validateArgs 对超过 100 字符的 keyword 校验失败", () => {
  const result = validateArgs({ keyword: "a".repeat(101), save_dir: "./tmp/test" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "keyword"));
});

test("validateArgs 对 count=500 校验失败", () => {
  const result = validateArgs({ keyword: "cat", save_dir: "./tmp/test", count: 500 });
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.field === "count"),
    "应存在 count 字段的校验错误"
  );
});

test("validateArgs 对非整数 count 校验失败", () => {
  const result = validateArgs({ keyword: "cat", save_dir: "./tmp/test", count: 2.5 });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "count"));
});

test("validateArgs 对非数字 count 校验失败", () => {
  const result = validateArgs({ keyword: "cat", save_dir: "./tmp/test", count: "10" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "count"));
});

test("validateArgs 对 size='huge' 校验失败", () => {
  const result = validateArgs({ keyword: "cat", save_dir: "./tmp/test", size: "huge" });
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.field === "size"),
    "应存在 size 字段的校验错误"
  );
});

test("validateArgs 非 dry-run 时缺失 save_dir 校验失败", () => {
  const result = validateArgs({ keyword: "cat" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "save_dir"));
});

test("validateArgs dry-run 时允许缺失 save_dir", () => {
  const result = validateArgs({ keyword: "cat", dryRun: true });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.save_dir, undefined);
  }
});

test("validateArgs 对空字符串 save_dir 校验失败", () => {
  const result = validateArgs({ keyword: "cat", save_dir: "" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "save_dir"));
});

test("validateArgs 同时报告多个字段错误", () => {
  const result = validateArgs({ keyword: "", count: 500, size: "huge" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.length >= 3, `应报告 keyword/count/size 三处错误，实际: ${JSON.stringify(result.issues)}`);
});

// ---- validateArgs 合法输入与默认值 ----

test("validateArgs 合法输入通过且默认值正确", () => {
  const result = validateArgs({ keyword: "nature", save_dir: "./tmp/test" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.keyword, "nature");
    assert.equal(result.value.save_dir, "./tmp/test");
    assert.equal(result.value.count, 10);
    assert.equal(result.value.size, "webformat");
    assert.equal(result.value.safesearch, true);
    assert.deepEqual(result.value.sources, ["pixabay", "freerangestock"]);
    assert.equal(result.value.dryRun, false);
  }
});

test("validateArgs 接受字符串 source='pexels'", () => {
  const result = validateArgs({ keyword: "nature", save_dir: "./tmp/test", source: "pexels" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.sources, ["pexels"]);
  }
});

test("validateArgs 接受数组 source 并去重", () => {
  const result = validateArgs({
    keyword: "nature",
    save_dir: "./tmp/test",
    source: ["nounproject", "magnific", "freerangestock", "nounproject"],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.sources, ["nounproject", "magnific", "freerangestock"]);
  }
});

test("validateArgs 对非法 source 回退默认来源", () => {
  const result = validateArgs({ keyword: "nature", save_dir: "./tmp/test", source: "bogus" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.sources, ["pixabay", "freerangestock"]);
  }
});

test("validateArgs 保留显式 safesearch=false", () => {
  const result = validateArgs({ keyword: "nature", save_dir: "./tmp/test", safesearch: false });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.safesearch, false);
  }
});

test("validateArgs 接受 count 边界值 1 与 200", () => {
  const r1 = validateArgs({ keyword: "cat", save_dir: "./tmp/test", count: 1 });
  assert.equal(r1.ok, true);
  const r2 = validateArgs({ keyword: "cat", save_dir: "./tmp/test", count: 200 });
  assert.equal(r2.ok, true);
});

test("validateArgs 接受 100 字符 keyword 边界值", () => {
  const result = validateArgs({ keyword: "a".repeat(100), save_dir: "./tmp/test" });
  assert.equal(result.ok, true);
});

test("validateArgs 保留 dryRun 标志", () => {
  const result = validateArgs({ keyword: "nature", save_dir: "./tmp/x", dryRun: true });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.dryRun, true);
  }
});
