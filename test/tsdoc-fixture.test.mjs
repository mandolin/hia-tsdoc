import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractTsDoc, parseTSDocComment } from "../packages/ts-doc-extractor/src/index.mjs";
import { tsDocToHiaDocument } from "../packages/ts-doc-adapter/src/index.mjs";
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

  it("recognizes HIA target-project tags and standard throws blocks", () => {
    const comment = parseTSDocComment(`/**
 * Renders a value.
 *
 * @performance Uses a cache-backed fast path for repeated glyph lookups.
 * @throws Throws when the input cannot be normalized.
 */`);

    assert.deepEqual(comment.parserDiagnostics, []);
    assert.ok(comment.tags.some((tag) => tag.tag === "performance" && tag.known));
    assert.ok(comment.tags.some((tag) => tag.tag === "throws" && tag.known));
  });

  it("maps @lang and inline <lang> to field-level i18n", () => {
    const comment = parseTSDocComment(`/**
 * Greets a <lang key="greet.target"><zh-CN>用户</zh-CN><en>user</en></lang>.
 *
 * @lang zh-CN 问候一个用户。
 * @lang en Greets a user.
 */`);

    assert.deepEqual(comment.parserDiagnostics, []);
    assert.equal(comment.i18n.fields.description.localizedText["zh-CN"], "问候一个用户。");
    assert.equal(comment.i18n.fields.description.segments[0].localized["zh-CN"], "用户");
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
    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:add" && symbol.signature === "add(input: AddInput)"));
    assert.ok(artifact.symbols.some((symbol) => symbol.id === "interface:AddInput" && symbol.classification === "type-only"));
  });

  it("extracts async exported functions as runtime symbols", () => {
    const artifact = extractTsDoc(`/**
 * Converts text asynchronously.
 * @public
 */
export async function textToArt(input: string): Promise<string> {
  return input;
}
`, { path: "fixtures/basic/text-to-art.ts" });

    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:textToArt" && symbol.classification === "runtime"));
    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:textToArt" && symbol.signature === "textToArt(input: string)"));
  });

  it("extracts multiline exported function declarations", () => {
    const artifact = extractTsDoc(`/**
 * Converts text.
 * @public
 */
export async function textToArt(
  input: string,
  options: Record<string, unknown>
): Promise<string> {
  return input;
}
`, { path: "fixtures/basic/text-to-art.ts" });

    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:textToArt" && symbol.classification === "runtime"));
    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:textToArt" && symbol.signature === "textToArt(input: string, options: Record<string, unknown>)"));
  });

  it("extracts functions whose optional options use an object default", () => {
    const artifact = extractTsDoc(`/**
 * Converts a browser image.
 * @public
 */
export async function imageToArt(
  input: unknown,
  options: BrowserArtOptions = {}
): Promise<string> {
  return String(input);
}
`, { path: "fixtures/basic/browser-image-to-art.ts" });

    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:imageToArt" && symbol.classification === "runtime"));
    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:imageToArt" && symbol.signature === "imageToArt(input: unknown, options: BrowserArtOptions = {})"));
  });

  it("does not treat a blank line before an export as a duplicate declaration", () => {
    const artifact = extractTsDoc(`export type Message =
  | { type: 'ready' }
  | { type: 'done' };

export function isMessage(value: unknown): boolean {
  return Boolean(value);
}
`, { path: "fixtures/basic/message.ts" });

    assert.equal(artifact.symbols.filter((symbol) => symbol.id === "function:isMessage").length, 1);
  });

  it("emits a non-empty signature for zero-argument functions", () => {
    const artifact = extractTsDoc(`/**
 * Lists values.
 * @public
 */
export function listValues(): string[] {
  return [];
}
`, { path: "fixtures/basic/list-values.ts" });

    assert.ok(artifact.symbols.some((symbol) => symbol.id === "function:listValues" && symbol.signature === "listValues()"));
  });

  it("adapts TSDoc locale fields into HIA symbols", () => {
    const artifact = extractTsDoc(`/**
 * Greets a <lang><zh-CN>用户</zh-CN><en>user</en></lang>.
 * @lang zh-CN 问候一个用户。
 */
export function greetUser(name: string): string {
  return name;
}
`, { path: "fixtures/basic/greet.ts" });
    const document = tsDocToHiaDocument(artifact, { title: "Greeting" });
    const symbol = document.symbols.find((item) => item.id === "function:greetUser");

    assert.ok(document.locales.includes("zh-CN"));
    assert.equal(symbol.i18n.fields.description.localizedText["zh-CN"], "问候一个用户。");
    assert.equal(symbol.i18n.fields.description.localizedText.en, "Greets a user.");
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
