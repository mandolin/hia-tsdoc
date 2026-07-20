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

let failed = false;

// 中文：发布前只允许目标版本在 npm registry 中不存在；避免覆盖不可变版本。
// English: The release target must not already exist in npm; package versions are immutable.
for (const directoryName of packageOrder) {
  const packageRoot = path.join(root, "packages", directoryName);
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (packageJson.version !== releaseVersion) {
    console.error(`${packageJson.name} version must match workspace ${releaseVersion}; found ${packageJson.version}.`);
    failed = true;
    continue;
  }

  const result = runNpm(["view", `${packageJson.name}@${releaseVersion}`, "version", `--registry=${registry}`], { cwd: root });
  if (result.error) {
    console.error(result.error.message);
    console.error(`Unable to check ${packageJson.name}@${releaseVersion}.`);
    failed = true;
    continue;
  }
  if (result.status === 0) {
    console.error(`${packageJson.name}@${releaseVersion} already exists in ${registry}.`);
    failed = true;
    continue;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!/\bE404\b|No match found|is not in this registry|404 Not Found/i.test(output)) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    console.error(`Unable to confirm ${packageJson.name}@${releaseVersion} is unpublished.`);
    failed = true;
    continue;
  }

  console.log(`${packageJson.name}@${releaseVersion}: not published.`);
}

if (failed) {
  process.exit(1);
}

console.log(`TSDoc registry preflight passed for ${packageOrder.length} package(s) at ${releaseVersion}.`);

function runNpm(args, options) {
  const npmCli = process.env.npm_execpath;
  if (npmCli) {
    return spawnSync(process.execPath, [npmCli, ...args], {
      ...options,
      encoding: "utf8"
    });
  }
  return spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    ...options,
    encoding: "utf8"
  });
}
