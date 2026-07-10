/**
 * Adds two numeric values.
 *
 * @public
 * @param input - The values to add.
 * @returns The sum of `left` and `right`.
 */
export function add(input: AddInput): number {
  return input.left + input.right;
}

/**
 * Input values for {@link add}.
 *
 * @public
 */
export interface AddInput {
  left: number;
  right: number;
}
