/**
 * @file
 * @lang zh-CN TypeScript 同轮坐标侧载的原始字节、身份、隐私与失效撤销回归。
 * @lang en Regressions for same-build TypeScript coordinate sidecar bytes, identities, privacy and stale-proof revocation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTsDoc } from "../packages/tsdoc-runner/src/index.mjs";
import { createTypeScriptCoordinateProfile } from "../packages/tsdoc-runner/src/coordinate-profile.mjs";

/** @lang zh-CN 仅引用仓内公开合成夹具。 @lang en Use only this repository's public synthetic fixture. */
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @lang zh-CN 读取器使用的 canonical SHA-256 Base64 摘要。
 * @lang en Canonical SHA-256 Base64 digest used by the strict reader.
 * @param {Uint8Array} bytes <lang><zh-CN>本次实际字节。</zh-CN><en>Actual bytes for this run.</en></lang>
 * @returns {string} <lang><zh-CN>32 字节摘要的 Base64。</zh-CN><en>Base64 of the 32-byte digest.</en></lang>
 */
function digest(bytes) { return createHash("sha256").update(bytes).digest("base64"); }

/**
 * @lang zh-CN 仅清理本测试创建的系统临时目录，不跨工作区边界删除。
 * @lang en Remove only a test-owned direct child of the system temporary directory.
 * @param {string} directory <lang><zh-CN>待清理目录。</zh-CN><en>Directory to remove.</en></lang>
 * @returns {Promise<void>} <lang><zh-CN>清理完成。</zh-CN><en>Cleanup completion.</en></lang>
 */
async function cleanup(directory) {
  const temporaryRoot = await fs.realpath(os.tmpdir());
  const actual = await fs.realpath(directory);
  assert.equal(path.dirname(actual), temporaryRoot);
  assert.ok(path.basename(actual).startsWith("hia-ts-coordinate-test-"));
  await fs.rm(actual, { recursive: true, force: true });
}

/**
 * @lang zh-CN 显式开启侧载，仅以现有计算器合成夹具为单来源输入。
 * @lang en Explicitly enable the sidecar for the existing single-source calculator fixture.
 * @param {string} workspaceRoot <lang><zh-CN>受控临时工作区。</zh-CN><en>Controlled temporary workspace.</en></lang>
 * @param {boolean} enabled <lang><zh-CN>是否启用坐标侧载。</zh-CN><en>Whether to emit coordinate evidence.</en></lang>
 * @returns {Promise<object>} <lang><zh-CN>生产结果。</zh-CN><en>Producer result.</en></lang>
 */
function runFixture(workspaceRoot, enabled) {
  return runTsDoc({
    workspaceRoot,
    outputDirectory: path.join(workspaceRoot, "out"),
    inputs: [{ kind: "typescript-entry", path: "src/calculator.ts", artifactBasePath: "calculator" }],
    options: { emitCoordinateProfile: enabled, emitDocSourceMap: true, sourcesContentPolicy: "none", writeResultManifest: false }
  });
}

/**
 * @lang zh-CN 把仓内公开夹具复制到独立临时工作区，确保普通地图来源相对路径仍可解析。
 * @lang en Copy the public fixture to an isolated workspace so the ordinary map's relative source remains resolvable.
 * @param {string} workspaceRoot <lang><zh-CN>测试拥有的临时根。</zh-CN><en>Test-owned temporary root.</en></lang>
 * @returns {Promise<void>} <lang><zh-CN>公开夹具已复制。</zh-CN><en>Public fixture copied.</en></lang>
 */
async function prepareFixture(workspaceRoot) {
  const sourceDirectory = path.join(workspaceRoot, "src");
  await fs.mkdir(sourceDirectory, { recursive: true });
  await fs.copyFile(path.join(repositoryRoot, "fixtures/doc-source-map/ts-js/src/calculator.ts"), path.join(sourceDirectory, "calculator.ts"));
}

