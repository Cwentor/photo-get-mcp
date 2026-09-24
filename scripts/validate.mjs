// 参数校验与来源归一化（零依赖，替代原 zod schema）。
// 规则与原 tools.js 中的 searchAndDownloadImagesShape 逐条等价：
//   keyword:   必填字符串，1-100 字符
//   save_dir:  非 dry-run 时必填非空字符串（dry-run 只搜不下载，无需保存目录）
//   count:     可选整数，1-200，默认 10
//   size:      可选枚举 preview | webformat | large，默认 webformat
//   safesearch:可选布尔，默认 true（仅对 Pixabay 生效）
//   source:    可选，字符串/逗号分隔字符串/数组，经 normalizeSources 归一化
//   dryRun:    可选布尔，默认 false

export const VALID_SOURCES = Object.freeze([
  "pixabay",
  "picjumbo",
  "pexels",
  "freerangestock",
  "nounproject",
  "magnific",
]);

// 默认来源：Pixabay（内置公开 Key）+ Freerange（免 Key）
export const DEFAULT_SOURCES = Object.freeze(["pixabay", "freerangestock"]);

export const VALID_SIZES = Object.freeze(["preview", "webformat", "large"]);

export function normalizeSources(input) {
  if (input === undefined || input === null) {
    return [...DEFAULT_SOURCES];
  }
  if (Array.isArray(input)) {
    const filtered = input
      .map((s) => String(s).toLowerCase().trim())
      .filter((s) => VALID_SOURCES.includes(s));
    return filtered.length > 0 ? [...new Set(filtered)] : [...DEFAULT_SOURCES];
  }
  const s = String(input).toLowerCase().trim();
  if (VALID_SOURCES.includes(s)) return [s];
  // 支持逗号分隔字符串，如 "pixabay,picjumbo"
  if (s.includes(",")) {
    const parts = s
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter((p) => VALID_SOURCES.includes(p));
    return parts.length > 0 ? [...new Set(parts)] : [...DEFAULT_SOURCES];
  }
  return [...DEFAULT_SOURCES];
}

export function validateArgs(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const issues = [];
  const dryRun = input.dryRun === true;

  // ---- keyword ----
  if (typeof input.keyword !== "string") {
    issues.push({ field: "keyword", message: "keyword 必填，且必须为字符串" });
  } else if (input.keyword.length < 1) {
    issues.push({ field: "keyword", message: "keyword不能为空" });
  } else if (input.keyword.length > 100) {
    issues.push({ field: "keyword", message: "keyword过长（最多 100 字符）" });
  }

  // ---- save_dir ----
  if (!dryRun) {
    if (typeof input.save_dir !== "string" || input.save_dir.length < 1) {
      issues.push({ field: "save_dir", message: "save_dir 不能为空（非 --dry-run 模式必填）" });
    }
  } else if (input.save_dir !== undefined && (typeof input.save_dir !== "string" || input.save_dir.length < 1)) {
    issues.push({ field: "save_dir", message: "save_dir 若提供则必须为非空字符串" });
  }

  // ---- count ----
  let count = 10;
  if (input.count !== undefined) {
    if (typeof input.count !== "number" || !Number.isInteger(input.count)) {
      issues.push({ field: "count", message: "count 必须为整数" });
    } else if (input.count < 1) {
      issues.push({ field: "count", message: "count必须≥1" });
    } else if (input.count > 200) {
      issues.push({ field: "count", message: "count必须≤200" });
    } else {
      count = input.count;
    }
  }

  // ---- size ----
  let size = "webformat";
  if (input.size !== undefined) {
    if (!VALID_SIZES.includes(input.size)) {
      issues.push({ field: "size", message: `size 必须为 ${VALID_SOURCES.length ? VALID_SIZES.join(" / ") : ""} 之一` });
    } else {
      size = input.size;
    }
  }

  // ---- safesearch ----
  let safesearch = true;
  if (input.safesearch !== undefined) {
    if (typeof input.safesearch !== "boolean") {
      issues.push({ field: "safesearch", message: "safesearch 必须为布尔值" });
    } else {
      safesearch = input.safesearch;
    }
  }

  // ---- source（归一化，非法值回退默认，不产生 issue） ----
  const sources = normalizeSources(input.source);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      keyword: input.keyword,
      save_dir: dryRun && input.save_dir === undefined ? undefined : input.save_dir,
      count,
      size,
      safesearch,
      sources,
      dryRun,
    },
  };
}
