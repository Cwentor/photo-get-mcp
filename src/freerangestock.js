import { fileURLToPath } from "node:url";
import path from "node:path";

// Freerange Stock（freerangestock.com）免费图库搜索客户端，无需 API Key。
// 官网在用的公开后端搜索接口（已在浏览器中抓包确认）：
//   POST https://v2-backend.freerangestock.com/api/v1/image/search
//   Body: {"search": KEYWORD, "gallery_id": "all", "page": N, "items": N,
//          "filter": "popular-30", "type": "search all", "licenseType": ""}
// 图片直链位于 result[].images[]（legacy.freerangestock.com 的 thumbnail / sample 路径）。
// 官方"Free Photo API"（freerangestock.com/free_photo_api.php）需联系官方审批发 Key，
// 此处使用的是站点自身前端调用的公开搜索接口，能力等价且无需 Key。
const SEARCH_ENDPOINT = "https://v2-backend.freerangestock.com/api/v1/image/search";
const MAX_ITEMS_PER_PAGE = 100;

export class FreerangeApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "FreerangeApiError";
    this.statusCode = statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
  }
}

function slugifyTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// 将 Freerange 的 result item 映射为项目统一的 hit 结构。纯函数，便于单元测试。
export function mapFreerangePhoto(item, keyword = "") {
  const images = (item && item.images) || [];
  const uploaded = ((item && item.uploaded_images) || [])[0] || {};
  const photoId = (item && item.id) || uploaded.reference_id || "";
  const filename = uploaded.filename || "";
  const uploadId = uploaded.id || "";
  const photographer = (item && item.photographer_obj) || {};

  let thumbnailUrl = "";
  let sampleUrl = "";
  if (images[0]) {
    thumbnailUrl = images[0].thumbnail || "";
    sampleUrl = images[0].image || "";
  }
  if (!thumbnailUrl && uploadId && filename) {
    thumbnailUrl = `https://legacy.freerangestock.com/thumbnail/${uploadId}/${filename}`;
  }
  if (!sampleUrl && uploadId && filename) {
    sampleUrl = `https://legacy.freerangestock.com/sample/${uploadId}/${filename}`;
  }

  const tags = (item && item.keywords) || (item && item.title) || keyword || "freerange photo";
  const title = (item && item.title) || "";
  const slug = slugifyTitle(title);
  const pageURL = photoId && slug ? `https://freerangestock.com/photo/${photoId}/${slug}` : "";

  return {
    id: photoId ? String(photoId) : `freerange-${Math.abs(hashStr(String(pageURL || title)))}`,
    source: "freerangestock",
    user: photographer.display_name || photographer.name || "freerangestock",
    tags,
    title,
    previewURL: thumbnailUrl,
    // sample 是 Freerange 对外提供的最大尺寸（无 original 直链）
    webformatURL: sampleUrl || thumbnailUrl,
    largeImageURL: sampleUrl || thumbnailUrl,
    imageWidth: uploaded.width_l || 0,
    imageHeight: uploaded.height_l || 0,
    pageURL,
  };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export async function searchImages({ keyword, count = 10 }) {
  if (!keyword || !String(keyword).trim()) {
    return [];
  }

  const target = Math.max(1, Math.min(count, 200));
  const hits = [];
  const seen = new Set();
  let page = 1;

  while (hits.length < target) {
    const items = Math.min(target - hits.length, MAX_ITEMS_PER_PAGE);
    const body = JSON.stringify({
      search: String(keyword).trim(),
      gallery_id: "all",
      page,
      items,
      filter: "popular-30",
      type: "search all",
      licenseType: "",
    });

    let response;
    try {
      response = await fetch(SEARCH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://freerangestock.com",
          Referer: "https://freerangestock.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body,
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      throw new NetworkError(err.message || "Network request failed");
    }

    if (response.status !== 200) {
      const text = await response.text().catch(() => "");
      throw new FreerangeApiError(
        `Freerange API returned status ${response.status}: ${text}`.trim(),
        response.status
      );
    }

    const data = await response.json();
    const results = data.result || [];

    if (results.length === 0) break;

    for (const item of results) {
      if (hits.length >= target) break;
      const hit = mapFreerangePhoto(item, keyword);
      const key = `${hit.source}-${hit.id}`;
      if (!hit.previewURL && !hit.webformatURL) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(hit);
    }

    if (results.length < items) break;
    page += 1;
    if (page > 20) break; // 防御性上限
  }

  return hits;
}

const __filename = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const keyword = process.argv[2] || "nature";
  const count = parseInt(process.argv[3] || "5", 10);
  searchImages({ keyword, count })
    .then((hits) => {
      console.log(`[freerangestock] Got ${hits.length} hits for keyword="${keyword}"`);
      hits.slice(0, 5).forEach((h) => console.log(` - #${h.id} by ${h.user}: ${h.tags.slice(0, 60)}`));
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[freerangestock] Error:`, err.message);
      process.exit(1);
    });
}
