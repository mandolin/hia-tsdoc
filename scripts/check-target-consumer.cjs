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
/** Synthetic handoff fixture verifies the packed optional CLI without consulting an external target. / synthetic handoff fixture 在不咨询外部 target 的情况下验证已打包的可选 CLI。 */
const handoffFixturePath = path.join(root, "fixtures", "unicode-compatible-handoff", "accepted.handoff.json");
/** Acceptance report fixture is copied into the temporary HIA-owned consumer only; it is never discovered from a target. / acceptance report fixture 只复制到临时 HIA-owned consumer；绝不从 target discovery。 */
const acceptanceReportFixturePath = path.join(root, "fixtures", "unicode-owner-evidence-packet", "accepted.acceptance-report.json");
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
  // <lang><zh-CN>真实归档消费者从安装包读取原生项目API，防止只在workspace链接下可用。</zh-CN><en>A real tarball consumer loads the native project API from installed packages, preventing workspace-link-only success.</en></lang>
  checkProjectApi();
  /** Handoff evidence stays synthetic metadata and is copied only into the temporary HIA-owned consumer. / handoff evidence 保持 synthetic metadata，只复制到临时 HIA-owned consumer。 */
  const consumerHandoffEvidencePath = path.join(consumerDirectory, "handoff-evidence.json");
  fs.copyFileSync(handoffFixturePath, consumerHandoffEvidencePath);
  runBinary(resolveConsumerBin("hia-tsdoc-handoff"), ["--evidence", "handoff-evidence.json", "--out", "handoff-report.json"], consumerDirectory);
  /** Packed report proves the tarball consumer can use the additive command without a monorepo link. / packed report 证明 tarball consumer 可使用 additive command，而不需 monorepo link。 */
  const handoffReport = readJson(path.join(consumerDirectory, "handoff-report.json"));
  if (handoffReport.contract !== "unicode-compatible-tsdoc-handoff" || handoffReport.status !== "accepted") {
    fail("Invalid packed Unicode-compatible TSDoc handoff report.");
  }
  /** Owner-packet reads two already-generated reports and remains entirely within the temporary consumer boundary. / owner-packet 读取两份已经生成的 report，且完全处于临时 consumer boundary 内。 */
  const consumerAcceptanceReportPath = path.join(consumerDirectory, "acceptance-report.json");
  fs.copyFileSync(acceptanceReportFixturePath, consumerAcceptanceReportPath);
  runBinary(resolveConsumerBin("hia-tsdoc-owner-packet"), ["--acceptance", "acceptance-report.json", "--handoff", "handoff-report.json", "--packet-id", "unicode-owner-packet:consumer-r1", "--revision", "r1", "--out", "owner-packet.json"], consumerDirectory);
  /** The packed packet proves public report composition without a monorepo link or target action. / packed packet 证明 public report composition，不需 monorepo link 或 target action。 */
  const ownerPacket = readJson(path.join(consumerDirectory, "owner-packet.json"));
  if (ownerPacket.contract !== "unicode-compatible-owner-evidence-packet" || ownerPacket.status !== "ready-for-owner-review") {
    fail("Invalid packed Unicode-compatible owner evidence packet.");
  }

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
  // <lang><zh-CN>直接用当前Node执行已核包入口，避免Windows命令包装器及shell解释参数。</zh-CN><en>Run the verified package entry with the current Node, avoiding Windows command wrappers and shell argument interpretation.</en></lang>
  return run(process.execPath, [commandPath, ...args], cwd);
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
  // <lang><zh-CN>读取实际归档包的bin映射；只有预期脚本位于该包内时才执行。</zh-CN><en>Read the installed tarball's bin mapping and execute only the expected in-package script.</en></lang>
  const packageRoot = path.join(consumerDirectory, "node_modules", "@hia-doc", "tsdoc-runner");
  const packageJson = readJson(path.join(packageRoot, "package.json"));
  const entry = packageJson.bin?.[name];
  if (typeof entry !== "string" || !/^src\/[a-z-]+\.mjs$/.test(entry)) fail("Invalid installed CLI entry.");
  const binPath = path.join(packageRoot, entry);
  if (!fs.existsSync(binPath)) {
    fail(`Missing target consumer bin: ${name}`);
  }
  return binPath;
}

/**
 * @lang zh-CN 在独立安装目录验证项目提取/两代读取/HIA/直接地图；只写本脚本创建的临时消费者。
 * @lang en Verify project extraction, versioned reading, HIA and direct maps in an independently installed consumer, writing only its owned temporary directory.
 * @returns {void} 成功返回，失败终止。 Returns on success and terminates on failure.
 */
function checkProjectApi() {
  // <lang><zh-CN>输入包含运行即抛出的语句，静态抽取必须仍成功且不执行它。</zh-CN><en>The input throws if evaluated; static extraction must succeed without executing it.</en></lang>
  fs.writeFileSync(path.join(consumerDirectory, "project-api.ts"), 'throw new Error("must not execute"); export const VALUE=3; export interface Item { id:string; }');
  // <lang><zh-CN>导入只能经消费者node_modules解析；断言真实类型与成员、范围和无JS事实。</zh-CN><en>Imports must resolve through the consumer node_modules; assert real types/members, ranges and absence of JS emission facts.</en></lang>
  const probe = `
/** @lang zh-CN 独立归档API冒烟。 @lang en Installed tarball API smoke. */
import assert from "node:assert/strict";
import {extractTsDocProject} from "@hia-doc/ts-doc-extractor/project";
import {readTsDocExtraction} from "@hia-doc/tsdoc-spec";
import {tsDocToHiaDocument} from "@hia-doc/ts-doc-adapter";
import {createTsDocProjectSourceMap} from "@hia-doc/ts-to-js-doc-source-map";
const artifact=extractTsDocProject({workspaceRoot:process.cwd(),entrypoints:["project-api.ts"]});
assert.strictEqual(readTsDocExtraction(artifact),artifact);
assert.equal(artifact.contractVersion,"0.2.0-draft");
assert.equal(artifact.diagnostics.filter(item=>item.severity==="error").length,0);
const document=tsDocToHiaDocument(artifact);
assert(document.symbols.some(item=>item.name==="VALUE"));
assert(document.symbols.some(item=>item.name==="Item"));
assert(document.symbols.some(item=>item.name==="id" && item.parentId));
const map=createTsDocProjectSourceMap(artifact);
assert.equal(map.entries.length,document.symbols.length);
assert.equal(map.sources[0].path,"project-api.ts");
assert.deepEqual(map.sourceMaps,[]);
console.log("Installed native project API passed.");
`;
  // <lang><zh-CN>探针文件固定在临时消费者，Node直接执行而不通过shell。</zh-CN><en>The probe stays in the temporary consumer and runs directly in Node without a shell.</en></lang>
  const probePath = path.join(consumerDirectory, "project-api-smoke.mjs");
  fs.writeFileSync(probePath, probe);
  run(process.execPath, [probePath], consumerDirectory);
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

function fail(message) {
  console.error(message);
  process.exit(1);
}
