import { fileURLToPath } from "node:url";
import path from "node:path";

// Pexels API 文档: https://www.pexels.com/api/documentation/
// Key 免费申请: https://www.pexels.com/api/key/
// 环境变量: PEXELS_API_KEY
const API_BASE = "https://api.pexels.com/v1";
const MAX_PER_PAGE = 80;

export const getApiKey = () => process.env.PEXELS_API_KEY || "";

export class PexelsApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "PexelsApiError";
    this.statusCode = statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
  }
}

// 将 Pexels 的 photo 对象映射为项目统一的 hit 结构。
// 纯函数，便于单元测试。
export function mapPexelsPhoto(photo, keyword = "") {
  const src = (photo && photo.src) || {};
  const alt = (photo && photo.alt) || "";
  return {
    id: photo && photo.id,
    source: "pexels",
    user: (photo && photo.photographer) || "pexels",
    tags: alt ? alt : keyword || "pexels photo",
    previewURL: src.tiny || src.small || src.medium || src.original || "",
    webformatURL: src.large || src.medium || src.tiny || src.original || "",
    largeImageURL: src.original || src.large2x || src.large || "",
    imageWidth: (photo && photo.width) || 0,
    imageHeight: (photo && photo.height) || 0,
    pageURL: (photo && photo.url) || "",
  };
}

export async function searchImages({ keyword, count = 10, apiKey }) {
  if (!keyword || !String(keyword).trim()) {
    return [];
  }
  const key = apiKey || getApiKey();
  if (!key) {
    throw new PexelsApiError(
      "Pexels API Key 未配置：请在环境变量 PEXELS_API_KEY 中设置（可在 https://www.pexels.com/api/key/ 免费申请），或从 source 中去掉 'pexels'",
      401
    );
  }

  const target = Math.max(1, Math.min(count, 500));
  const hits = [];
  let page = 1;

  while (hits.length < target) {
    const perPage = Math.min(target - hits.length, MAX_PER_PAGE);
    const url = `${API_BASE}/search?query=${encodeURIComponent(String(keyword).trim())}&per_page=${perPage}&page=${page}`;

    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: key },
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      throw new NetworkError(err.message || "Network request failed");
    }

    if (response.status !== 200) {
      const text = await response.text().catch(() => "");
      let message = `Pexels API returned status ${response.status}: ${text}`.trim();
      if (response.status === 401) {
        message =
          "Pexels API Key 无效或未配置：请检查环境变量 PEXELS_API_KEY（可在 https://www.pexels.com/api/key/ 免费申请）";
      } else if (response.status === 429) {
        message = "Pexels API 请求频率超限（免费额度 200 次/小时、20000 次/月），请稍后重试";
      }
      throw new PexelsApiError(message, response.status);
    }

    const data = await response.json();
    const photos = data.photos || [];

    for (const photo of photos) {
      if (hits.length >= target) break;
      hits.push(mapPexelsPhoto(photo, keyword));
    }

    if (photos.length === 0 || !data.next_page) break;
    page += 1;
    if (page > 20) break; // 防御性上限
  }

  return hits;
}

const __filename = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const keyword = process.argv[2] || "nature";
  const count = parseInt(process.argv[3] || "3", 10);
  searchImages({ keyword, count })
    .then((hits) => {
      console.log(`[pexels] Got ${hits.length} hits for keyword="${keyword}"`);
      hits.slice(0, 3).forEach((h) => console.log(` - #${h.id} by ${h.user}: ${h.tags}`));
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[pexels] Error:`, err.message);
      process.exit(1);
    });
}
