export function parseImageUrls(value: string | null | undefined) {
  if (!value) return [];

  const trimmedValue = value.trim();
  if (!trimmedValue) return [];

  try {
    const parsed = JSON.parse(trimmedValue);

    if (Array.isArray(parsed)) {
      return parsed
        .map((url) => String(url).trim())
        .filter(Boolean);
    }

    if (typeof parsed === "string") {
      return [parsed.trim()].filter(Boolean);
    }
  } catch {
    // Fall through to the loose comma/newline parser used by the dashboard field.
  }

  const matches = Array.from(trimmedValue.matchAll(/"([^"]+)"|'([^']+)'|([^,\n]+)/g));

  return matches
    .map((match) => match[1] || match[2] || match[3] || "")
    .map((url) => url.trim())
    .map((url) => url.replace(/^\[+|\]+$/g, "").trim())
    .filter(Boolean);
}

export function formatImageUrlsForStorage(urls: string[]) {
  const cleanUrls = urls.map((url) => url.trim()).filter(Boolean);

  if (cleanUrls.length === 0) return null;
  if (cleanUrls.length === 1) return cleanUrls[0];

  return cleanUrls.map((url) => `"${url.replaceAll('"', "%22")}"`).join(",");
}
