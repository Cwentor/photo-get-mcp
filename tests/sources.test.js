import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPexelsPhoto } from "../scripts/pexels.mjs";
import { mapFreerangePhoto } from "../scripts/freerangestock.mjs";
import { mapMagnificResource } from "../scripts/magnific.mjs";
import { mapNounProjectIcon, buildOAuth1Header, pctEncode } from "../scripts/nounproject.mjs";

// 纯 fixture 映射测试（离线）：验证各来源 API 响应 → 统一 hit 结构。

// ---- Pexels 映射 ----

const pexelsPhotoFixture = {
  id: 415829,
  width: 5472,
  height: 3648,
  url: "https://www.pexels.com/photo/woman-standing-on-beach-415829/",
  photographer: "Hian Oliveira",
  alt: "Woman Standing on Beach",
  src: {
    original:
      "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?cs=srgb&dl=pexels-photo-415829.jpeg",
    large2x: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?w=1260&h=750",
    large: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&w=940",
    medium: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?h=350",
    small: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?h=400",
    tiny: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?h=280",
  },
};

test("mapPexelsPhoto 映射为统一 hit 结构", () => {
  const hit = mapPexelsPhoto(pexelsPhotoFixture, "beach");
  assert.equal(hit.source, "pexels");
  assert.equal(hit.id, 415829);
  assert.equal(hit.user, "Hian Oliveira");
  assert.equal(hit.tags, "Woman Standing on Beach");
  assert.ok(hit.previewURL.includes("h=280"));
  assert.ok(hit.webformatURL.includes("w=940"));
  assert.ok(hit.largeImageURL.includes("cs=srgb"));
  assert.equal(hit.imageWidth, 5472);
  assert.equal(hit.imageHeight, 3648);
});

test("mapPexelsPhoto 对缺失 alt 回退到关键词", () => {
  const hit = mapPexelsPhoto({ ...pexelsPhotoFixture, alt: "" }, "beach");
  assert.equal(hit.tags, "beach");
});

// ---- Freerange 映射 ----

const freerangeFixture = {
  id: 67970,
  title: "Woman Standing on Beach With Arms Outstretched",
  keywords: "woman,standing,beach,arms outstretched,ocean",
  uploaded_images: [
    {
      id: 67558,
      filename: "Lurw1nCIkLc.jpg",
      width_l: 3500,
      height_l: 2333,
    },
  ],
  images: [
    {
      image: "https://legacy.freerangestock.com/sample/67558/Lurw1nCIkLc.jpg",
      thumbnail: "https://legacy.freerangestock.com/thumbnail/67558/Lurw1nCIkLc.jpg",
    },
  ],
  photographer_obj: { name: "Unsplash", display_name: "Unsplash" },
};

test("mapFreerangePhoto 映射为统一 hit 结构", () => {
  const hit = mapFreerangePhoto(freerangeFixture, "beach");
  assert.equal(hit.source, "freerangestock");
  assert.equal(hit.id, "67970");
  assert.equal(hit.user, "Unsplash");
  assert.equal(hit.previewURL, "https://legacy.freerangestock.com/thumbnail/67558/Lurw1nCIkLc.jpg");
  assert.equal(hit.webformatURL, "https://legacy.freerangestock.com/sample/67558/Lurw1nCIkLc.jpg");
  assert.equal(hit.largeImageURL, hit.webformatURL);
  assert.equal(hit.imageWidth, 3500);
  assert.equal(hit.imageHeight, 2333);
  assert.ok(hit.pageURL.includes("/photo/67970/"));
});

test("mapFreerangePhoto 在缺失 images 字段时从 uploaded_images 构造 URL", () => {
  const hit = mapFreerangePhoto({ ...freerangeFixture, images: [] }, "beach");
  assert.equal(
    hit.previewURL,
    "https://legacy.freerangestock.com/thumbnail/67558/Lurw1nCIkLc.jpg"
  );
  assert.equal(
    hit.webformatURL,
    "https://legacy.freerangestock.com/sample/67558/Lurw1nCIkLc.jpg"
  );
});

// ---- Magnific 映射 ----

const magnificFixture = {
  id: 15667327,
  title: "White t-shirt with copy space on gray background",
  url: "https://www.freepik.com/free-photo/white-t-shirt_15667327.htm",
  image: {
    orientation: "horizontal",
    type: "photo",
    source: { size: "740x640", key: "large", url: "https://img.freepik.com/free-photo/tshirt_53876-104920.jpg" },
  },
  author: { name: "John Doe", id: 2147483647 },
};

