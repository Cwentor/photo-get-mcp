import { test } from "node:test";
import assert from "node:assert/strict";

// 需要 API Key 的来源：未配置对应环境变量时自动跳过真实网络测试。
// 配置后运行可验证端到端可用性：
//   PEXELS_API_KEY=...            （https://www.pexels.com/api/key/）
//   NOUN_PROJECT_API_KEY=... NOUN_PROJECT_API_SECRET=... （https://thenounproject.com/developers/apps/）
//   MAGNIFIC_API_KEY=...          （https://www.magnific.com/user/organization/api-keys）

const hasPexels = Boolean(process.env.PEXELS_API_KEY);
const hasNoun =
  Boolean(process.env.NOUN_PROJECT_API_KEY) && Boolean(process.env.NOUN_PROJECT_API_SECRET);
const hasMagnific = Boolean(process.env.MAGNIFIC_API_KEY);

// ---- Pixabay（内置公开 Key，依赖网络；容忍偶发限流） ----

test("pixabay.js 真实搜索（内置 Key）", { timeout: 30000 }, async () => {
  const { searchImages } = await import("../src/pixabay.js");
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

test("pixabay.js 小数量（per_page 夹紧到 3）不报 400", { timeout: 30000 }, async () => {
  const { searchImages } = await import("../src/pixabay.js");
  // 多来源分摊后可能出现 count<3 的场景，验证 per_page 下限夹紧逻辑
  const hits = await searchImages({ keyword: "nature", count: 2 });
  assert.equal(Array.isArray(hits), true);
  assert.ok(hits.length >= 1, "count=2 也应正常返回（Pixabay per_page 最小为 3）");
});

// ---- Pexels ----

test(
  "pexels.js 真实搜索（需 PEXELS_API_KEY）",
  { skip: !hasPexels, timeout: 30000 },
  async () => {
    const { searchImages } = await import("../src/pexels.js");
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

test(
  "pexels.js 未配置 Key 时抛出明确错误",
  { skip: hasPexels, timeout: 15000 },
  async () => {
    const { searchImages, PexelsApiError } = await import("../src/pexels.js");
    await assert.rejects(
      () => searchImages({ keyword: "nature", count: 1 }),
      (err) => {
        assert.ok(err instanceof PexelsApiError);
        assert.ok(err.message.includes("PEXELS_API_KEY"), "错误信息应包含环境变量名");
        return true;
      }
    );
  }
);

test(
  "nounproject.js 真实搜索（需 NOUN_PROJECT_API_KEY/SECRET）",
  { skip: !hasNoun, timeout: 30000 },
  async () => {
    const { searchImages } = await import("../src/nounproject.js");
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

test(
  "nounproject.js 未配置凭据时抛出明确错误",
  { skip: hasNoun, timeout: 15000 },
  async () => {
    const { searchImages, NounProjectApiError } = await import("../src/nounproject.js");
    await assert.rejects(
      () => searchImages({ keyword: "cat", count: 1 }),
      (err) => {
        assert.ok(err instanceof NounProjectApiError);
        assert.ok(err.message.includes("NOUN_PROJECT_API_KEY"), "错误信息应包含环境变量名");
        return true;
      }
    );
  }
);

test(
  "magnific.js 真实搜索（需 MAGNIFIC_API_KEY）",
  { skip: !hasMagnific, timeout: 30000 },
  async () => {
    const { searchImages } = await import("../src/magnific.js");
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

test(
  "magnific.js 未配置 Key 时抛出明确错误",
  { skip: hasMagnific, timeout: 15000 },
  async () => {
    const { searchImages, MagnificApiError } = await import("../src/magnific.js");
    await assert.rejects(
      () => searchImages({ keyword: "nature", count: 1 }),
      (err) => {
        assert.ok(err instanceof MagnificApiError);
        assert.ok(err.message.includes("MAGNIFIC_API_KEY"), "错误信息应包含环境变量名");
        return true;
      }
    );
  }
);
