// 搜索与下载编排（原 tools.js 重构：去 zod、去 MCP 信封，返回普通对象；新增 dry-run）。
// 输入约定：调用方（cli.mjs）已通过 validate.mjs 校验归一化，
// 这里信任 { keyword, save_dir, count, size, safesearch, sources } 结构。
import path from "node:path";
import { searchImages as searchPixabay, PixabayApiError, NetworkError } from "./pixabay.mjs";
import { searchImages as searchPicjumbo } from "./picjumbo.mjs";
import { searchImages as searchPexels } from "./pexels.mjs";
import { searchImages as searchFreerange } from "./freerangestock.mjs";
import { searchImages as searchNounProject } from "./nounproject.mjs";
import { searchImages as searchMagnific } from "./magnific.mjs";
import { ensureDir, concurrentDownloadBatch } from "./downloader.mjs";

async function searchFromSource(sourceName, { keyword, count, safesearch, size }) {
  const perSourceCount = Math.max(1, Math.ceil(count));
  if (sourceName === "pixabay") {
    return await searchPixabay({ keyword, count: perSourceCount, safesearch });
  }
  if (sourceName === "picjumbo") {
    return await searchPicjumbo({ keyword, count: perSourceCount });
  }
  if (sourceName === "pexels") {
    return await searchPexels({ keyword, count: perSourceCount });
  }
  if (sourceName === "freerangestock") {
    return await searchFreerange({ keyword, count: perSourceCount });
  }
  if (sourceName === "nounproject") {
    return await searchNounProject({ keyword, count: perSourceCount });
  }
  if (sourceName === "magnific") {
    return await searchMagnific({ keyword, count: perSourceCount, size });
  }
  return [];
}

// 将 count 均摊到各来源，单来源失败不影响整体（错误进 errors）。
// 按 (source, id) 去重，稳定顺序，截断至 count。
export async function searchImagesFromSources(sources, { keyword, count, safesearch, size }) {
  const perSourceCount = Math.max(1, Math.ceil(count / sources.length));
  const results = [];
  const errors = [];
  for (const src of sources) {
    try {
      const hits = await searchFromSource(src, { keyword, count: perSourceCount, safesearch, size });
      results.push(...hits);
    } catch (err) {
      errors.push({ source: src, message: err && err.message ? err.message : String(err) });
    }
  }
  const seen = new Set();
  const unique = [];
  for (const hit of results) {
    const key = `${hit.source || "unknown"}-${hit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
  }
  return { hits: unique.slice(0, count), errors };
}

function describeError(err) {
  if (err instanceof PixabayApiError) {
    return `Pixabay API 错误 (${err.statusCode}): ${err.message}`;
  }
  if (err instanceof NetworkError) {
    return `网络错误: ${err.message}`;
  }
  return `未知错误: ${err && err.message ? err.message : String(err)}`;
}

function emptySearchError(keyword, sources, searchErrors) {
  if (searchErrors.length) {
    return `搜索失败或无结果。来源错误: ${JSON.stringify(searchErrors)}`;
  }
  return `没有找到任何图片。关键词: ${keyword}，来源: ${sources.join(", ")}`;
}

// 只搜索不下载（--dry-run）：输出命中列表，agent 可先给用户预览再决定是否下载。
export async function searchOnly({ keyword, count, size, safesearch, sources }) {
  let result;
  try {
    result = await searchImagesFromSources(sources, { keyword, count, safesearch, size });
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
  const { hits, errors } = result;
  if (hits.length === 0) {
    return { ok: false, error: emptySearchError(keyword, sources, errors), source_errors: errors };
  }
  return {
    ok: true,
    payload: {
      dry_run: true,
      keyword,
      sources,
      total: hits.length,
      hits,
      search_warnings: errors,
    },
  };
}

// 搜索 + 并发下载到本地目录。
export async function searchAndDownload({ keyword, save_dir, count, size, safesearch, sources }) {
  let hits = [];
  let searchErrors = [];
  try {
    const result = await searchImagesFromSources(sources, { keyword, count, safesearch, size });
    hits = result.hits;
    searchErrors = result.errors || [];
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }

  if (hits.length === 0) {
    return {
      ok: false,
      error: emptySearchError(keyword, sources, searchErrors),
      source_errors: searchErrors,
    };
  }

  try {
    ensureDir(save_dir);
  } catch (err) {
    return { ok: false, error: `无法创建目录: ${err.message}` };
  }

  let downloaded = [];
  let failed = [];
  try {
    const result = await concurrentDownloadBatch(hits, save_dir, { size, concurrency: 5 });
    downloaded = result.downloaded || [];
    failed = result.failed || [];
  } catch (err) {
    return { ok: false, error: `下载过程中发生错误: ${err.message}` };
  }

  return {
    ok: true,
    payload: {
      total: hits.length,
      sources,
      source_counts: sources.reduce((acc, s) => {
        acc[s] = hits.filter((h) => (h.source || "pixabay") === s).length;
        return acc;
      }, {}),
      downloaded,
      failed,
      search_warnings: searchErrors,
      save_dir: path.resolve(save_dir),
      summary: `已下载 ${downloaded.length} 张图片至 ${save_dir}，${failed.length} 张失败。关键词: ${keyword}，来源: ${sources.join(", ")}`,
    },
  };
}
