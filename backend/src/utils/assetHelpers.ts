/**
 * Shared asset helper utilities.
 * Used by assetTypes.ts, assets.ts, and import.ts.
 */

/**
 * Generate a short uppercase code prefix from an asset type name.
 * Single-word names → first 3 consonant-rich chars.
 * Multi-word names → first letter of each word, max 4 chars.
 */
export function generateCodePrefix(name: string): string {
    const words = name.trim().toUpperCase().split(/\s+/);
    if (words.length === 1) {
        // Single word: take consonant-rich characters
        return words[0].replace(/[AEIOU]/g, '').slice(0, 3) || words[0].slice(0, 3);
    }
    // Multiple words: first letter of each
    return words.map(w => w[0]).join('').slice(0, 4);
}

/**
 * Convert a string to Title Case.
 * e.g. "hello world" → "Hello World", "DELL" → "Dell"
 */
export function toTitleCase(str: string): string {
    return str
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
