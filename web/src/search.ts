// Search over text the guest can read, in the language they read it in. Case and accents are ignored, so "cafe" finds "Café".

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** True when every word of the query appears in the fields. An empty query matches everything. */
export function matches(query: string, fields: readonly string[]): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(fields.join(' '));
  return words.every((w) => haystack.includes(w));
}