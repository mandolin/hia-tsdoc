const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const fixtureRoot = path.join(root, "fixtures", "doc-source-map", "ts-js");
const distRoot = path.join(fixtureRoot, "dist");

const jsonFiles = [
  "calculator.js.map",
  "calculator.tsdoc.json",
  "calculator.jsdoc-bridge.json",
  "calculator.docmap.json",
  "calculator.hia.json"
];

function main() {
  const js = fs.readFileSync(path.join(distRoot, "calculator.js"), "utf8");
  assert.match(js, /export function add/);
  assert.doesNotMatch(js, /interface AddInput/);

  for (const file of jsonFiles) {
    assert.ok(fs.existsSync(path.join(distRoot, file)), `Missing fixture artifact: ${file}`);
  }

  const ordinaryMap = readJson("calculator.js.map");
  assert.equal(ordinaryMap.version, 3);
  assert.deepEqual(ordinaryMap.sources, ["../src/calculator.ts"]);
  assert.notEqual(ordinaryMap.mappings, "", "TypeScript source map mappings must not be empty.");
  assert.equal(Object.hasOwn(ordinaryMap, "x_doc_source_map"), false);
  assert.ok(Array.isArray(ordinaryMap.sourcesContent));
  assert.equal(ordinaryMap.sourcesContent.length, 0);

  const tsdoc = readJson("calculator.tsdoc.json");
  assert.equal(tsdoc.contract, "hia-tsdoc-extraction");
  assert.equal(tsdoc.contractVersion, "0.1.0-draft");
  assert.equal(tsdoc.source.sourcesContentPolicy, "none");
  assert.ok(tsdoc.symbols.some((symbol) => symbol.id === "function:add" && symbol.classification === "runtime"));
  assert.ok(tsdoc.symbols.some((symbol) => symbol.id === "interface:AddInput" && symbol.classification === "type-only"));
  assert.ok(tsdoc.comments.some((comment) => comment.symbolId === "function:add" && comment.tags.some((tag) => tag.tag === "returns")));
  assertSafeRelativePath(tsdoc.source.path);

  const jsdocBridge = readJson("calculator.jsdoc-bridge.json");
  assert.equal(jsdocBridge.contract, "hia-ts-jsdoc-bridge");
  assert.ok(jsdocBridge.runtimeSymbols.some((symbol) => symbol.id === "function:add"));
  assert.ok(jsdocBridge.typeOnlySymbols.some((symbol) => symbol.id === "interface:AddInput" && symbol.bridgeStatus === "ts-only"));

  const docmap = readJson("calculator.docmap.json");
  assert.equal(docmap.contract, "doc-source-map");
  assert.equal(docmap.contractVersion, "0.1.0-draft");
  assert.equal(docmap.privacy.sourcesContentPolicy, "none");
  assert.equal(docmap.sourceMaps[0].pointer.status, "not-written");
  assert.equal(docmap.sourceMaps[0].pointer.reservedExtensionField, "x_doc_source_map");
  assert.ok(docmap.entries.some((entry) => entry.id === "entry:function-add" && entry.artifactRefs.length === 1));
  assert.ok(docmap.entries.some((entry) => entry.id === "entry:interface-addinput" && entry.artifactRefs.length === 0 && entry.diagnostics.includes("TS_TYPE_ONLY_NO_JS_EMIT")));
  for (const source of docmap.sources) {
    assertSafeRelativePath(source.path);
    assert.equal(source.sourcesContentPolicy, "none");
  }
  for (const artifact of docmap.artifacts) {
    assertSafeRelativePath(artifact.path);
  }
  for (const sourceMap of docmap.sourceMaps) {
    assertSafeRelativePath(sourceMap.path);
  }

  const hia = readJson("calculator.hia.json");
  assert.equal(hia.schemaVersion, "0.2.0");
  assert.ok(hia.symbols.some((symbol) => symbol.id === "function:add" && symbol.kind === "function"));
  assert.equal(hia.symbols.some((symbol) => symbol.id === "interface:AddInput"), false);
  assert.ok(hia.metadata.typeOnlySymbols.some((symbol) => symbol.id === "interface:AddInput"));
  assert.ok(hia.metadata.docSourceMaps[0].path.endsWith("calculator.docmap.json"));

  expectNoLocalPathLeakage(fixtureRoot);
  console.log("TSDoc fixture check passed.");
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(distRoot, name), "utf8"));
}

function assertSafeRelativePath(value) {
  assert.equal(typeof value, "string", `Expected path string, got ${typeof value}`);
  assert.equal(path.isAbsolute(value), false, `Path must not be absolute: ${value}`);
  assert.equal(value.startsWith("\\\\"), false, `Path must not be UNC: ${value}`);
  assert.equal(value.split(/[\\/]/).includes(".."), false, `Path must not escape workspace: ${value}`);
}

function expectNoLocalPathLeakage(directory) {
  const forbidden = [
    "K:\\Project",
    "Github_mandolin",
    "HIA-Documentation-Sys"
  ];
  for (const filePath of listFiles(directory)) {
    const content = fs.readFileSync(filePath, "utf8");
    for (const marker of forbidden) {
      assert.equal(content.includes(marker), false, `Local path leakage in ${path.relative(root, filePath).replaceAll("\\", "/")}: ${marker}`);
    }
  }
}

function listFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(entryPath));
    } else {
      result.push(entryPath);
    }
  }
  return result;
}

main();
