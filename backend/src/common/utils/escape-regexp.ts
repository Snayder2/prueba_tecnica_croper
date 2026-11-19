/**
 * Escapes every regex metacharacter so user input is matched literally.
 * Used before building any $regex from user text, which prevents injected
 * patterns and expensive expressions (ReDoS). Spec 03 §6.2.
 */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}
