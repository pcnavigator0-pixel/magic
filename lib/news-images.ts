export function parseImageUrls(value: string | null | undefined) {
  if (!value) return [];

  const matches = Array.from(value.matchAll(/"([^"]+)"|'([^']+)'|([^,\n]+)/g));

  return matches
    .map((match) => match[1] || match[2] || match[3] || "")
    .map((url) => url.trim())
    .filter(Boolean);
}

export function formatImageUrlsForStorage(urls: string[]) {
  const cleanUrls = urls.map((url) => url.trim()).filter(Boolean);

  if (cleanUrls.length === 0) return null;
  if (cleanUrls.length === 1) return cleanUrls[0];

  return cleanUrls.map((url) => `"${url.replaceAll('"', "%22")}"`).join(",");
}
