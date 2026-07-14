const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const requiredPaths = [
  "README.md",
  "CHANGELOG.md",
  "RELEASE_CHECKLIST.md",
  "THIRD_PARTY_NOTICES.md",
  "LICENSE",
  ".npmignore",
  "package.json",
  "package-lock.json",
  "pnpm-workspace.yaml",
  "examples/basic/README.md",
  "examples/standalone/README.md",
  "examples/standalone/tsdoc.config.json",
  "examples/standalone/src/calculator.ts",
  "examples/target-project/README.md",
  "examples/target-project/tsdoc.config.json",
  "examples/target-project/src/banner.ts",
  "examples/target-project/src/palette.ts",
  "fixtures/README.md",
  "test/README.md",
  "scripts/build-fixtures.cjs",
  "scripts/check-fixtures.cjs",
  "scripts/check-pack.cjs",
  "scripts/check-standalone.cjs",
  "scripts/check-target-consumer.cjs",
  "packages/tsdoc-spec/package.json",
  "packages/tsdoc-spec/src/index.mjs",
  "packages/ts-doc-extractor/package.json",
  "packages/ts-doc-extractor/src/index.mjs",
  "packages/ts-doc-adapter/package.json",
  "packages/ts-doc-adapter/src/index.mjs",
  "packages/ts-to-js-doc-source-map/package.json",
  "packages/ts-to-js-doc-source-map/src/index.mjs",
  "packages/ts-jsdoc-bridge/package.json",
  "packages/ts-jsdoc-bridge/src/index.mjs",
  "packages/tsdoc-runner/package.json",
  "packages/tsdoc-runner/src/schema.mjs",
  "packages/tsdoc-runner/src/index.mjs",
  "packages/tsdoc-runner/src/cli.mjs",
  "packages/tsdoc-producer/package.json",
  "packages/tsdoc-producer/src/index.mjs",
  "fixtures/doc-source-map/ts-js/src/calculator.ts",
  "test/tsdoc-fixture.test.mjs"
];

let failed = false;

for (const relativePath of requiredPaths) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing required skeleton path: ${relativePath}`);
    failed = true;
  }
}

const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (rootPackage.private !== true) {
  console.error("Root package must stay private until TSDoc package names are finalized.");
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log("TSDoc skeleton check passed.");
