import { fileURLToPath } from "node:url";
import path from "node:path";

// Magnific（原 Freepik API）图库搜索客户端
// 文档: https://docs.magnific.com/（Stock content API）
// Key: https://www.magnific.com/user/organization/api-keys 生成（积分制）
// 环境变量: MAGNIFIC_API_KEY
// 认证: 请求头 x-magnific-api-key
const API_BASE = "https://api.magnific.com";
const MAX_LIMIT_PER_PAGE = 100;

export const getApiKey = () => process.env.MAGNIFIC_API_KEY || "";

export class MagnificApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "MagnificApiError";
    this.statusCode = statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
  }
}

async function magnificFetch(pathname, { apiKey, signal } = {}) {
  const key = apiKey || getApiKey();
  const url = `${API_BASE}${pathname}`;

  let response;
  try {
    response = await fetch(url, {
      headers: { "x-magnific-api-key": key },
      signal: signal || AbortSignal.timeout(30000),
    });
  } catch (err) {
    throw new NetworkError(err.message || "Network request failed");
  }

  if (response.status !== 200) {
    const text = await response.text().catch(() => "");
    let message = `Magnific API returned status ${response.status}: ${text}`.trim();
    if (response.status === 401) {
      message =
        "Magnific API Key 无效或未配置：请在环境变量 MAGNIFIC_API_KEY 中设置（可在 https://www.magnific.com/user/organization/api-keys 生成），或从 source 中去掉 'magnific'";
    } else if (response.status === 429) {
      message = "Magnific API 请求频率超限（HTTP 429），请稍后重试";
    }
    throw new MagnificApiError(message, response.status);
  }

  return response.json();
}

// 将 Magnific /v1/resources 的 item 映射为项目统一的 hit 结构。纯函数，便于单元测试。
export function mapMagnificResource(item, keyword = "") {
  const image = (item && item.image) || {};
  const source = (image && image.source) || {};
  const author = (item && item.author) || {};
  const previewUrl = source.url || "";
  const title = (item && item.title) || keyword || "magnific resource";

  // image.source.size 形如 "740x640"
  let width = 0;
  let height = 0;
  const sizeMatch = String(source.size || "").match(/^(\d+)x(\d+)$/);
  if (sizeMatch) {
    width = parseInt(sizeMatch[1], 10);
    height = parseInt(sizeMatch[2], 10);
  }

  return {
    id: item && item.id,
    source: "magnific",
    user: author.name || "magnific",
    tags: title,
    title,
    // 列表接口只提供预览图（img.freepik.com，约 740px）。
    // large 尺寸由 searchImages 在 size='large' 时通过下载端点解析。
    previewURL: previewUrl,
    webformatURL: previewUrl,
    largeImageURL: previewUrl,
    imageWidth: width,
    imageHeight: height,
    pageURL: (item && item.url) || "",
  };
}

// size='large' 时调用下载端点获取原尺寸文件直链，失败则回退预览图。
async function resolveLargeUrls(hits, { apiKey } = {}) {
  for (const hit of hits) {
    try {
      const data = await magnificFetch(
        `/v1/resources/${encodeURIComponent(hit.id)}/download?image_size=original`,
        { apiKey }
      );
      const url = data && data.data && (data.data.url || data.data.signed_url);
      if (url) {
        hit.largeImageURL = url;
      }
    } catch (err) {
      // 单个资源解析失败（如 premium 资源 403）不影响整体，保留预览图
    }
  }
  return hits;
}

export async function searchImages({ keyword, count = 10, size, apiKey }) {
  if (!keyword || !String(keyword).trim()) {
    return [];
  }
  const key = apiKey || getApiKey();
  if (!key) {
    throw new MagnificApiError(
      "Magnific API Key 未配置：请在环境变量 MAGNIFIC_API_KEY 中设置（可在 https://www.magnific.com/user/organization/api-keys 生成），或从 source 中去掉 'magnific'",
      401
    );
  }

  const target = Math.max(1, Math.min(count, 200));
  const hits = [];
  const seen = new Set();
  let page = 1;

  while (hits.length < target && page <= 100) {
    const limit = Math.min(target - hits.length, MAX_LIMIT_PER_PAGE);
    const params = new URLSearchParams({
      term: String(keyword).trim(),
      limit: String(limit),
      page: String(page),
      order: "relevance",
      "filters[content_type]": "photo",
    });

    const data = await magnificFetch(`/v1/resources?${params.toString()}`, { apiKey: key });
    const items = data.data || [];

    if (items.length === 0) break;

    for (const item of items) {
      if (hits.length >= target) break;
      const hit = mapMagnificResource(item, keyword);
      if (!hit.id || !hit.webformatURL) continue;
      if (seen.has(String(hit.id))) continue;
      seen.add(String(hit.id));
      hits.push(hit);
    }

    if (items.length < limit) break;
    page += 1;
  }

  if (size === "large" && hits.length > 0) {
    await resolveLargeUrls(hits, { apiKey: key });
  }

  return hits;
}

const __filename = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const keyword = process.argv[2] || "nature";
  const count = parseInt(process.argv[3] || "5", 10);
  const size = process.argv[4] || "webformat";
  searchImages({ keyword, count, size })
    .then((hits) => {
      console.log(`[magnific] Got ${hits.length} hits for keyword="${keyword}" (size=${size})`);
      hits.slice(0, 5).forEach((h) => console.log(` - #${h.id} by ${h.user}: ${h.title.slice(0, 60)}`));
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[magnific] Error:`, err.message);
      process.exit(1);
    });
}
