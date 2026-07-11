import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractTsDoc, parseTSDocComment } from "../packages/ts-doc-extractor/src/index.mjs";
import { runTsDoc } from "../packages/tsdoc-runner/src/index.mjs";
import { tsdocProducer } from "../packages/tsdoc-producer/src/index.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

  it("runs the standalone runner and producer adapter from the same request", async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "hia-tsdoc-runner-"));
    const request = {
      workspaceRoot: repositoryRoot,
      outputDirectory,
      inputs: [
        {
          kind: "typescript-entry",
          path: "fixtures/doc-source-map/ts-js/src/calculator.ts",
          artifactBasePath: "calculator"
        }
      ],
      options: {
        emitDocSourceMap: true,
        sourcesContentPolicy: "none",
        writeResultManifest: false
      }
    };

    try {
      const result = await runTsDoc(request);
      assert.equal(result.contract, "documentation-producer-result");
      assert.equal(result.status, "success");
      assert.equal(result.artifacts.length, 6);
      assert.ok(result.artifacts.some((artifact) => artifact.kind === "ordinary-source-map"));
      assert.ok(await fileExists(path.join(outputDirectory, "calculator.js")));

      const produced = await tsdocProducer.produce(request);
      assert.equal(produced.producer.id, "tsdoc");
      assert.equal(produced.status, "success");
    } finally {
      await fs.rm(outputDirectory, { recursive: true, force: true });
    }
  });
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
