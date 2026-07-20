const { spawnSync } = require("node:child_process");
const path = require("node:path");

const { loadReleasePackages } = require("./release-packages.cjs");

const root = path.resolve(__dirname, "..");
const releasePackages = loadReleasePackages();
const releaseVersion = releasePackages[0]?.version;
const registry = process.env.HIA_NPM_REGISTRY || "https://registry.npmjs.org/";

let failed = false;

// 中文：发布前只允许目标版本在 npm registry 中不存在；避免覆盖不可变版本。
// English: The release target must not already exist in npm; package versions are immutable.
for (const item of releasePackages) {
  if (item.version !== releaseVersion) {
    console.error(`${item.name} version must match release ${releaseVersion}; found ${item.version}.`);
    failed = true;
    continue;
  }

  const result = runNpm(["view", `${item.name}@${releaseVersion}`, "version", `--registry=${registry}`], { cwd: root });
  if (result.error) {
    console.error(result.error.message);
    console.error(`Unable to check ${item.name}@${releaseVersion}.`);
    failed = true;
    continue;
  }
  if (result.status === 0) {
    console.error(`${item.name}@${releaseVersion} already exists in ${registry}.`);
    failed = true;
    continue;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!/\bE404\b|No match found|is not in this registry|404 Not Found/i.test(output)) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    console.error(`Unable to confirm ${item.name}@${releaseVersion} is unpublished.`);
    failed = true;
    continue;
  }

  console.log(`${item.name}@${releaseVersion}: not published.`);
}

if (failed) {
  process.exit(1);
}

console.log(`TSDoc registry preflight passed for ${releasePackages.length} package(s) at ${releaseVersion}.`);

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
