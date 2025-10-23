const TRACKING_PREFIXES = ["utm_", "ga_", "gh_src", "ref", "src", "lever-via", "gclid", "fbclid"];
const TRACKING_KEYS = new Set(["gh_src", "lever-via", "ref", "src", "utm_source", "utm_medium", "utm_campaign"]);

function shouldDropParam(key: string): boolean {
  if (TRACKING_KEYS.has(key)) {
    return true;
  }
  return TRACKING_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function canonicalizeJobUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    if (url.protocol === "http:") {
      url.protocol = "https:";
    }

    // Normalize Lever URLs: remove /apply suffix
    if (url.hostname.includes("lever.co") && url.pathname.endsWith("/apply")) {
      url.pathname = url.pathname.slice(0, -6); // Remove "/apply"
    }

    const params = new URLSearchParams(url.search);
    for (const key of Array.from(params.keys())) {
      if (shouldDropParam(key)) {
        params.delete(key);
      }
    }
    const normalized = params.toString();
    url.search = normalized ? `?${normalized}` : "";
    return url.toString();
  } catch {
    return raw;
  }
}

export function normalizeJobTerm(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const replaced = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[@]/g, " at ");
  const normalized = replaced.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : undefined;
}

export function buildJobSignature(title?: string | null, company?: string | null): string | undefined {
  const normalizedTitle = normalizeJobTerm(title);
  const normalizedCompany = normalizeJobTerm(company);
  if (!normalizedTitle && !normalizedCompany) {
    return undefined;
  }
  return [normalizedTitle, normalizedCompany].filter(Boolean).join("@");
}

export function hashJobDescription(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
