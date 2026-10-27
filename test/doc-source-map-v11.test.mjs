/**
 * @file
 * @lang zh-CN TypeScript 文档源码映射新版逐引用范围约定的回归。
 * @lang en Regression coverage for per-reference range conventions in the new TypeScript documentation source map.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractTsDoc } from "../packages/ts-doc-extractor/src/index.mjs";
import { createTsJsDocSourceMap } from "../packages/ts-to-js-doc-source-map/src/index.mjs";
import { runTsDoc } from "../packages/tsdoc-runner/src/index.mjs";

/** @lang zh-CN 仓库路径仅用于读取已公开的合成夹具。 @lang en Repository path is used only to read the public synthetic fixture. */
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @lang zh-CN 从公开合成源码创建映射，避免把项目文件或生成工件当作测试输入。
 * @lang en Creates a map from public synthetic source without using project files or generated artifacts as test input.
 * @param {string} source <lang><zh-CN>公开合成源码。</zh-CN><en>Public synthetic source.</en></lang>
 * @returns {object} <lang><zh-CN>文档源码映射。</zh-CN><en>Documentation source map.</en></lang>
 */
function mapOf(source) {
  const artifact = extractTsDoc(source, { path: "fixtures/range-probe.ts" });
  return createTsJsDocSourceMap({ tsArtifact: artifact });
}

/** @lang zh-CN 已测注释与未证声明扫描分开标注，不以语言名称推断精度。 @lang en Proven comments and unproven declaration scans carry distinct precision rather than inheriting it from the language name. */
test("distinguishes attached comments from declaration fallback", () => {
  const source = "/** 🔥 summary. */\r\nexport function commented(): void {}\r\nexport function plain(): void {}\r\n";
  const map = mapOf(source);
  const commentRef = map.entries.find((entry) => entry.symbolId === "function:commented").sourceRefs[0];
  const declarationRef = map.entries.find((entry) => entry.symbolId === "function:plain").sourceRefs[0];

  assert.equal(map.contractVersion, "1.1.0");
  assert.deepEqual(commentRef.rangeConvention, { endBoundary: "exclusive", columnUnit: "utf16-code-unit" });
  assert.equal(commentRef.range.end.column, source.split("\r\n")[0].length + 1);
  assert.equal(commentRef.rangeSource, "heuristic");
  assert.equal(commentRef.rangeSourceDetail, "tsdoc-fixture-scanner:attached-comment");
  assert.deepEqual(declarationRef.rangeConvention, { endBoundary: "unknown", columnUnit: "utf16-code-unit" });
  assert.equal(declarationRef.rangeSource, "heuristic");
  assert.equal(declarationRef.rangeSourceDetail, "tsdoc-fixture-scanner:declaration");
  assert.equal(Object.hasOwn(map.entries.find((entry) => entry.symbolId === "function:plain"), "annotation"), false);
});

/** @lang zh-CN 外部提取工件不能继承本扫描器实样的范围约定。 @lang en External extraction artifacts cannot inherit range conventions proven for this scanner. */
test("keeps foreign extraction ranges unresolved", () => {
  const artifact = extractTsDoc("/** Sample. */\nexport function sample(): void {}", { path: "fixtures/range-probe.ts" });
  artifact.producer = { name: "external-tsdoc-adapter", version: "1.0.0" };
  const sourceRef = createTsJsDocSourceMap({ tsArtifact: artifact }).entries[0].sourceRefs[0];

  assert.deepEqual(sourceRef.rangeConvention, { endBoundary: "unknown", columnUnit: "unknown" });
  assert.equal(sourceRef.rangeSource, "adapter");
  assert.equal(sourceRef.confidence, "low");
});

/** @lang zh-CN 没有范围时不伪造约定，仍保留可展示的来源身份。 @lang en A missing range carries no fabricated convention while retaining displayable source identity. */
test("omits range conventions when an external reference has no range", () => {
  const artifact = extractTsDoc("export function sample(): void {}", { path: "fixtures/range-probe.ts" });
  artifact.producer = { name: "external-tsdoc-adapter", version: "1.0.0" };
  delete artifact.symbols[0].source.range;
  const sourceRef = createTsJsDocSourceMap({ tsArtifact: artifact }).entries[0].sourceRefs[0];

  assert.equal(Object.hasOwn(sourceRef, "range"), false);
  assert.equal(Object.hasOwn(sourceRef, "rangeConvention"), false);
  assert.equal(sourceRef.rangeSource, "unresolved");
  assert.equal(sourceRef.confidence, "none");
});

