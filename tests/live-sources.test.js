import { test } from "node:test";
import assert from "node:assert/strict";

// 真实网络测试套件：所有用例由 RUN_LIVE=1 门控（默认 npm test 全离线、确定性）。
// Keyed 来源额外要求配置对应环境变量：
//   PEXELS_API_KEY=...                          （https://www.pexels.com/api/key/）
//   NOUN_PROJECT_API_KEY=... NOUN_PROJECT_API_SECRET=... （https://thenounproject.com/developers/apps/）
//   MAGNIFIC_API_KEY=...                        （https://www.magnific.com/user/organization/api-keys）
// 运行：PowerShell:  $env:RUN_LIVE='1'; npm test
//       bash:        RUN_LIVE=1 npm test

const live = process.env.RUN_LIVE === "1";
const hasPexels = Boolean(process.env.PEXELS_API_KEY);
const hasNoun =
  Boolean(process.env.NOUN_PROJECT_API_KEY) && Boolean(process.env.NOUN_PROJECT_API_SECRET);
const hasMagnific = Boolean(process.env.MAGNIFIC_API_KEY);

// ---- Pixabay（内置公开 Key） ----

test("pixabay 真实搜索（内置 Key）", { skip: !live, timeout: 30000 }, async () => {
  const { searchImages } = await import("../scripts/pixabay.mjs");
  const hits = await searchImages({ keyword: "nature", count: 3 });
  assert.equal(Array.isArray(hits), true);
  if (hits.length > 0) {
    for (const hit of hits) {
      assert.equal(hit.source, "pixabay");
      assert.ok(hit.id, "hit 应有 id");
      assert.ok(hit.webformatURL, "hit 应有 webformatURL");
    }
  }
});

test("pixabay 小数量（per_page 夹紧到 3）不报 400", { skip: !live, timeout: 30000 }, async () => {
  const { searchImages } = await import("../scripts/pixabay.mjs");
  // 多来源分摊后可能出现 count<3 的场景，验证 per_page 下限夹紧逻辑
  const hits = await searchImages({ keyword: "nature", count: 2 });
  assert.equal(Array.isArray(hits), true);
  assert.ok(hits.length >= 1, "count=2 也应正常返回（Pixabay per_page 最小为 3）");
});

// ---- Picjumbo（免 Key，经 web.archive.org 抓取，较慢） ----

test("picjumbo 对空关键词返回空数组", { skip: !live }, async () => {
  const { searchImages } = await import("../scripts/picjumbo.mjs");
  const hits = await searchImages({ keyword: "", count: 3 });
  assert.equal(Array.isArray(hits), true);
  assert.equal(hits.length, 0);
});

test("picjumbo 对有效关键词返回带 source='picjumbo' 的结果", { skip: !live, timeout: 180000 }, async () => {
  const { searchImages } = await import("../scripts/picjumbo.mjs");
  const hits = await searchImages({ keyword: "nature", count: 2, maxPages: 1 });
  if (hits.length > 0) {
    for (const hit of hits) {
      assert.equal(hit.source, "picjumbo", "每个 hit 应有 source='picjumbo'");
      assert.ok(hit.id !== undefined, "每个 hit 应有 id");
      assert.ok(hit.previewURL || hit.webformatURL || hit.largeImageURL, "每个 hit 至少应有一个图片 URL");
    }
  }
});

// ---- Freerange（免 Key） ----

test("freerangestock 对空关键词返回空数组", { skip: !live }, async () => {
  const { searchImages } = await import("../scripts/freerangestock.mjs");
  const hits = await searchImages({ keyword: "", count: 3 });
  assert.equal(Array.isArray(hits), true);
  assert.equal(hits.length, 0);
});

test("freerangestock 对有效关键词返回带 source='freerangestock' 的结果", { skip: !live, timeout: 30000 }, async () => {
  const { searchImages } = await import("../scripts/freerangestock.mjs");
  const hits = await searchImages({ keyword: "nature", count: 3 });
  assert.equal(Array.isArray(hits), true);
  if (hits.length > 0) {
    for (const hit of hits) {
      assert.equal(hit.source, "freerangestock", "每个 hit 应有 source='freerangestock'");
      assert.ok(hit.id !== undefined, "每个 hit 应有 id");
      assert.ok(
        hit.previewURL || hit.webformatURL || hit.largeImageURL,
        "每个 hit 至少应有一个图片 URL"
      );
      assert.ok(hit.user, "每个 hit 应有 user");
    }
  }
});

