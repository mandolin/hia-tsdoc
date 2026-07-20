const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const releaseVersion = rootPackage.version;
const registry = process.env.npm_config_registry || process.env.NPM_CONFIG_REGISTRY || "https://registry.npmjs.org/";
const packageOrder = [
  "tsdoc-spec",
  "ts-doc-extractor",
  "ts-doc-adapter",
  "ts-to-js-doc-source-map",
  "ts-jsdoc-bridge",
  "tsdoc-runner",
  "tsdoc-producer"
];

// 中文：按内部依赖顺序发布，确保后续包安装时能解析同版本 workspace 依赖。
// English: Publishes in internal dependency order so later packages can resolve same-version workspace dependencies.
for (const directoryName of packageOrder) {
  const packageRoot = path.join(root, "packages", directoryName);
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (packageJson.version !== releaseVersion) {
    console.error(`${packageJson.name} version must match workspace ${releaseVersion}; found ${packageJson.version}.`);
    process.exit(1);
  }

  console.log(`Publishing ${packageJson.name}@${releaseVersion} to ${registry}`);
  const result = runNpm(["publish", "--access", "public", `--registry=${registry}`], { cwd: packageRoot });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Publishing stopped at ${packageJson.name}@${releaseVersion}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`TSDoc publish completed for ${packageOrder.length} package(s) at ${releaseVersion}.`);

function runNpm(args, options) {
  const npmCli = process.env.npm_execpath;
  if (npmCli) {
    return spawnSync(process.execPath, [npmCli, ...args], {
      ...options,
      stdio: "inherit"
    });
  }
  return spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    ...options,
    stdio: "inherit"
  });
}
