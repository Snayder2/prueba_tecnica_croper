// Each base letter matches its accented variants, so "cafe" finds "Café".
const ACCENT_VARIANTS: Record<string, string> = {
  a: 'aáàâäãAÁÀÂÄÃ',
  e: 'eéèêëEÉÈÊË',
  i: 'iíìîïIÍÌÎÏ',
  o: 'oóòôöõOÓÒÔÖÕ',
  u: 'uúùûüUÚÙÛÜ',
  n: 'nñNÑ',
  c: 'cçCÇ',
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/**
 * Builds a case- and accent-insensitive "contains" regex from user input.
 * Every character is escaped, so the input can never inject regex syntax.
 */
export function buildSearchRegex(term: string): RegExp {
  const base = term
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  // Escaping only prefixes symbols with "\", never letters, so the letters can
  // then be safely swapped for their accent classes.
  const pattern = escapeRegex(base).replace(/[aeiounc]/g, (char) => `[${ACCENT_VARIANTS[char]}]`);

  return new RegExp(pattern, 'i');
}
