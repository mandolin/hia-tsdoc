const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const fixtureRoot = path.join(root, "fixtures", "doc-source-map", "ts-js");
const sourcePath = path.join(fixtureRoot, "src", "calculator.ts");
const distRoot = path.join(fixtureRoot, "dist");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const [
    { extractTsDoc },
    { tsDocToJsDocBridgeArtifact },
    { tsDocToHiaDocument },
    { createTsJsDocSourceMap }
  ] = await Promise.all([
    import(pathToFileURL(path.join(root, "packages", "ts-doc-extractor", "src", "index.mjs"))),
    import(pathToFileURL(path.join(root, "packages", "ts-jsdoc-bridge", "src", "index.mjs"))),
    import(pathToFileURL(path.join(root, "packages", "ts-doc-adapter", "src", "index.mjs"))),
    import(pathToFileURL(path.join(root, "packages", "ts-to-js-doc-source-map", "src", "index.mjs")))
  ]);

  await fs.mkdir(distRoot, { recursive: true });

  const source = await fs.readFile(sourcePath, "utf8");
  await compileTypeScript();

  const jsPath = "fixtures/doc-source-map/ts-js/dist/calculator.js";
  const sourceMapPath = "fixtures/doc-source-map/ts-js/dist/calculator.js.map";
  const tsDocPath = "fixtures/doc-source-map/ts-js/dist/calculator.tsdoc.json";
  const jsDocBridgePath = "fixtures/doc-source-map/ts-js/dist/calculator.jsdoc-bridge.json";
  const docMapPath = "fixtures/doc-source-map/ts-js/dist/calculator.docmap.json";
  const hiaPath = "fixtures/doc-source-map/ts-js/dist/calculator.hia.json";

  const tsArtifact = extractTsDoc(source, {
    path: "fixtures/doc-source-map/ts-js/src/calculator.ts",
    generatedJsPath: jsPath,
    sourcesContentPolicy: "none"
  });
  const jsDocBridge = tsDocToJsDocBridgeArtifact(tsArtifact, { jsPath });
  const hiaDocument = tsDocToHiaDocument(tsArtifact, {
    id: "fixture.ts.calculator",
    title: "TypeScript Calculator Fixture",
    docSourceMapPath: docMapPath,
    entryArtifact: jsPath
  });
  const docSourceMap = createTsJsDocSourceMap({
    id: "docmap:ts-js:calculator",
    tsArtifact,
    jsPath,
    sourceMapPath,
    tsDocPath,
    jsDocBridgePath,
    hiaDocumentPath: hiaPath
  });

  const outputText = await fs.readFile(path.join(distRoot, "calculator.js"), "utf8");
  const sourceMap = JSON.parse(await fs.readFile(path.join(distRoot, "calculator.js.map"), "utf8"));
  await fs.writeFile(path.join(distRoot, "calculator.js"), ensureTrailingNewline(outputText), "utf8");
  await writeJson(path.join(distRoot, "calculator.js.map"), normalizeSourceMap(sourceMap));
  await writeJson(path.join(distRoot, "calculator.tsdoc.json"), tsArtifact);
  await writeJson(path.join(distRoot, "calculator.jsdoc-bridge.json"), jsDocBridge);
  await writeJson(path.join(distRoot, "calculator.docmap.json"), docSourceMap);
  await writeJson(path.join(distRoot, "calculator.hia.json"), hiaDocument);

  console.log("TSDoc TypeScript -> JavaScript fixture artifacts generated.");
}

async function compileTypeScript() {
  await fs.rm(distRoot, { recursive: true, force: true });
  await fs.mkdir(distRoot, { recursive: true });
  const tscBin = path.join(root, "node_modules", "typescript", "lib", "tsc.js");
  execFileSync(process.execPath, [
    tscBin,
    "--target", "ES2020",
    "--module", "ES2020",
    "--sourceMap", "true",
    "--inlineSources", "false",
    "--declaration", "false",
    "--outDir", "dist",
    "src/calculator.ts"
  ], {
    cwd: fixtureRoot,
    stdio: "pipe"
  });
}

function normalizeSourceMap(sourceMap) {
  return {
    version: 3,
    file: "calculator.js",
    sourceRoot: "",
    sources: ["../src/calculator.ts"],
    sourcesContent: [],
    names: Array.isArray(sourceMap.names) ? sourceMap.names : [],
    mappings: sourceMap.mappings ?? "",
    x_fixture_note: "TypeScript 7.0.2 generated source map normalized for fixture path privacy."
  };
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}
