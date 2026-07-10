import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractTsDoc, parseTSDocComment } from "../packages/ts-doc-extractor/src/index.mjs";

describe("TSDoc extractor", () => {
  it("parses TSDoc summary and tags", () => {
    const comment = parseTSDocComment(`/**
 * Adds values.
 *
 * @public
 * @returns The sum.
 */`);

    assert.equal(comment.summary, "Adds values.");
    assert.ok(comment.tags.some((tag) => tag.tag === "returns"));
  });

  it("keeps runtime and type-only symbols separate", () => {
    const artifact = extractTsDoc(`/**
 * Adds values.
 * @public
 */
export function add(input: AddInput): number {
  return input.left + input.right;
}

/**
 * Input values.
 * @public
 */
export interface AddInput {
  left: number;
  right: number;
}
`, { path: "fixtures/basic/calculator.ts" });

    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:add" && symbol.classification === "runtime"));
    assert.ok(artifact.symbols.some((symbol) => symbol.id === "interface:AddInput" && symbol.classification === "type-only"));
  });
});