/** @lang zh-CN 单源提取工件若夹带另一文件的符号，必须拒绝悬空的来源 ID。 @lang en A single-source extraction artifact containing a foreign file's symbol must reject the dangling source ID. */
test("rejects symbols whose source path is outside the declared single source", () => {
  const artifact = extractTsDoc("export function sample(): void {}", { path: "fixtures/range-probe.ts" });
  artifact.symbols[0].source.path = "fixtures/other.ts";
  assert.throws(() => createTsJsDocSourceMap({ tsArtifact: artifact }), /TS_DOC_SOURCE_MAP_CROSS_FILE_SOURCE/);
});

/** @lang zh-CN 实际运行器产物及其 HIA 引用须与同一新版身份配对。 @lang en Actual runner output and its HIA reference must pair with the same new contract identity. */
test("pairs the emitted map, result descriptor, and HIA metadata", async () => {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "hia-tsdoc-map-v11-"));
  try {
    const result = await runTsDoc(fixtureRequest(outputDirectory, true));
    const map = JSON.parse(await fs.readFile(path.join(outputDirectory, "calculator.docmap.json"), "utf8"));
    const hia = JSON.parse(await fs.readFile(path.join(outputDirectory, "calculator.hia.json"), "utf8"));
    const descriptor = result.artifacts.find((artifact) => artifact.kind === "doc-source-map");
    assert.equal(result.status, "success");
    assert.equal(map.contractVersion, "1.1.0");
    assert.equal(descriptor.contractVersion, map.contractVersion);
    assert.equal(hia.metadata.docSourceMaps[0].contractVersion, map.contractVersion);
    assert.ok(map.entries.every((entry) => entry.sourceRefs.every((reference) => !reference.range || reference.rangeConvention)));
  } finally {
    await removeTemporaryOutput(outputDirectory, "hia-tsdoc-map-v11-");
  }
});

/** @lang zh-CN 关闭可选映射时文档中不能留下指向未写工件的引用。 @lang en Disabling the optional map must not leave a dangling reference in the document. */
test("does not reference a map when map emission is disabled", async () => {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "hia-tsdoc-no-map-"));
  try {
    const result = await runTsDoc(fixtureRequest(outputDirectory, false));
    const hia = JSON.parse(await fs.readFile(path.join(outputDirectory, "calculator.hia.json"), "utf8"));
    assert.equal(result.status, "success");
    assert.equal(result.artifacts.some((artifact) => artifact.kind === "doc-source-map"), false);
    assert.deepEqual(hia.metadata.docSourceMaps, []);
    await assert.rejects(fs.access(path.join(outputDirectory, "calculator.docmap.json")), { code: "ENOENT" });
  } finally {
    await removeTemporaryOutput(outputDirectory, "hia-tsdoc-no-map-");
  }
});

