const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const requiredPaths = [
  "README.md",
  "CHANGELOG.md",
  "RELEASE_CHECKLIST.md",
  "THIRD_PARTY_NOTICES.md",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "pnpm-workspace.yaml",
  "examples/basic/README.md",
  "fixtures/README.md",
  "test/README.md",
  "scripts/build-fixtures.cjs",
  "scripts/check-fixtures.cjs",
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