/** @lang zh-CN 真正写出的双图和来源字节必须与侧载摘要逐一相符，且产物无暂存路径/正文。 @lang en The actual two maps and source bytes must match every sidecar digest, without staged paths or source text in public artifacts. */
test("opt-in signs one exact TypeScript source slot from actual bytes", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    const outputDirectory = path.join(temporaryRoot, "out");
    const result = await runFixture(temporaryRoot, true);
    assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
    const descriptor = result.artifacts.find((artifact) => artifact.kind === "ordinary-source-map-coordinate-profile");
    assert.equal(descriptor?.contractVersion, "0.1.0-draft");
    const profilePath = path.join(outputDirectory, "calculator.coordinate-profile.json");
    const profileBytes = await fs.readFile(profilePath);
    const profile = JSON.parse(profileBytes.toString("utf8"));
    const ordinaryBytes = await fs.readFile(path.join(outputDirectory, "calculator.js.map"));
    const documentationBytes = await fs.readFile(path.join(outputDirectory, "calculator.docmap.json"));
    const sourceBytes = await fs.readFile(path.join(temporaryRoot, "src/calculator.ts"));
    const ordinary = JSON.parse(ordinaryBytes.toString("utf8"));
    const documentation = JSON.parse(documentationBytes.toString("utf8"));
    assert.equal(profile.contract, "ordinary-source-map-coordinate-profile");
    assert.equal(profile.ordinaryMap.digest.value, digest(ordinaryBytes));
    assert.equal(profile.documentationMap.digest.value, digest(documentationBytes));
    assert.equal(profile.ordinaryMap.sourceMapId, documentation.sourceMaps[0].id);
    assert.equal(profile.ordinaryMap.artifactId, documentation.sourceMaps[0].mapsFrom);
    assert.equal(profile.documentationMap.id, documentation.id);
    assert.equal(profile.sourceSlots.length, 1);
    assert.equal(profile.sourceSlots[0].sourceId, documentation.sources[0].id);
    assert.equal(profile.sourceSlots[0].sourceIndex, 0);
    assert.equal(profile.sourceSlots[0].columnUnit, "utf16-code-unit");
    assert.equal(profile.sourceSlots[0].sourceByteDigest.value, digest(sourceBytes));
    assert.equal(profile.sourceSlots[0].sourceTextDigest.value, digest(Buffer.from(sourceBytes.toString("utf8"), "utf16le")));
    assert.deepEqual(ordinary.sourcesContent, []);
    assert.equal(ordinary.sources.length, 1);
    assert.ok(ordinary.mappings.length > 0);
    assert.ok(documentation.entries.some((entry) => entry.id === "entry:function-add"));
    assert.equal(profileBytes.includes(Buffer.from(temporaryRoot, "utf8")), false);
    assert.equal(ordinaryBytes.includes(Buffer.from(temporaryRoot, "utf8")), false);
    assert.equal(profileBytes.includes(sourceBytes), false);
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 真实 CLI 开关和配置覆盖能产出同一侧载，帮助宿主只改命令行启用。 @lang en The real CLI flag overrides config and emits the same sidecar, allowing a host to opt in from the command line. */
test("CLI coordinate-profile flag enables the sidecar from config", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    const configPath = path.join(temporaryRoot, "tsdoc.config.json");
    await fs.writeFile(configPath, JSON.stringify({
      schemaVersion: "0.1.0-draft", workspaceRoot: ".", outputDirectory: "out",
      inputs: [{ kind: "typescript-entry", path: "src/calculator.ts", artifactBasePath: "calculator" }],
      options: { emitDocSourceMap: true, sourcesContentPolicy: "none", writeResultManifest: false }
    }), "utf8");
    const cli = spawnSync(process.execPath, [path.join(repositoryRoot, "packages/tsdoc-runner/src/cli.mjs"), "--config", configPath, "--coordinate-profile"],
      { cwd: repositoryRoot, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /TSDoc success/);
    const profile = JSON.parse(await fs.readFile(path.join(temporaryRoot, "out/calculator.coordinate-profile.json"), "utf8"));
    assert.equal(profile.contractVersion, "0.1.0-draft");
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 关闭 opt-in 时既有编译内容不变，旧侧载必须撤销。 @lang en Opt-out preserves previous compiler output and revokes a stale sidecar. */
test("opt-out preserves ordinary output and removes a previous sidecar", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    const outputDirectory = path.join(temporaryRoot, "out");
    assert.equal((await runFixture(temporaryRoot, true)).status, "success");
    const beforeJs = await fs.readFile(path.join(outputDirectory, "calculator.js"));
    const beforeMap = await fs.readFile(path.join(outputDirectory, "calculator.js.map"));
    const beforeDocumentation = await fs.readFile(path.join(outputDirectory, "calculator.docmap.json"));
    const result = await runFixture(temporaryRoot, false);
    assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
    assert.equal(result.artifacts.some((artifact) => artifact.kind === "ordinary-source-map-coordinate-profile"), false);
    await assert.rejects(fs.access(path.join(outputDirectory, "calculator.coordinate-profile.json")), { code: "ENOENT" });
    assert.deepEqual(await fs.readFile(path.join(outputDirectory, "calculator.js")), beforeJs);
    assert.deepEqual(await fs.readFile(path.join(outputDirectory, "calculator.js.map")), beforeMap);
    assert.deepEqual(await fs.readFile(path.join(outputDirectory, "calculator.docmap.json")), beforeDocumentation);
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 严格写入禁止嵌入正文及缺少文档地图。 @lang en Strict writing refuses embedded source text or a missing documentation map. */
test("opt-in refuses incompatible map and privacy options", async () => {
  const base = {
    workspaceRoot: repositoryRoot,
    outputDirectory: path.join(os.tmpdir(), "hia-ts-coordinate-test-uncreated"),
    inputs: [{ kind: "typescript-entry", path: "fixtures/doc-source-map/ts-js/src/calculator.ts" }]
  };
  await assert.rejects(runTsDoc({ ...base, options: { emitCoordinateProfile: true, emitDocSourceMap: false } }), /emitCoordinateProfile/);
  await assert.rejects(runTsDoc({ ...base, options: { emitCoordinateProfile: true, sourcesContentPolicy: "embed" } }), /emitCoordinateProfile/);
});

/** @lang zh-CN BOM、CRLF 与非 BMP 同在一份快照时，原始字节和保真的 UTF-16 逻辑文本需分别签名。 @lang en BOM, CRLF and non-BMP text must produce separate raw-byte and exact UTF-16 logical-text digests from one snapshot. */
test("signs BOM CRLF and non-BMP source from one immutable snapshot", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    const sourceDirectory = path.join(temporaryRoot, "src");
    await fs.mkdir(sourceDirectory, { recursive: true });
    const source = "\uFEFFconst mark = \"😀\"; /** Summary. */ export function smile(): string { return mark; }\r\n";
    const sourceBytes = Buffer.from(source, "utf8");
    await fs.writeFile(path.join(sourceDirectory, "calculator.ts"), sourceBytes);
    const result = await runFixture(temporaryRoot, true);
    assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
    const outputDirectory = path.join(temporaryRoot, "out");
    const profile = JSON.parse(await fs.readFile(path.join(outputDirectory, "calculator.coordinate-profile.json"), "utf8"));
    const ordinary = JSON.parse(await fs.readFile(path.join(outputDirectory, "calculator.js.map"), "utf8"));
    const documentation = JSON.parse(await fs.readFile(path.join(outputDirectory, "calculator.docmap.json"), "utf8"));
    assert.equal(profile.sourceSlots[0].sourceByteDigest.value, digest(sourceBytes));
    assert.equal(profile.sourceSlots[0].sourceTextDigest.value, digest(Buffer.from(source, "utf16le")));
    assert.equal(profile.sourceSlots[0].columnUnit, "utf16-code-unit");
    assert.ok(ordinary.mappings.length > 0);
    const entry = documentation.entries.find((item) => item.symbolId === "function:smile");
    assert.ok(entry);
    assert.equal(entry.sourceRefs[0].rangeConvention.columnUnit, "utf16-code-unit");
    assert.ok(entry.sourceRefs[0].range.start.column > source.indexOf("😀") + 1);
    assert.equal(ordinary.sourcesContent.length, 0);
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 输入失效时先撤销旧证明，公开诊断不回显临时编译路径。 @lang en Invalid input first revokes stale evidence and public diagnostics do not echo temporary compile paths. */
test("invalid UTF-8 revokes the earlier profile without exposing source bytes", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    assert.equal((await runFixture(temporaryRoot, true)).status, "success");
    await fs.writeFile(path.join(temporaryRoot, "src/calculator.ts"), Buffer.from([0xff]));
    const result = await runFixture(temporaryRoot, true);
    assert.equal(result.status, "failed");
    assert.equal(result.artifacts.some((artifact) => artifact.kind === "ordinary-source-map-coordinate-profile"), false);
    assert.equal(JSON.stringify(result.diagnostics).includes(temporaryRoot), false);
    await assert.rejects(fs.access(path.join(temporaryRoot, "out/calculator.coordinate-profile.json")), { code: "ENOENT" });
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 超过严格读取器上限的源码不能先整件分配，也必须撤销上轮证明。 @lang en An oversized source is rejected before whole-file allocation and revokes the previous proof. */
test("oversized source revokes proof without reading or signing", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    assert.equal((await runFixture(temporaryRoot, true)).status, "success");
    const sourceHandle = await fs.open(path.join(temporaryRoot, "src/calculator.ts"), "w");
    try { await sourceHandle.truncate(16 * 1024 * 1024 + 1); } finally { await sourceHandle.close(); }
    const result = await runFixture(temporaryRoot, true);
    assert.equal(result.status, "failed");
    assert.equal(result.artifacts.length, 0);
    await assert.rejects(fs.access(path.join(temporaryRoot, "out/calculator.coordinate-profile.json")), { code: "ENOENT" });
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 私有镜像不复制原工作区导入图；不可证明的导入或多来源编译不发布侧载。 @lang en The private snapshot does not copy the workspace import graph; unproven imported or multi-source compilation emits no sidecar. */
test("does not sign an imported dependency from the original workspace", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    const sourceDirectory = path.join(temporaryRoot, "src");
    await fs.mkdir(sourceDirectory, { recursive: true });
    await fs.writeFile(path.join(sourceDirectory, "dependency.ts"), "export const answer = 42;\n", "utf8");
    await fs.writeFile(path.join(sourceDirectory, "calculator.ts"), "import { answer } from './dependency.js';\nexport const value = answer;\n", "utf8");
    const result = await runFixture(temporaryRoot, true);
    assert.equal(result.status, "failed");
    assert.equal(result.artifacts.some((artifact) => artifact.kind === "ordinary-source-map-coordinate-profile"), false);
    assert.equal(JSON.stringify(result.diagnostics).includes(temporaryRoot), false);
    await assert.rejects(fs.access(path.join(temporaryRoot, "out/calculator.coordinate-profile.json")), { code: "ENOENT" });
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 来源符号链接逃出工作区时，不读取外部正文以签发证明。 @lang en A source symlink escaping the workspace cannot authorize an external body for evidence. */
test("rejects a source symlink outside the workspace", async (context) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await fs.mkdir(path.join(temporaryRoot, "src"), { recursive: true });
    const outsideSource = path.join(outsideRoot, "external.ts");
    await fs.writeFile(outsideSource, "export const external = true;\n", "utf8");
    try {
      await fs.symlink(outsideSource, path.join(temporaryRoot, "src/calculator.ts"), "file");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) { context.skip("Symlink creation is unavailable on this host."); return; }
      throw error;
    }
    const result = await runFixture(temporaryRoot, true);
    assert.equal(result.status, "failed");
    assert.equal(result.artifacts.some((artifact) => artifact.kind === "ordinary-source-map-coordinate-profile"), false);
    await assert.rejects(fs.access(path.join(temporaryRoot, "out/calculator.coordinate-profile.json")), { code: "ENOENT" });
  } finally {
    await cleanup(temporaryRoot);
    await cleanup(outsideRoot);
  }
});

/** @lang zh-CN 输出位于工作区外时不把主机目录结构写入普通地图，也不发布侧载。 @lang en Out-of-workspace output cannot place host directory structure in the ordinary map or publish a profile. */
test("refuses coordinate output outside the workspace", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    const workspaceRoot = path.join(temporaryRoot, "workspace");
    await fs.mkdir(workspaceRoot);
    await prepareFixture(workspaceRoot);
    const outputDirectory = path.join(temporaryRoot, "outside");
    await assert.rejects(runTsDoc({
      workspaceRoot,
      outputDirectory,
      inputs: [{ kind: "typescript-entry", path: "src/calculator.ts", artifactBasePath: "calculator" }],
      options: { emitCoordinateProfile: true, emitDocSourceMap: true, sourcesContentPolicy: "none", writeResultManifest: false }
    }), /Coordinate output/);
    await assert.rejects(fs.access(path.join(outputDirectory, "calculator.js.map")), { code: "ENOENT" });
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 两个输入不得共用严格侧载工件基名，以免后一条覆盖前一条已签双图。 @lang en Two strict inputs cannot share an artifact base and overwrite a prior input's signed maps. */
test("rejects colliding opt-in artifact bases before any output", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    const outputDirectory = path.join(temporaryRoot, "out");
    await assert.rejects(runTsDoc({
      workspaceRoot: temporaryRoot,
      outputDirectory,
      inputs: [
        { kind: "typescript-entry", path: "src/calculator.ts", artifactBasePath: "nested/shared" },
        { kind: "typescript-entry", path: "src/calculator.ts", artifactBasePath: "nested/./shared" }
      ],
      options: { emitCoordinateProfile: true, emitDocSourceMap: true, sourcesContentPolicy: "none" }
    }), /artifact base/);
    await assert.rejects(fs.access(outputDirectory), { code: "ENOENT" });
  } finally {
    await cleanup(temporaryRoot);
  }
});

/** @lang zh-CN 输出子目录若预先指向外部，构建不得撤销或覆写外部证明与产物。 @lang en A pre-existing output-directory symlink must not delete or overwrite an external proof or artifact. */
test("rejects a symlinked nested output before revoking or writing", async (context) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    await fs.mkdir(path.join(temporaryRoot, "out"));
    const outsideProof = path.join(outsideRoot, "calculator.coordinate-profile.json");
    const outsideMap = path.join(outsideRoot, "calculator.js.map");
    await fs.writeFile(outsideProof, "retain proof\n", "utf8");
    await fs.writeFile(outsideMap, "retain map\n", "utf8");
    try {
      await fs.symlink(outsideRoot, path.join(temporaryRoot, "out", "nested"), "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) { context.skip("Symlink creation is unavailable on this host."); return; }
      throw error;
    }
    const result = await runTsDoc({
      workspaceRoot: temporaryRoot,
      outputDirectory: path.join(temporaryRoot, "out"),
      inputs: [{ kind: "typescript-entry", path: "src/calculator.ts", artifactBasePath: "nested/calculator" }],
      options: { emitCoordinateProfile: true, emitDocSourceMap: true, sourcesContentPolicy: "none", writeResultManifest: false }
    });
    assert.equal(result.status, "failed");
    assert.equal(result.artifacts.length, 0);
    assert.equal(await fs.readFile(outsideProof, "utf8"), "retain proof\n");
    assert.equal(await fs.readFile(outsideMap, "utf8"), "retain map\n");
  } finally {
    await cleanup(temporaryRoot);
    await cleanup(outsideRoot);
  }
});

/** @lang zh-CN 现有输出文件若与外部文件共用硬链接，严格构建不能覆写该 inode。 @lang en A strict build must not overwrite an existing output file hard-linked to an external inode. */
test("rejects a pre-existing hard-linked output artifact", async (context) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    await fs.mkdir(path.join(temporaryRoot, "out"));
    const outsideMap = path.join(outsideRoot, "external.map");
    await fs.writeFile(outsideMap, "retain map\n", "utf8");
    try {
      await fs.link(outsideMap, path.join(temporaryRoot, "out/calculator.js.map"));
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP", "EXDEV"].includes(error?.code)) { context.skip("Hard links are unavailable on this host."); return; }
      throw error;
    }
    const result = await runFixture(temporaryRoot, true);
    assert.equal(result.status, "failed");
    assert.equal(result.artifacts.length, 0);
    assert.equal(await fs.readFile(outsideMap, "utf8"), "retain map\n");
  } finally {
    await cleanup(temporaryRoot);
    await cleanup(outsideRoot);
  }
});

/** @lang zh-CN 关闭侧载保持旧式链接目录写入，但绝不穿过该链接删除外部旧证明。 @lang en Opt-out retains legacy linked-directory output while never deleting an external stale proof through that link. */
test("opt-out preserves legacy linked output without external proof deletion", async (context) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    await fs.mkdir(path.join(temporaryRoot, "out"));
    const outsideProof = path.join(outsideRoot, "calculator.coordinate-profile.json");
    await fs.writeFile(outsideProof, "retain proof\n", "utf8");
    try {
      await fs.symlink(outsideRoot, path.join(temporaryRoot, "out", "nested"), "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) { context.skip("Symlink creation is unavailable on this host."); return; }
      throw error;
    }
    const result = await runTsDoc({
      workspaceRoot: temporaryRoot,
      outputDirectory: path.join(temporaryRoot, "out"),
      inputs: [{ kind: "typescript-entry", path: "src/calculator.ts", artifactBasePath: "nested/calculator" }],
      options: { emitCoordinateProfile: false, emitDocSourceMap: true, sourcesContentPolicy: "none", writeResultManifest: false }
    });
    assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
    assert.equal(await fs.readFile(outsideProof, "utf8"), "retain proof\n");
    assert.ok((await fs.readFile(path.join(outsideRoot, "calculator.js.map"))).length > 0);
  } finally {
    await cleanup(temporaryRoot);
    await cleanup(outsideRoot);
  }
});