test("freerangestock 搜索结果的 URL 可访问（HEAD 抽查一个）", { skip: !live, timeout: 30000 }, async () => {
  const { searchImages } = await import("../scripts/freerangestock.mjs");
  const hits = await searchImages({ keyword: "ocean", count: 2 });
  if (hits.length === 0) {
    return; // 网络或站点不可用时跳过断言
  }
  const url = hits[0].webformatURL || hits[0].previewURL;
  const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) });
  assert.ok(
    response.ok || response.status === 200,
    `图片 URL 应可访问: ${url} (status=${response.status})`
  );
});

// ---- Pexels ----

test(
  "pexels 真实搜索（需 PEXELS_API_KEY）",
  { skip: !(live && hasPexels), timeout: 30000 },
  async () => {
    const { searchImages } = await import("../scripts/pexels.mjs");
    const hits = await searchImages({ keyword: "nature", count: 3 });
    assert.ok(Array.isArray(hits));
    assert.ok(hits.length > 0, "应返回至少 1 个结果");
    for (const hit of hits) {
      assert.equal(hit.source, "pexels");
      assert.ok(hit.id, "hit 应有 id");
      assert.ok(hit.webformatURL, "hit 应有 webformatURL");
    }
  }
);

test("pexels 未配置 Key 时抛出明确错误（离线）", { skip: hasPexels, timeout: 15000 }, async () => {
  const { searchImages, PexelsApiError } = await import("../scripts/pexels.mjs");
  await assert.rejects(
    () => searchImages({ keyword: "nature", count: 1 }),
    (err) => {
      assert.ok(err instanceof PexelsApiError);
      assert.ok(err.message.includes("PEXELS_API_KEY"), "错误信息应包含环境变量名");
      return true;
    }
  );
});

// ---- Noun Project ----

test(
  "nounproject 真实搜索（需 NOUN_PROJECT_API_KEY/SECRET）",
  { skip: !(live && hasNoun), timeout: 30000 },
  async () => {
    const { searchImages } = await import("../scripts/nounproject.mjs");
    const hits = await searchImages({ keyword: "cat", count: 3 });
    assert.ok(Array.isArray(hits));
    assert.ok(hits.length > 0, "应返回至少 1 个图标");
    for (const hit of hits) {
      assert.equal(hit.source, "nounproject");
      assert.ok(hit.id, "hit 应有 id");
      assert.ok(hit.webformatURL, "hit 应有 webformatURL");
    }
  }
);

test("nounproject 未配置凭据时抛出明确错误（离线）", { skip: hasNoun, timeout: 15000 }, async () => {
  const { searchImages, NounProjectApiError } = await import("../scripts/nounproject.mjs");
  await assert.rejects(
    () => searchImages({ keyword: "cat", count: 1 }),
    (err) => {
      assert.ok(err instanceof NounProjectApiError);
      assert.ok(err.message.includes("NOUN_PROJECT_API_KEY"), "错误信息应包含环境变量名");
      return true;
    }
  );
});

// ---- Magnific ----

test(
  "magnific 真实搜索（需 MAGNIFIC_API_KEY）",
  { skip: !(live && hasMagnific), timeout: 30000 },
  async () => {
    const { searchImages } = await import("../scripts/magnific.mjs");
    const hits = await searchImages({ keyword: "nature", count: 3 });
    assert.ok(Array.isArray(hits));
    assert.ok(hits.length > 0, "应返回至少 1 个结果");
    for (const hit of hits) {
      assert.equal(hit.source, "magnific");
      assert.ok(hit.id, "hit 应有 id");
      assert.ok(hit.webformatURL, "hit 应有 webformatURL");
    }
  }
);

test("magnific 未配置 Key 时抛出明确错误（离线）", { skip: hasMagnific, timeout: 15000 }, async () => {
  const { searchImages, MagnificApiError } = await import("../scripts/magnific.mjs");
  await assert.rejects(
    () => searchImages({ keyword: "nature", count: 1 }),
    (err) => {
      assert.ok(err instanceof MagnificApiError);
      assert.ok(err.message.includes("MAGNIFIC_API_KEY"), "错误信息应包含环境变量名");
      return true;
    }
  );
});
