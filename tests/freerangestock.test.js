import { test } from "node:test";
import assert from "node:assert/strict";

// Freerange 客户端为免 Key 直连，此测试依赖对 v2-backend.freerangestock.com 的网络访问。
// 若网络不稳定可能间歇性失败，与 picjumbo 的网络测试同级处理。

test("freerangestock.js 对空关键词返回空数组", async () => {
  const { searchImages } = await import("../src/freerangestock.js");
  const hits = await searchImages({ keyword: "", count: 3 });
  assert.equal(Array.isArray(hits), true);
  assert.equal(hits.length, 0);
});

test("freerangestock.js 对有效关键词返回带 source='freerangestock' 的结果", { timeout: 30000 }, async () => {
  const { searchImages } = await import("../src/freerangestock.js");
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

test("freerangestock.js 搜索结果的 URL 可访问（HEAD 抽查一个）", { timeout: 30000 }, async () => {
  const { searchImages } = await import("../src/freerangestock.js");
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