/** @lang zh-CN 只有带原始来源的段能签发槽位；不匹配的文档路径及非法来源序号拒绝。 @lang en Only original-bearing segments sign a slot; a mismatched documentation path or invalid source ordinal is refused. */
test("does not sign generated-only segments or mismatched source identities", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hia-ts-coordinate-test-"));
  try {
    await prepareFixture(temporaryRoot);
    assert.equal((await runFixture(temporaryRoot, true)).status, "success");
    const outputDirectory = path.join(temporaryRoot, "out");
    const sourceMapPath = "calculator.js.map";
    const sourcePath = "src/calculator.ts";
    const sourceBytes = await fs.readFile(path.join(temporaryRoot, sourcePath));
    const ordinaryMap = JSON.parse(await fs.readFile(path.join(outputDirectory, sourceMapPath), "utf8"));
    const documentationMap = JSON.parse(await fs.readFile(path.join(outputDirectory, "calculator.docmap.json"), "utf8"));
    const serialize = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    const input = { sourceBytes, sourceText: sourceBytes.toString("utf8"), sourcePath, workspaceRoot: temporaryRoot,
      outputDirectory, sourceMapPath, ordinaryMap, ordinaryMapBytes: serialize(ordinaryMap), documentationMap,
      documentationMapBytes: serialize(documentationMap), inputIndex: 0 };
    const generatedOnly = { ...ordinaryMap, mappings: "A;A" };
    assert.deepEqual(createTypeScriptCoordinateProfile({ ...input, ordinaryMap: generatedOnly, ordinaryMapBytes: serialize(generatedOnly) }).sourceSlots, []);
    const wrongOrdinal = { ...ordinaryMap, mappings: "ACAA" };
    assert.throws(() => createTypeScriptCoordinateProfile({ ...input, ordinaryMap: wrongOrdinal, ordinaryMapBytes: serialize(wrongOrdinal) }), /source slot/);
    const wrongDocument = structuredClone(documentationMap);
    wrongDocument.sources[0].path = "src/other.ts";
    assert.throws(() => createTypeScriptCoordinateProfile({ ...input, documentationMap: wrongDocument,
      documentationMapBytes: serialize(wrongDocument) }), /identities/);
    const staleBytes = Buffer.from(input.ordinaryMapBytes);
    staleBytes[staleBytes.length - 2] ^= 1;
    assert.throws(() => createTypeScriptCoordinateProfile({ ...input, ordinaryMapBytes: staleBytes }), /bytes/);
  } finally {
    await cleanup(temporaryRoot);
  }
});
