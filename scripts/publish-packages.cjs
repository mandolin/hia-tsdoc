const { spawnSync } = require("node:child_process");
const path = require("node:path");

const { loadReleasePackages } = require("./release-packages.cjs");

const root = path.resolve(__dirname, "..");
const releasePackages = loadReleasePackages();
const releaseVersion = releasePackages[0]?.version;
const options = parseArgs(process.argv.slice(2));
const registry = options.registry;

// 中文：按内部依赖顺序发布，确保后续包安装时能解析同版本 workspace 依赖。
// English: Publishes in internal dependency order so later packages can resolve same-version workspace dependencies.
for (const item of releasePackages) {
  if (item.version !== releaseVersion) {
    console.error(`${item.name} version must match release ${releaseVersion}; found ${item.version}.`);
    process.exit(1);
  }

  if (isPublished(item.name, releaseVersion)) {
    console.log(`Skipping ${item.name}@${releaseVersion}; already published in ${registry}.`);
    continue;
  }

  console.log(`Publishing ${item.name}@${releaseVersion} to ${registry}`);
  const publishArgs = ["publish", "--access", "public", `--registry=${registry}`];
  if (options.otp) {
    publishArgs.push(`--otp=${options.otp}`);
  }
  const result = runNpm(publishArgs, { cwd: item.root });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Publishing stopped at ${item.name}@${releaseVersion}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`TSDoc publish completed for ${releasePackages.length} package(s) at ${releaseVersion}.`);

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

function isPublished(packageName, version) {
  const result = runNpmQuiet(["view", `${packageName}@${version}`, "version", `--registry=${registry}`], { cwd: root });
  if (result.status === 0) {
    return true;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (/\bE404\b|No match found|is not in this registry|404 Not Found/i.test(output)) {
    return false;
  }

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Unable to confirm ${packageName}@${version} registry status.`);
}

function runNpmQuiet(args, options) {
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

function parseArgs(args) {
  const parsed = {
    otp: process.env.HIA_NPM_OTP || "",
    registry: process.env.HIA_NPM_REGISTRY || "https://registry.npmjs.org/"
  };

  for (const arg of args) {
    if (arg.startsWith("--otp=")) {
      parsed.otp = arg.slice("--otp=".length);
    } else if (arg.startsWith("--registry=")) {
      parsed.registry = arg.slice("--registry=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}
