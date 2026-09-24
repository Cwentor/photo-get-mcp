import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFileName } from "../scripts/downloader.mjs";

// downloader 纯函数测试（离线）：文件名生成与扩展名推断。

test("buildFileName 忽略 URL query string 推断扩展名", () => {
  const hit = {
    id: 42,
    tags: "cat, animal",
    webformatURL: "https://images.pexels.com/photos/42/pexels-photo-42.jpeg?h=350&w=500&dl=cat.jpg",
  };
  const name = buildFileName(hit);
  assert.ok(name.endsWith(".jpeg"), `扩展名应为 .jpeg，实际: ${name}`);
  assert.ok(name.startsWith("42-"), `文件名应以 id 开头: ${name}`);
});

test("buildFileName 对 SVG 图标 URL 推断 .svg 扩展名", () => {
  const hit = {
    id: "148533",
    tags: "parking",
    webformatURL: "https://static.thenounproject.com/svg_clean/148533.svg?Expires=123&Signature=abc",
  };
  assert.ok(buildFileName(hit).endsWith(".svg"));
});

test("buildFileName 透传 source 字段生成文件名", () => {
  const hit = {
    id: "test-1",
    source: "picjumbo",
    user: "picjumbo",
    tags: "nature",
    previewURL: "https://example.com/preview.jpg",
    webformatURL: "https://example.com/web.jpg",
    largeImageURL: "https://example.com/large.jpg",
    imageWidth: 100,
    imageHeight: 100,
  };
  const fileName = buildFileName(hit);
  assert.ok(fileName.length > 0);
  assert.ok(fileName.includes("test-1") || fileName.includes("nature"), "文件名应包含 id 或 tag");
});

test("buildFileName 能处理无 source 字段的 hit（兼容老数据）", () => {
  const hit = {
    id: "legacy-1",
    user: "someone",
    tags: "cat",
    previewURL: "https://example.com/p.jpg",
    webformatURL: "https://example.com/w.jpg",
    largeImageURL: "https://example.com/l.jpg",
    imageWidth: 100,
    imageHeight: 100,
  };
  const fileName = buildFileName(hit);
  assert.ok(fileName.length > 0);
});
