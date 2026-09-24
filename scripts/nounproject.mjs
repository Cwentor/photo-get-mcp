import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

// Noun Project Icon API（图标库，返回 SVG/PNG 图标，而非照片）
// 文档: https://api.thenounproject.com/documentation.html
// Key/Secret: https://thenounproject.com/developers/apps/ 创建（免费）
// 环境变量: NOUN_PROJECT_API_KEY + NOUN_PROJECT_API_SECRET
// 认证: OAuth 1.0a（两腿，仅 key+secret 签名，无 access token），
//       用 node:crypto 手写 HMAC-SHA1 签名，不引入新依赖。
// 注意: Noun Project 图标大多为 CC-BY 许可，使用时需按 attribution 字段署名。
const API_BASE = "https://api.thenounproject.com";
const MAX_LIMIT_PER_PAGE = 50;

export const getApiKey = () => process.env.NOUN_PROJECT_API_KEY || "";
export const getApiSecret = () => process.env.NOUN_PROJECT_API_SECRET || "";

export class NounProjectApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "NounProjectApiError";
    this.statusCode = statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
  }
}

// RFC 3986 percent-encoding（encodeURIComponent 不转义 ! ' ( ) *）
export function pctEncode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

// 生成 OAuth 1.0a Authorization 头（HMAC-SHA1 签名）。
// queryParams: 参与签名的 URL query 参数（不包含 oauth_* 参数）。
export function buildOAuth1Header({
  method = "GET",
  url,
  queryParams = {},
  consumerKey,
  consumerSecret,
  nonce,
  timestamp,
}) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...queryParams };
  // 按 RFC 3986：先编码，再按 key/value 字节序排序
  const pairs = Object.entries(allParams)
    .map(([k, v]) => [pctEncode(k), pctEncode(v)])
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  const paramString = pairs.map(([k, v]) => `${k}=${v}`).join("&");

  const baseUrl = String(url).split("?")[0];
  const baseString = [
    method.toUpperCase(),
    pctEncode(baseUrl),
    pctEncode(paramString),
  ].join("&");

  const signingKey = `${pctEncode(consumerSecret)}&`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.entries(headerParams)
      .map(([k, v]) => `${pctEncode(k)}="${pctEncode(v)}"`)
      .join(", ")
  );
}

// 将 Noun Project 的 icon 对象映射为项目统一的 hit 结构。纯函数，便于单元测试。
export function mapNounProjectIcon(icon, keyword = "") {
  const id = (icon && icon.id) || "";
  const term = (icon && icon.term) || keyword || "icon";
  const tagsList = (icon && Array.isArray(icon.tags) && icon.tags.slice(0, 8).join(", ")) || "";
  const attribution = (icon && icon.attribution) || "";
  const creator = (icon && icon.creator && icon.creator.name) || "noun project";
  const thumbnailUrl = (icon && icon.thumbnail_url) || "";
  const iconUrl = (icon && icon.icon_url) || ""; // include_svg=1 时返回（1 小时内有效）

  // static.thenounproject.com/png/{id}-{size}.png，size 支持 42 / 84 / 200
  const png200 = thumbnailUrl || (id ? `https://static.thenounproject.com/png/${id}-200.png` : "");
  const png84 = thumbnailUrl
    ? thumbnailUrl.replace(/-(\d+)\.png$/, "-84.png")
    : id
      ? `https://static.thenounproject.com/png/${id}-84.png`
      : "";

  const tags = [tagsList || term, attribution].filter(Boolean).join(" | ");

  return {
    id: String(id),
    source: "nounproject",
    user: creator,
    tags,
    title: term,
    // 图标为 SVG/PNG 而非照片；preview=84px PNG, webformat=200px PNG, large=SVG(矢量)
    previewURL: png84 || png200,
    webformatURL: png200,
    largeImageURL: iconUrl || png200,
    imageWidth: 0,
    imageHeight: 0,
    pageURL: (icon && icon.permalink)
      ? `https://thenounproject.com${icon.permalink}`
      : id
        ? `https://thenounproject.com/icon/${id}/`
        : "",
  };
}

async function nounProjectGet(pathname, queryParams, { apiKey, apiSecret } = {}) {
  const key = apiKey || getApiKey();
  const secret = apiSecret || getApiSecret();
  if (!key || !secret) {
    throw new NounProjectApiError(
      "Noun Project API 凭证未配置：请在环境变量 NOUN_PROJECT_API_KEY 和 NOUN_PROJECT_API_SECRET 中设置（可在 https://thenounproject.com/developers/apps/ 免费创建），或从 source 中去掉 'nounproject'",
      401
    );
  }

  const url = `${API_BASE}${pathname}`;
  const nonce = crypto.randomBytes(8).toString("hex"); // ≥ 8 字符
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = buildOAuth1Header({
    method: "GET",
    url,
    queryParams,
    consumerKey: key,
    consumerSecret: secret,
    nonce,
    timestamp,
  });

  const search = new URLSearchParams(queryParams).toString();
  const fullUrl = search ? `${url}?${search}` : url;

  let response;
  try {
    response = await fetch(fullUrl, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    throw new NetworkError(err.message || "Network request failed");
  }

  if (response.status !== 200) {
    const text = await response.text().catch(() => "");
    let message = `Noun Project API returned status ${response.status}: ${text}`.trim();
    if (response.status === 401) {
      message =
        "Noun Project API 认证失败：请检查环境变量 NOUN_PROJECT_API_KEY / NOUN_PROJECT_API_SECRET 是否正确";
    } else if (response.status === 429) {
      message = "Noun Project API 调用超出限额（HTTP 429），请稍后重试";
    }
    throw new NounProjectApiError(message, response.status);
  }

  return response.json();
}

export async function searchImages({ keyword, count = 10, apiKey, apiSecret }) {
  if (!keyword || !String(keyword).trim()) {
    return [];
  }

  const target = Math.max(1, Math.min(count, 200));
  const hits = [];
  const seen = new Set();
  let nextPageToken = null;
  let pages = 0;

  while (hits.length < target && pages < 4) {
    const limit = Math.min(target - hits.length, MAX_LIMIT_PER_PAGE);
    const queryParams = {
      query: String(keyword).trim(),
      limit: String(limit),
      thumbnail_size: "200",
      include_svg: "1",
    };
    if (nextPageToken) {
      queryParams.next_page = nextPageToken;
    }

    const data = await nounProjectGet("/v2/icon", queryParams, { apiKey, apiSecret });
    const icons = data.icons || [];

    for (const icon of icons) {
      if (hits.length >= target) break;
      const hit = mapNounProjectIcon(icon, keyword);
      if (!hit.id || !hit.webformatURL) continue;
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push(hit);
    }

    pages += 1;
    if (icons.length === 0 || !data.next_page) break;
    nextPageToken = data.next_page;
  }

  return hits;
}

const __filename = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const keyword = process.argv[2] || "cat";
  const count = parseInt(process.argv[3] || "5", 10);
  searchImages({ keyword, count })
    .then((hits) => {
      console.log(`[nounproject] Got ${hits.length} hits for keyword="${keyword}"`);
      hits.slice(0, 5).forEach((h) => console.log(` - #${h.id} by ${h.user}: ${h.title}`));
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[nounproject] Error:`, err.message);
      process.exit(1);
    });
}
