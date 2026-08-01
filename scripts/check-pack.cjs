const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageRoots = fs.readdirSync(path.join(root, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, "packages", entry.name))
  .filter((directory) => fs.existsSync(path.join(directory, "package.json")));
const npmCli = process.env.npm_execpath;
const npmArgs = ["pack", "--dry-run", "--json"];
const command = npmCli
  ? process.execPath
  : process.platform === "win32"
    ? process.env.ComSpec || "cmd.exe"
    : "npm";
const args = npmCli
  ? [npmCli, ...npmArgs]
  : process.platform === "win32"
    ? ["/d", "/s", "/c", `npm ${npmArgs.join(" ")}`]
    : npmArgs;
let failed = false;

for (const packageRoot of packageRoots) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    encoding: "utf8"
  });
  if (result.error || result.status !== 0) {
    process.stderr.write(result.error?.message || result.stderr || result.stdout || "npm pack failed.\n");
    failed = true;
    continue;
  }
  const [pack] = JSON.parse(result.stdout);
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const packedPaths = new Set((pack.files || []).map((file) => file.path.replaceAll("\\", "/")));
  for (const file of pack.files || []) {
    const filePath = file.path.replaceAll("\\", "/");
    if (filePath.includes("/node_modules/") || filePath.startsWith("node_modules/") || filePath.endsWith(".tgz")) {
      console.error(`Unsafe file in TSDoc pack dry-run: ${file.path}`);
      failed = true;
    }
  }
  for (const requiredPath of ["LICENSE", "README.md", "package.json", "src/index.mjs"]) {
    if (!packedPaths.has(requiredPath)) {
      console.error(`Missing ${requiredPath} in ${packageJson.name} pack dry-run.`);
      failed = true;
    }
  }
  if (packageJson.name === "@hia-doc/tsdoc-runner" && !packedPaths.has("src/cli.mjs")) {
    console.error("Missing src/cli.mjs in @hia-doc/tsdoc-runner pack dry-run.");
    failed = true;
  }
  if (packageJson.name === "@hia-doc/tsdoc-runner") {
    /** The optional handoff and owner-packet binaries/evaluators must cross the same tarball boundary as the runner. / 可选 handoff 与 owner-packet binary/evaluator 必须和 runner 跨越同一 tarball boundary。 */
    const unicodeBoundaryFiles = [
      "src/handoff-cli.mjs",
      "src/unicode-compatible-handoff.mjs",
      "src/owner-evidence-packet-cli.mjs",
      "src/unicode-compatible-owner-evidence-packet.mjs"
    ];
    for (const unicodeBoundaryFile of unicodeBoundaryFiles) {
      if (!packedPaths.has(unicodeBoundaryFile)) {
        console.error(`Missing ${unicodeBoundaryFile} in @hia-doc/tsdoc-runner pack dry-run.`);
        failed = true;
      }
    }
  }
  if (packageJson.name === "@hia-doc/tsdoc-runner") {
    if (packageJson.bin?.["hia-tsdoc"] !== "src/cli.mjs") {
      console.error("Missing hia-tsdoc bin alias in @hia-doc/tsdoc-runner.");
      failed = true;
    }
    if (packageJson.bin?.tsdoc !== "src/cli.mjs") {
      console.error("Missing tsdoc compatibility bin alias in @hia-doc/tsdoc-runner.");
      failed = true;
    }
    /** Handoff has an independent name so normal TSDoc generation commands retain their existing surface. / handoff 采用独立名称，使普通 TSDoc generation command 保持原有 surface。 */
    if (packageJson.bin?.["hia-tsdoc-handoff"] !== "src/handoff-cli.mjs") {
      console.error("Missing hia-tsdoc-handoff bin in @hia-doc/tsdoc-runner.");
      failed = true;
    }
    /** Owner-packet has an independent name so handoff and ordinary generation remain backward compatible. / owner-packet 采用独立名称，使 handoff 与普通 generation 保持 backward compatible。 */
    if (packageJson.bin?.["hia-tsdoc-owner-packet"] !== "src/owner-evidence-packet-cli.mjs") {
      console.error("Missing hia-tsdoc-owner-packet bin in @hia-doc/tsdoc-runner.");
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`TSDoc pack check passed: ${packageRoots.length} workspace packages.`);
