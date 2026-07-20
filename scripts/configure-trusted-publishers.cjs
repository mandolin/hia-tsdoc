const { execFileSync, execSync } = require("node:child_process");

const { loadReleasePackages } = require("./release-packages.cjs");

const npmVersion = "11.18.0";
const registry = "https://registry.npmjs.org/";
const repository = "mandolin/hia-tsdoc";
const workflowFile = "npm-trusted-publish.yml";

function parseArgs(args) {
  const options = {
    dryRun: false,
    otp: "",
    packageName: ""
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--otp=")) {
      options.otp = arg.slice("--otp=".length);
    } else if (arg.startsWith("--package=")) {
      options.packageName = arg.slice("--package=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function commandForPackage(packageName, options) {
  const args = [
    `npm@${npmVersion}`,
    "trust",
    "github",
    packageName,
    "--repo",
    repository,
    "--file",
    workflowFile,
    "--allow-publish",
    "--yes",
    `--registry=${registry}`
  ];

  if (options.dryRun) {
    args.push("--dry-run");
  }

  if (options.otp) {
    args.push(`--otp=${options.otp}`);
  }

  return args;
}

// 中文：集中配置 npm Trusted Publisher，避免逐包手写命令时填错仓库或 workflow 文件。
// English: Configures npm Trusted Publisher centrally to avoid per-package repository or workflow typos.
function runPackage(packageName, options) {
  const args = commandForPackage(packageName, options);
  console.log(`Configuring Trusted Publisher for ${packageName}${options.dryRun ? " (dry run)" : ""}...`);
  if (process.platform === "win32") {
    const quotedArgs = args.map((arg) => `"${arg.replaceAll('"', '\\"')}"`).join(" ");
    execSync(`npx ${quotedArgs}`, {
      encoding: "utf8",
      stdio: "inherit"
    });
    return;
  }

  execFileSync("npx", args, {
    encoding: "utf8",
    stdio: "inherit"
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const packages = loadReleasePackages();
  const selected = options.packageName ? packages.filter((item) => item.name === options.packageName) : packages;

  if (selected.length === 0) {
    throw new Error(`Unknown TSDoc release package: ${options.packageName}`);
  }

  for (const item of selected) {
    runPackage(item.name, options);
  }
}

main();
