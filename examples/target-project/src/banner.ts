/**
 * Builds a display banner from text rows.
 *
 * @public
 * @param rows - The rows that should be joined into the banner.
 * @returns A newline-separated banner string.
 */
export function createBanner(rows: BannerRow[]): string {
  return rows.map((row) => row.text).join("\n");
}

/**
 * Describes one rendered text row.
 *
 * @public
 */
export interface BannerRow {
  text: string;
  width: number;
}

