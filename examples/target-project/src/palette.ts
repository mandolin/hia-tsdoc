/**
 * Resolves a named palette entry for a generated artwork preview.
 *
 * @public
 * @param palette - The palette lookup table.
 * @param name - The requested palette entry name.
 * @returns The resolved CSS color string.
 */
export function resolvePaletteColor(palette: PaletteMap, name: string): string {
  return palette[name] ?? palette.default ?? "#000000";
}

/**
 * Maps palette entry names to CSS color values.
 *
 * @public
 */
export type PaletteMap = Record<string, string>;

