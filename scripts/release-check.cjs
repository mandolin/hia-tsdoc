const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredFiles = ["README.md", "CHANGELOG.md", "RELEASE_CHECKLIST.md", "THIRD_PARTY_NOTICES.md", "LICENSE", ".npmignore"];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  const content = fs.readFileSync(fullPath, "utf8").trim();
  if (!content) {
    console.error(`Release file is empty: ${file}`);
    process.exit(1);
  }
}

const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (rootPackage.private !== true) {
  console.error("TSDoc root workspace package must remain private.");
  process.exit(1);
}

const releaseVersion = rootPackage.version;
const expectedPackages = new Set([
  "@hia-doc/tsdoc-spec",
  "@hia-doc/ts-doc-extractor",
  "@hia-doc/ts-doc-adapter",
  "@hia-doc/ts-to-js-doc-source-map",
  "@hia-doc/ts-jsdoc-bridge",
  "@hia-doc/tsdoc-runner",
  "@hia-doc/tsdoc-producer"
]);
let failed = false;

for (const packageJsonPath of listPackageJsonFiles()) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const relativePath = path.relative(root, packageJsonPath);
  if (!expectedPackages.has(packageJson.name)) {
    console.error(`Unexpected TSDoc package name in ${relativePath}: ${packageJson.name}`);
    failed = true;
  }
  if (packageJson.version !== releaseVersion) {
    console.error(`Package ${packageJson.name} must use workspace release version ${releaseVersion}; found ${packageJson.version}.`);
    failed = true;
  }
  if (packageJson.private === true) {
    console.error(`Package ${packageJson.name} must be publishable; remove private=true.`);
    failed = true;
  }
  if (packageJson.publishConfig?.access !== "public" || packageJson.publishConfig?.registry !== "https://registry.npmjs.org/") {
    console.error(`Package ${packageJson.name} must publish publicly to npm registry.`);
    failed = true;
  }
  for (const file of ["README.md", "LICENSE", "src/index.mjs"]) {
    if (!fs.existsSync(path.join(path.dirname(packageJsonPath), file))) {
      console.error(`Missing ${file} next to ${packageJson.name}.`);
      failed = true;
    }
  }
  for (const [dependency, version] of Object.entries(packageJson.dependencies || {})) {
    if (expectedPackages.has(dependency) && version !== releaseVersion) {
      console.error(`Internal dependency ${dependency} in ${packageJson.name} must be ${releaseVersion}; found ${version}.`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("TSDoc release check passed.");

function listPackageJsonFiles() {
  return fs.readdirSync(path.join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, "packages", entry.name, "package.json"))
    .filter((packageJsonPath) => fs.existsSync(packageJsonPath));
}