test("mapMagnificResource 映射为统一 hit 结构", () => {
  const hit = mapMagnificResource(magnificFixture, "t-shirt");
  assert.equal(hit.source, "magnific");
  assert.equal(hit.id, 15667327);
  assert.equal(hit.user, "John Doe");
  assert.equal(hit.webformatURL, "https://img.freepik.com/free-photo/tshirt_53876-104920.jpg");
  assert.equal(hit.imageWidth, 740);
  assert.equal(hit.imageHeight, 640);
});

// ---- Noun Project 映射 ----

const nounIconFixture = {
  id: "148533",
  term: "Parking",
  tags: ["parking", "automobile", "car"],
  attribution: "Parking by I Like Bears from Noun Project",
  creator: { name: "I Like Bears" },
  permalink: "/term/parking/148533",
  thumbnail_url: "https://static.thenounproject.com/png/148533-200.png",
  icon_url: "https://static.thenounproject.com/svg_clean/148533.svg?Expires=123&Signature=abc",
};

test("mapNounProjectIcon 映射为统一 hit 结构（含 SVG 大图）", () => {
  const hit = mapNounProjectIcon(nounIconFixture, "parking");
  assert.equal(hit.source, "nounproject");
  assert.equal(hit.id, "148533");
  assert.equal(hit.user, "I Like Bears");
  assert.equal(hit.previewURL, "https://static.thenounproject.com/png/148533-84.png");
  assert.equal(hit.webformatURL, "https://static.thenounproject.com/png/148533-200.png");
  assert.ok(hit.largeImageURL.includes(".svg"));
  assert.ok(hit.tags.includes("Parking by I Like Bears from Noun Project"));
});

test("mapNounProjectIcon 无 icon_url 时 large 回退 200px PNG", () => {
  const hit = mapNounProjectIcon({ ...nounIconFixture, icon_url: "" }, "parking");
  assert.equal(hit.largeImageURL, "https://static.thenounproject.com/png/148533-200.png");
});

// ---- OAuth 1.0a 签名（Noun Project 用，离线） ----

test("pctEncode 按 RFC 3986 编码", () => {
  assert.equal(pctEncode(" "), "%20");
  assert.equal(pctEncode("!"), "%21");
  assert.equal(pctEncode("*"), "%2A");
  assert.equal(pctEncode("("), "%28");
  assert.equal(pctEncode("'"), "%27");
  assert.equal(pctEncode("A-z09~.-_"), "A-z09~.-_");
  assert.equal(pctEncode("café"), "caf%C3%A9");
});

test("buildOAuth1Header 生成结构正确的 Authorization 头", () => {
  const header = buildOAuth1Header({
    method: "GET",
    url: "https://api.thenounproject.com/v2/icon",
    queryParams: { query: "dog", limit: "10" },
    consumerKey: "test-key",
    consumerSecret: "test-secret",
    nonce: "abcdef1234567890",
    timestamp: 1700000000,
  });
  assert.ok(header.startsWith("OAuth "), "应以 'OAuth ' 开头");
  for (const part of [
    'oauth_consumer_key="test-key"',
    'oauth_nonce="abcdef1234567890"',
    'oauth_signature_method="HMAC-SHA1"',
    'oauth_timestamp="1700000000"',
    'oauth_version="1.0"',
  ]) {
    assert.ok(header.includes(part), `应包含 ${part}，实际: ${header}`);
  }
  const sigMatch = header.match(/oauth_signature="([^"]+)"/);
  assert.ok(sigMatch, "应包含 oauth_signature");
  // 头部中的签名是 percent-encoded 的，解码后校验
  const signature = decodeURIComponent(sigMatch[1]);
  // HMAC-SHA1 输出 20 字节 → base64 定长 28 字符（含 padding）
  assert.equal(signature.length, 28);
  assert.ok(/^[A-Za-z0-9+/]+={0,2}$/.test(signature), "签名应为 base64");
});

test("buildOAuth1Header 确定性：相同输入产生相同签名，key 变化则签名变化", () => {
  const args = {
    method: "GET",
    url: "https://api.thenounproject.com/v2/icon",
    queryParams: { query: "cat", limit: "5" },
    consumerKey: "k",
    consumerSecret: "s",
    nonce: "nonce12345",
    timestamp: 1234567890,
  };
  const h1 = buildOAuth1Header(args);
  const h2 = buildOAuth1Header(args);
  assert.equal(h1, h2);
  const h3 = buildOAuth1Header({ ...args, consumerSecret: "other" });
  assert.notEqual(h1, h3);
});
