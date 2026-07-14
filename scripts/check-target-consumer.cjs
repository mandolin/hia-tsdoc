const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * 验证 hia-tsdoc 是否能作为普通外部项目依赖被 tarball 安装和调用。
 * Verifies that hia-tsdoc can be installed from local tarballs and executed by a normal external consumer project.
 */
const root = path.resolve(__dirname, "..");
const tempRoot = path.join(root, "temp", "target-consumer-smoke");
const tarballDirectory = path.join(tempRoot, "tarballs");
const consumerDirectory = path.join(tempRoot, "consumer");
const exampleDirectory = path.join(root, "examples", "target-project");
const packageRoots = fs.readdirSync(path.join(root, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, "packages", entry.name))
  .filter((directory) => fs.existsSync(path.join(directory, "package.json")))
  .sort();

main();

function main() {
  resetDirectory(tempRoot);
  fs.mkdirSync(tarballDirectory, { recursive: true });
  copyDirectory(exampleDirectory, consumerDirectory, new Set(["dist"]));
  fs.writeFileSync(
    path.join(consumerDirectory, "package.json"),
    `${JSON.stringify({
      name: "hia-tsdoc-target-consumer-smoke",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        docs: "hia-tsdoc --config tsdoc.config.json"
      }
    }, null, 2)}\n`,
    "utf8"
  );

  const tarballs = packageRoots.map(packWorkspacePackage);
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs], consumerDirectory);
  runBinary(resolveConsumerBin("hia-tsdoc"), ["--config", "tsdoc.config.json"], consumerDirectory);

  const outputDirectory = path.join(consumerDirectory, "dist", "hia-tsdoc");
  const manifestPath = path.join(outputDirectory, "tsdoc.producer-result.json");
  if (!fs.existsSync(manifestPath)) {
    fail("Missing target consumer producer result manifest.");
  }

  const manifest = readJson(manifestPath);
  if (manifest.contract !== "documentation-producer-result" || manifest.status !== "success") {
    fail("Invalid target consumer producer result contract or status.");
  }
  if (manifest.artifacts?.length !== 12) {
    fail(`Expected 12 target consumer artifacts, got ${manifest.artifacts?.length ?? 0}.`);
  }

  for (const artifact of manifest.artifacts ?? []) {
    if (!fs.existsSync(path.join(outputDirectory, artifact.path))) {
      fail(`Missing target consumer artifact: ${artifact.path}`);
    }
  }

  assertNoLocalPathLeakage(outputDirectory);
  assertNoEmbeddedSourcesContent(outputDirectory);
  console.log("TSDoc target consumer smoke passed: local tarball install, hia-tsdoc bin and 2 inputs.");
}

function packWorkspacePackage(packageRoot) {
  const result = runNpm(["pack", "--pack-destination", tarballDirectory, "--json"], packageRoot);
  const [pack] = JSON.parse(result.stdout);
  return path.join(tarballDirectory, pack.filename);
}

function runNpm(args, cwd) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const fullArgs = npmCli ? [npmCli, ...args] : args;
  return run(command, fullArgs, cwd);
}

function runBinary(commandPath, args, cwd) {
  if (process.platform === "win32") {
    const commandLine = [quoteCmd(commandPath), ...args.map(quoteCmd)].join(" ");
    const result = spawnSync(commandLine, {
      cwd,
      encoding: "utf8",
      shell: true
    });
    if (result.error || result.status !== 0) {
      process.stderr.write(result.error?.message || result.stderr || result.stdout || `${commandLine} failed.\n`);
      process.exit(1);
    }
    return result;
  }
  return run(commandPath, args, cwd);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8"
  });
  if (result.error || result.status !== 0) {
    process.stderr.write(result.error?.message || result.stderr || result.stdout || `${command} failed.\n`);
    process.exit(1);
  }
  return result;
}

function resolveConsumerBin(name) {
  const extension = process.platform === "win32" ? ".cmd" : "";
  const binPath = path.join(consumerDirectory, "node_modules", ".bin", `${name}${extension}`);
  if (!fs.existsSync(binPath)) {
    fail(`Missing target consumer bin: ${name}`);
  }
  return binPath;
}

function assertNoLocalPathLeakage(outputDirectory) {
  const serialized = listFiles(outputDirectory)
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");
  for (const marker of ["K:\\Project", "Github_mandolin", "HIA-Documentation-Sys"]) {
    if (serialized.includes(marker)) {
      fail(`Local path leakage in target consumer output: ${marker}`);
    }
  }
}

function assertNoEmbeddedSourcesContent(outputDirectory) {
  for (const filePath of listFiles(outputDirectory)) {
    if (!filePath.endsWith(".map")) {
      continue;
    }
    const sourceMap = readJson(filePath);
    if (Array.isArray(sourceMap.sourcesContent) && sourceMap.sourcesContent.length > 0) {
      fail(`Unexpected embedded sourcesContent in ${path.relative(outputDirectory, filePath)}.`);
    }
  }
}

function copyDirectory(sourceDirectory, targetDirectory, ignoredNames) {
  fs.mkdirSync(targetDirectory, { recursive: true });
  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) {
      continue;
    }
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, ignoredNames);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function resetDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function quoteCmd(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
