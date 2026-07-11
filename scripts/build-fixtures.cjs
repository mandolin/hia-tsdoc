const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const distRoot = path.join(root, "fixtures", "doc-source-map", "ts-js", "dist");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const { runTsDoc } = await import(pathToFileURL(path.join(root, "packages", "tsdoc-runner", "src", "index.mjs")));

  fs.rmSync(distRoot, { recursive: true, force: true });
  fs.mkdirSync(distRoot, { recursive: true });

  const result = await runTsDoc({
    workspaceRoot: root,
    outputDirectory: distRoot,
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
  });

  if (result.status !== "success") {
    throw new Error(`TSDoc fixture build failed: ${JSON.stringify(result.diagnostics)}`);
  }

  console.log("TSDoc TypeScript -> JavaScript fixture artifacts generated.");
}
