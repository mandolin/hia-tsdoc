const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const releasePackageDirectories = [
  "tsdoc-spec",
  "ts-doc-extractor",
  "ts-doc-adapter",
  "ts-to-js-doc-source-map",
  "ts-jsdoc-bridge",
  "tsdoc-runner",
  "tsdoc-producer"
];

function loadReleasePackages() {
  return releasePackageDirectories.map((directoryName) => {
    const packageRoot = path.join(root, "packages", directoryName);
    const packageJsonPath = path.join(packageRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return {
      directoryName,
      root: packageRoot,
      name: packageJson.name,
      version: packageJson.version,
      packageJson
    };
  });
}

module.exports = {
  loadReleasePackages,
  releasePackageDirectories
};