/** @lang zh-CN 真实运行器须把同行第二函数贯穿提取、HIA、桥接和两段映射链，并保持类型仅在元数据中。 @lang en The real runner must carry the second same-line function through extraction, HIA, bridge, and both map stages while leaving types in metadata only. */
test("carries distinct same-line exports through the generated chain", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-tsdoc-same-line-"));
  try {
    const source = [
      "/** First. */",
      "export function first(): number { return 1; } export function second(): number { return 2; }",
      "export type One = string; export type Two = number;"
    ].join("\r\n");
    await fs.writeFile(path.join(workspaceRoot, "sample.ts"), source, "utf8");
    const outputDirectory = path.join(workspaceRoot, "generated");
    const result = await runTsDoc({
      workspaceRoot,
      outputDirectory,
      inputs: [{ kind: "typescript-entry", path: "sample.ts", artifactBasePath: "sample" }],
      options: { emitDocSourceMap: true, sourcesContentPolicy: "none", writeResultManifest: false }
    });
    assert.equal(result.status, "success");
    const extraction = JSON.parse(await fs.readFile(path.join(outputDirectory, "sample.tsdoc.json"), "utf8"));
    const hia = JSON.parse(await fs.readFile(path.join(outputDirectory, "sample.hia.json"), "utf8"));
    const bridge = JSON.parse(await fs.readFile(path.join(outputDirectory, "sample.jsdoc-bridge.json"), "utf8"));
    const map = JSON.parse(await fs.readFile(path.join(outputDirectory, "sample.docmap.json"), "utf8"));
    assert.deepEqual(extraction.symbols.map((symbol) => symbol.id), ["function:first", "function:second", "type:One", "type:Two"]);
    assert.deepEqual(hia.symbols.map((symbol) => symbol.id), ["function:first", "function:second"]);
    assert.deepEqual(hia.metadata.typeOnlySymbols.map((symbol) => symbol.id), ["type:One", "type:Two"]);
    assert.deepEqual(bridge.runtimeSymbols.map((symbol) => symbol.id), ["function:first", "function:second"]);
    assert.deepEqual(bridge.typeOnlySymbols.map((symbol) => symbol.id), ["type:One", "type:Two"]);
    assert.deepEqual(map.entries.map((entry) => entry.symbolId), ["function:first", "function:second", "type:One", "type:Two"]);
    assert.deepEqual(map.chains[0].stages[0].linkage, map.entries.map((entry) => entry.id));
    assert.deepEqual(map.chains[0].stages[1].linkage, map.entries.slice(0, 2).map((entry) => entry.id));
    assert.ok(map.entries.slice(2).every((entry) => entry.artifactRefs.length === 0));
    assert.deepEqual(map.entries.find((entry) => entry.symbolId === "function:second").sourceRefs[0].rangeConvention,
      { endBoundary: "unknown", columnUnit: "utf16-code-unit" });
  } finally {
    await removeTemporaryOutput(workspaceRoot, "hia-tsdoc-same-line-");
  }
});

/**
 * @lang zh-CN 仅构建仓内合成 TypeScript 夹具，输出送到系统临时目录。
 * @lang en Builds only the repository's synthetic TypeScript fixture and writes into a system temporary directory.
 * @param {string} outputDirectory <lang><zh-CN>临时输出目录。</zh-CN><en>Temporary output directory.</en></lang>
 * @param {boolean} emitDocSourceMap <lang><zh-CN>是否写出可选映射。</zh-CN><en>Whether to emit the optional map.</en></lang>
 * @returns {object} <lang><zh-CN>运行器请求。</zh-CN><en>Runner request.</en></lang>
 */
function fixtureRequest(outputDirectory, emitDocSourceMap) {
  return {
    workspaceRoot: repositoryRoot,
    outputDirectory,
    inputs: [{ kind: "typescript-entry", path: "fixtures/doc-source-map/ts-js/src/calculator.ts", artifactBasePath: "calculator" }],
    options: { emitDocSourceMap, sourcesContentPolicy: "none", writeResultManifest: false }
  };
}

/**
 * @lang zh-CN 删除前核实解析后的目标是系统临时目录中本测试专用的直接子目录。
 * @lang en Before deletion, verifies the resolved target is a direct test-owned child of the system temporary directory.
 * @param {string} outputDirectory <lang><zh-CN>待清理的临时目录。</zh-CN><en>Temporary directory to remove.</en></lang>
 * @param {string} expectedPrefix <lang><zh-CN>本测试创建时使用的前缀。</zh-CN><en>Prefix used when this test created the directory.</en></lang>
 * @returns {Promise<void>} <lang><zh-CN>清理完成。</zh-CN><en>Cleanup completion.</en></lang>
 */
async function removeTemporaryOutput(outputDirectory, expectedPrefix) {
  const resolvedTempRoot = await fs.realpath(os.tmpdir());
  const resolvedOutput = await fs.realpath(outputDirectory);
  assert.equal(path.dirname(resolvedOutput), resolvedTempRoot);
  assert.ok(path.basename(resolvedOutput).startsWith(expectedPrefix));
  await fs.rm(resolvedOutput, { recursive: true, force: true });
}
