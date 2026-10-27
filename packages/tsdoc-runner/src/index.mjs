import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { open, readFile, lstat, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tsDocToHiaDocument } from "@hia-doc/ts-doc-adapter";
import { extractTsDoc } from "@hia-doc/ts-doc-extractor";
import { tsDocToJsDocBridgeArtifact } from "@hia-doc/ts-jsdoc-bridge";
import { createTsJsDocSourceMap } from "@hia-doc/ts-to-js-doc-source-map";
import { createTypeScriptCoordinateProfile, decodeCoordinateSource } from "./coordinate-profile.mjs";
import {
  TSDOC_EXTRACTION_CONTRACT,
  TSDOC_EXTRACTION_CONTRACT_VERSION
} from "@hia-doc/tsdoc-spec";

export {
  TSDOC_CONFIG_JSON_SCHEMA,
  TSDOC_CONFIG_SCHEMA_ID,
  TSDOC_CONFIG_SCHEMA_VERSION
} from "./schema.mjs";

/**
 * Public metadata-only evaluator for optional Unicode-compatible host handoffs.
 * 面向可选 Unicode-compatible 宿主交接的公开 metadata-only 评估器。
 *
 * It does not discover projects, read source/artifact bodies, or execute target commands.
 * 它不发现项目、不读取源码/产物正文，也不执行目标命令。
 */
export {
  UNICODE_COMPATIBLE_TARGET_FAMILY,
  UNICODE_COMPATIBLE_TSDOC_HANDOFF_CONTRACT,
  UNICODE_COMPATIBLE_TSDOC_HANDOFF_DIAGNOSTIC_CODES,
  UNICODE_COMPATIBLE_TSDOC_HANDOFF_VERSION,
  evaluateUnicodeCompatibleTsDocHandoff
} from "./unicode-compatible-handoff.mjs";

/**
 * Public metadata-only evaluator for optional Unicode-compatible owner evidence packets.
 * 面向可选 Unicode-compatible owner evidence packet 的公开 metadata-only 评估器。
 *
 * It combines two explicit report objects only; it does not import the main CLI runtime or discover a target project.
 * 它只组合两份显式 report object；不导入 main CLI runtime，也不发现 target project。
 */
export {
  UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_CONTRACT,
  UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_DIAGNOSTIC_CODES,
  UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION,
  createUnicodeCompatibleOwnerEvidencePacket
} from "./unicode-compatible-owner-evidence-packet.mjs";
import { TSDOC_CONFIG_SCHEMA_ID, TSDOC_CONFIG_SCHEMA_VERSION } from "./schema.mjs";

export const TSDOC_RUNNER_VERSION = "0.1.3";
export const TSDOC_INPUT_KINDS = Object.freeze(["typescript-entry"]);
export const TSDOC_OUTPUT_KINDS = Object.freeze([
  "generated-js",
  "ordinary-source-map",
  "tsdoc-extraction",
  "jsdoc-bridge",
  "hia-document",
  "doc-source-map",
  "ordinary-source-map-coordinate-profile"
]);

const require = createRequire(import.meta.url);
const RESULT_CONTRACT = "documentation-producer-result";
const RESULT_CONTRACT_VERSION = "0.1.0-draft";
const PRODUCER_ID = "tsdoc";
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
/** @lang zh-CN 严格读取器允许签发的单件最大字节数。 @lang en Maximum per-artifact bytes eligible for the strict reader. */
const COORDINATE_ARTIFACT_LIMIT = 16 * 1024 * 1024;

/**
 * 执行一次 TypeScript/TSDoc 文档构建，并返回标准 documentation producer result。
 * Runs one TypeScript/TSDoc documentation build and returns the standard documentation producer result.
 *
 * @param {object} request TSDoc runner request with absolute workspace/output directories.
 * @param {{ signal?: AbortSignal, reportProgress?: Function }} [context] Optional producer runtime context.
 * @returns {Promise<object>} Documentation producer result.
 */
export async function runTsDoc(request, context = {}) {
  const normalized = normalizeRequest(request);
  // <lang><zh-CN>签发侧载前逐级建立并检查输出根，不能先通过输出符号链接创建工作区外的目录。</zh-CN><en>Build and inspect each strict output-root component before signing; never create external directories through an output symlink.</en></lang>
  if (normalized.options.emitCoordinateProfile) {
    await ensureCoordinateDirectory(normalized.workspaceRoot, normalized.outputDirectory);
    if (normalized.options.writeResultManifest) {
      await assertSafeOutputFile(normalized.outputDirectory, "tsdoc.producer-result.json");
    }
  } else {
    await mkdir(normalized.outputDirectory, { recursive: true });
  }

  const artifacts = [];
  const diagnostics = [];
  let completed = 0;

  for (const [index, input] of normalized.inputs.entries()) {
    if (context.signal?.aborted) {
      // <lang><zh-CN>尚未进入输入的安全预检时不得按未核路径全局删除旧文件；消费方始终需重核实际字节。</zh-CN><en>Before input path preflight, do not globally delete through unchecked paths; consumers must always reverify actual bytes.</en></lang>
      diagnostics.push(createDiagnostic("TSDOC_RUNNER_ABORTED", "TSDoc runner was aborted before all inputs completed.", "error"));
      break;
    }

    context.reportProgress?.({
      phase: "extract",
      current: index,
      total: normalized.inputs.length,
      message: input.path
    });

    try {
      const generated = await processInput(input, normalized, index);
      artifacts.push(...generated.artifacts);
      diagnostics.push(...generated.diagnostics);
      completed += 1;
    } catch (error) {
      diagnostics.push(createDiagnostic(
        "TSDOC_RUNNER_INPUT_FAILED",
        normalized.options.emitCoordinateProfile
          ? `Unable to certify coordinate evidence for TSDoc input ${input.path}.`
          : `Unable to process TSDoc input ${input.path} (${errorCode(error)}).`,
        "error",
        input.path,
        // <lang><zh-CN>严格临时编译的原始异常可能含私有暂存路径；公开结果只保留固定原因。</zh-CN><en>A strict temporary compile error may name a private staging path; expose only a fixed cause.</en></lang>
        { cause: normalized.options.emitCoordinateProfile ? "Coordinate profile input is not certifiable." : errorMessage(error) }
      ));
    }
  }

  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const result = {
    contract: RESULT_CONTRACT,
    contractVersion: RESULT_CONTRACT_VERSION,
    producer: {
      id: PRODUCER_ID,
      version: TSDOC_RUNNER_VERSION
    },
    status: hasErrors ? (artifacts.length > 0 ? "partial" : "failed") : "success",
    artifacts,
    diagnostics
  };

  if (normalized.options.writeResultManifest) {
    if (normalized.options.emitCoordinateProfile) {
      await assertSafeOutputFile(normalized.outputDirectory, "tsdoc.producer-result.json");
    }
    await writeJson(path.join(normalized.outputDirectory, "tsdoc.producer-result.json"), result);
  }

  context.reportProgress?.({
    phase: "complete",
    current: completed,
    total: normalized.inputs.length
  });

  return result;
}

/**
 * 读取 versioned TSDoc JSON config 并转成 runner request。
 * Loads a versioned TSDoc JSON config and converts it into a runner request.
 *
 * @param {string} configPath Config path relative to cwd or absolute.
 * @param {{ cwd?: string }} [options]
 * @returns {Promise<object>} Normalized runner request.
 */
export async function loadTsDocConfig(configPath, options = {}) {
  const absoluteConfigPath = path.resolve(options.cwd ?? process.cwd(), configPath);
  const config = JSON.parse(await readFile(absoluteConfigPath, "utf8"));
  assertRecord(config, "TSDoc config must be a JSON object.");
  assertKnownKeys(config, ["$schema", "schemaVersion", "workspaceRoot", "outputDirectory", "inputs", "options", "profileIds"], "config");
  if (config.schemaVersion !== TSDOC_CONFIG_SCHEMA_VERSION) {
    throw new TypeError(`schemaVersion must be ${TSDOC_CONFIG_SCHEMA_VERSION}.`);
  }
  if (config.$schema !== undefined && config.$schema !== TSDOC_CONFIG_SCHEMA_ID) {
    throw new TypeError(`$schema must be ${TSDOC_CONFIG_SCHEMA_ID}.`);
  }

  const configDirectory = path.dirname(absoluteConfigPath);
  const workspaceDirectory = normalizeConfigDirectory(config.workspaceRoot ?? ".", "workspaceRoot");
  const outputDirectory = normalizeConfigDirectory(config.outputDirectory ?? "dist/tsdoc", "outputDirectory");
  const workspaceRoot = path.resolve(configDirectory, workspaceDirectory);

  return normalizeRequest({
    workspaceRoot,
    outputDirectory: path.resolve(workspaceRoot, outputDirectory),
    inputs: config.inputs,
    options: config.options,
    profileIds: config.profileIds
  });
}

async function processInput(input, request, index) {
  // <lang><zh-CN>同一个经规范化的基名派生所有相互引用的工件；侧载只能绑定这一组本轮文件。</zh-CN><en>One normalized base derives all mutually linked artifacts; a sidecar may bind only this build's corresponding set.</en></lang>
  const sourcePath = input.path;
  const basePath = outputBasePath(input, index);
  const jsPath = `${basePath}.js`;
  const sourceMapPath = `${basePath}.js.map`;
  const tsDocPath = `${basePath}.tsdoc.json`;
  const jsDocBridgePath = `${basePath}.jsdoc-bridge.json`;
  const docSourceMapPath = `${basePath}.docmap.json`;
  const hiaDocumentPath = `${basePath}.hia.json`;
  const coordinateProfilePath = `${basePath}.coordinate-profile.json`;
  const absoluteCoordinateProfilePath = path.join(request.outputDirectory, coordinateProfilePath);
  if (request.options.emitCoordinateProfile) {
    // <lang><zh-CN>严格模式在任何撤销或写入前，阻断嵌套目录及现存文件链接。</zh-CN><en>Before any strict revocation or write, reject linked nested directories and existing targets.</en></lang>
    for (const outputPath of [jsPath, sourceMapPath, tsDocPath, jsDocBridgePath, docSourceMapPath, hiaDocumentPath, coordinateProfilePath]) {
      await assertSafeOutputFile(request.outputDirectory, outputPath);
    }
    await rm(absoluteCoordinateProfilePath, { force: true });
  } else if (await canSafelyRevokeCoordinateProfile(request.outputDirectory, coordinateProfilePath)) {
    // <lang><zh-CN>兼容路径只安全撤销旧证明，其余工件保持既有输出行为。</zh-CN><en>The compatibility path safely revokes only old proof and keeps its prior artifact-output behavior.</en></lang>
    await rm(absoluteCoordinateProfilePath, { force: true });
  }
  const sourceAbsolutePath = path.resolve(request.workspaceRoot, sourcePath);
  // <lang><zh-CN>只有严格模式需要保存获核真实源路径，避免符号链接在核验后被重指向。</zh-CN><en>Only strict mode retains the checked real source path, preventing a symlink from redirecting after validation.</en></lang>
  let checkedSourceReal = null;
  if (request.options.emitCoordinateProfile) {
    // <lang><zh-CN>签发前核实来源真实路径在工作区内；只为本次主输入授权读取。</zh-CN><en>Before signing, verify the real source stays inside the workspace; authorize only this primary input.</en></lang>
    const workspaceReal = await realpath(request.workspaceRoot);
    // <lang><zh-CN>来源真实路径与相对关系一起判定授权边界；词法在根内不足以证明。</zh-CN><en>Authorize the real source using its relation to the real root; lexical containment is insufficient.</en></lang>
    const sourceReal = await realpath(sourceAbsolutePath);
    const relativeSource = path.relative(workspaceReal, sourceReal);
    if (relativeSource === ".." || relativeSource.startsWith(`..${path.sep}`) || path.isAbsolute(relativeSource)) {
      throw new TypeError("Coordinate source escapes the workspace root.");
    }
    checkedSourceReal = sourceReal;
    // <lang><zh-CN>侧载模式的输出目录必须真实位于工作区内；否则普通图相对 URL 可能公开本机目录层级。</zh-CN><en>Strict output must resolve inside the workspace or an ordinary-map relative URL could disclose host directory structure.</en></lang>
    const outputReal = await realpath(request.outputDirectory);
    // <lang><zh-CN>后续地图 URL 从输出位置计算，因此输出根也必须在获核工作区内。</zh-CN><en>The final map URL is computed from the output location, so that root must remain inside the checked workspace.</en></lang>
    const relativeOutput = path.relative(workspaceReal, outputReal);
    if (relativeOutput === ".." || relativeOutput.startsWith(`..${path.sep}`) || path.isAbsolute(relativeOutput)) {
      throw new TypeError("Coordinate output escapes the workspace root.");
    }
    // <lang><zh-CN>跨卷输出无法构造非绝对普通 map 来源；发布前拒绝，避免泄漏工作区位置。</zh-CN><en>Cross-volume output cannot express a non-absolute ordinary-map source; refuse before publication to avoid leaking the workspace location.</en></lang>
    const sourceRelativeToMap = path.relative(path.dirname(path.resolve(request.outputDirectory, sourceMapPath)), sourceAbsolutePath);
    if (path.isAbsolute(sourceRelativeToMap) || path.win32.isAbsolute(sourceRelativeToMap)) {
      throw new TypeError("Coordinate output cannot expose an absolute source map path.");
    }
  }
  // <lang><zh-CN>严格路径一次取原始字节并按 UTF-8 保真解码；普通路径保持原有 UTF-8 文件读取。</zh-CN><en>The strict path snapshots raw bytes once and decodes UTF-8 exactly; the normal path keeps its previous file read.</en></lang>
  // <lang><zh-CN>严格读取使用刚核过的真实路径，而非可在核验后换向的原始符号链接。</zh-CN><en>Strict reading uses the checked real path, not the original symlink that could be retargeted after validation.</en></lang>
  const sourceBytes = checkedSourceReal ? await readBoundedCoordinateFile(checkedSourceReal) : null;
  const source = sourceBytes ? decodeCoordinateSource(sourceBytes) : await readFile(sourceAbsolutePath, "utf8");

  const compiled = await compileTypeScriptInput({
    input,
    request,
    source,
    sourceBytes,
    jsPath,
    sourceMapPath
  });

  const tsArtifact = extractTsDoc(source, {
    path: sourcePath,
    generatedJsPath: jsPath,
    sourcesContentPolicy: request.options.sourcesContentPolicy
  });
  const jsDocBridge = tsDocToJsDocBridgeArtifact(tsArtifact, { jsPath });
  // <lang><zh-CN>先生成可选映射，HIA 文档与结果清单才可引用真实存在的同版本工件。</zh-CN><en>Create the optional map first so the HIA document and result manifest can reference a real artifact with the same version.</en></lang>
  const docSourceMap = request.options.emitDocSourceMap
    ? createTsJsDocSourceMap({
        id: `docmap:ts-js:${slug(sourcePath)}`,
        tsArtifact,
        jsPath,
        sourceMapPath,
        tsDocPath,
        jsDocBridgePath,
        hiaDocumentPath
      })
    : null;
  const hiaDocument = tsDocToHiaDocument(tsArtifact, {
    id: `tsdoc:${sourcePath}`,
    title: path.posix.basename(sourcePath),
    docSourceMapPath: docSourceMap ? docSourceMapPath : undefined,
    docSourceMapContractVersion: docSourceMap?.contractVersion,
    entryArtifact: jsPath
  });

  await writeJson(path.join(request.outputDirectory, tsDocPath), tsArtifact);
  await writeJson(path.join(request.outputDirectory, jsDocBridgePath), jsDocBridge);
  await writeJson(path.join(request.outputDirectory, hiaDocumentPath), hiaDocument);
  if (docSourceMap) {
    await writeJson(path.join(request.outputDirectory, docSourceMapPath), docSourceMap);
  }
  if (request.options.emitCoordinateProfile) {
    // <lang><zh-CN>只用最终实际地图字节签发，且完成最后写入后才让证明文件可见。</zh-CN><en>Sign only final actual map bytes and expose the proof after all ordinary outputs are written.</en></lang>
    // <lang><zh-CN>内存图与最终落盘字节同时传入写器，由它逐一核同构和摘要。</zh-CN><en>Pass both in-memory map objects and final written bytes so the writer can compare structure and digests.</en></lang>
    const profile = createTypeScriptCoordinateProfile({
      sourceBytes,
      sourceText: source,
      sourcePath,
      workspaceRoot: request.workspaceRoot,
      outputDirectory: request.outputDirectory,
      sourceMapPath,
      ordinaryMap: compiled.ordinaryMap,
      ordinaryMapBytes: await readBoundedCoordinateFile(path.join(request.outputDirectory, sourceMapPath)),
      documentationMap: docSourceMap,
      documentationMapBytes: await readBoundedCoordinateFile(path.join(request.outputDirectory, docSourceMapPath)),
      inputIndex: index
    });
    await writeJson(absoluteCoordinateProfilePath, profile);
  }

  const artifactIdBase = `input-${index + 1}`;
  const artifacts = [
    artifact(`${artifactIdBase}-js`, "generated-js", jsPath, "javascript", "text/javascript", request.profileIds),
    artifact(`${artifactIdBase}-source-map`, "ordinary-source-map", sourceMapPath, "json", "application/json", request.profileIds),
    {
      ...artifact(`${artifactIdBase}-tsdoc`, "tsdoc-extraction", tsDocPath, "json", "application/json", request.profileIds),
      contract: TSDOC_EXTRACTION_CONTRACT,
      contractVersion: TSDOC_EXTRACTION_CONTRACT_VERSION
    },
    {
      ...artifact(`${artifactIdBase}-jsdoc-bridge`, "jsdoc-bridge", jsDocBridgePath, "json", "application/json", request.profileIds),
      contract: "hia-ts-jsdoc-bridge",
      contractVersion: "0.1.0-draft"
    },
    artifact(`${artifactIdBase}-hia-document`, "hia-document", hiaDocumentPath, "json", "application/json", request.profileIds)
  ];

  if (docSourceMap) {
    artifacts.push({
      ...artifact(`${artifactIdBase}-doc-source-map`, "doc-source-map", docSourceMapPath, "json", "application/json", request.profileIds),
      contract: "doc-source-map",
      contractVersion: docSourceMap.contractVersion
    });
  }
  if (request.options.emitCoordinateProfile) {
    artifacts.push({
      ...artifact(`${artifactIdBase}-coordinate-profile`, "ordinary-source-map-coordinate-profile", coordinateProfilePath, "json", "application/json", request.profileIds),
      contract: "ordinary-source-map-coordinate-profile",
      contractVersion: "0.1.0-draft"
    });
  }

  return {
    artifacts,
    diagnostics: normalizeDiagnostics(tsArtifact.diagnostics, sourcePath)
  };
}

async function compileTypeScriptInput({ input, request, source, sourceBytes, jsPath, sourceMapPath }) {
  // <lang><zh-CN>每个输入有独立临时根；编译器产物与工作区源文件不共享可变路径。</zh-CN><en>Each input gets a private temporary root so compiler artifacts do not share mutable workspace paths.</en></lang>
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "hia-tsdoc-compile-"));
  try {
    // <lang><zh-CN>固定本仓已安装 TypeScript 包声明的原生 CLI，不搜索宿主 PATH。</zh-CN><en>Resolve the native CLI from this repository's installed TypeScript package, not the host PATH.</en></lang>
    const tscBin = resolveTypeScriptCli();
    // <lang><zh-CN>主槽 UTF-16 精度只在已实测的 7.0.2 上签发；依赖被替换时保守失败。</zh-CN><en>Sign the primary UTF-16 slot only for measured TypeScript 7.0.2; fail closed if the installed dependency changes.</en></lang>
    if (sourceBytes && require("typescript/package.json").version !== "7.0.2") {
      throw new TypeError("Coordinate compiler version is not the measured TypeScript 7.0.2.");
    }
    // <lang><zh-CN>TypeScript 7 原生 tsc 在子进程中读文件；严格模式给它私有镜像，不能重读已改变的工作区文件。</zh-CN><en>Native TypeScript 7 tsc reads in a subprocess; strict mode gives it a private snapshot instead of rereading a changed workspace file.</en></lang>
    const sourceAbsolutePath = sourceBytes
      ? path.resolve(temporaryRoot, "snapshot", input.path)
      : path.resolve(request.workspaceRoot, input.path);
    if (sourceBytes) {
      // <lang><zh-CN>私有镜像只包含主输入原字节；不复制未授权导入图。</zh-CN><en>The private mirror contains only the primary input bytes, never an unapproved import graph.</en></lang>
      await mkdir(path.dirname(sourceAbsolutePath), { recursive: true });
      await writeFile(sourceAbsolutePath, sourceBytes);
    }
    // <lang><zh-CN>强制单独输出普通 source map 且不嵌源码，编译选项仍沿用 runner 的既有明确输入。</zh-CN><en>Force a separate ordinary source map without embedded text while retaining the runner's explicit compiler options.</en></lang>
    const compilerArgs = [
      tscBin,
      ...(request.options.ignoreConfig ? ["--ignoreConfig"] : []),
      "--target", request.options.target,
      "--module", request.options.module,
      ...(request.options.moduleResolution ? ["--moduleResolution", request.options.moduleResolution] : []),
      ...(request.options.lib.length > 0 ? ["--lib", request.options.lib.join(",")] : []),
      ...(request.options.types.length > 0 ? ["--types", request.options.types.join(",")] : []),
      ...(request.options.skipLibCheck ? ["--skipLibCheck"] : []),
      "--sourceMap", "true",
      "--inlineSources", "false",
      "--declaration", "false",
      "--outDir", temporaryRoot,
      sourceAbsolutePath
    ];
    // <lang><zh-CN>同一个 Node.js 进程版本启动本地 CLI；严格失败诊断在上层改为固定公开文案。</zh-CN><en>Launch the local CLI with the current Node.js version; upper-layer strict failures use fixed public diagnostics.</en></lang>
    const result = spawnSync(process.execPath, compilerArgs, {
      cwd: request.workspaceRoot,
      encoding: "utf8"
    });

    if (result.error || result.status !== 0) {
      throw new Error(trimCompilerMessage(result.error?.message || result.stderr || result.stdout));
    }

    // <lang><zh-CN>用原始 map 来源槽辨认主输出，不凭重名 `.js` 猜测本次源码归属。</zh-CN><en>Locate the primary output through the raw map source slot, not a coincidental `.js` basename.</en></lang>
    const compiledJsPath = await findCompiledOutputForSource(temporaryRoot, sourceAbsolutePath, Boolean(sourceBytes));
    const compiledSourceMapPath = `${compiledJsPath}.map`;
    const js = rewriteSourceMappingUrl(sourceBytes
      ? (await readBoundedCoordinateFile(compiledJsPath)).toString("utf8")
      : await readFile(compiledJsPath, "utf8"), path.posix.basename(sourceMapPath));
    // <lang><zh-CN>严格模式在 JSON 解析前限制原始地图读取量；普通模式保持旧读取流程。</zh-CN><en>Strict mode caps raw-map bytes before JSON parsing; normal mode keeps its former read path.</en></lang>
    const sourceMap = JSON.parse(sourceBytes
      ? (await readBoundedCoordinateFile(compiledSourceMapPath)).toString("utf8")
      : await readFile(compiledSourceMapPath, "utf8"));
    if (sourceBytes) {
      // <lang><zh-CN>检查临时镜像从 tsc 开始到结束未变，并证明普通图唯一原始槽位确属该镜像。</zh-CN><en>Check the staged snapshot stayed unchanged through tsc and that the sole raw original slot names that snapshot.</en></lang>
      if (!Buffer.from(await readBoundedCoordinateFile(sourceAbsolutePath)).equals(sourceBytes)
        || sourceMap.version !== 3 || !(sourceMap.sourceRoot === undefined || sourceMap.sourceRoot === "")
        || Object.hasOwn(sourceMap, "sections")
        || !Array.isArray(sourceMap.sources) || sourceMap.sources.length !== 1
        || !sourceMatchesAbsolutePath(sourceMap.sources[0], path.dirname(compiledSourceMapPath), sourceAbsolutePath)
        || Array.isArray(sourceMap.sourcesContent) && sourceMap.sourcesContent.some((content) => typeof content === "string" && content.length > 0)) {
        throw new TypeError("Coordinate compiler source slot does not match the immutable input snapshot.");
      }
    }

    // <lang><zh-CN>已有规范化逻辑把临时镜像路径改为原项目源的安全相对路径；签名发生在最终地图字节落盘之后。</zh-CN><en>Existing normalization replaces the temporary snapshot path with the original project's safe relative source path; signing follows the final write.</en></lang>
    // <lang><zh-CN>仅在已证明唯一镜像来源后才归一到原项目相对路径，随后写出供侧载重新读取的最终字节。</zh-CN><en>Normalize to the original project-relative source only after proving the sole snapshot slot, then write final bytes for the sidecar to reread.</en></lang>
    const ordinaryMap = normalizeSourceMap({
      sourceMap,
      source,
      sourcePath: input.path,
      sourceMapPath,
      workspaceRoot: request.workspaceRoot,
      outputDirectory: request.outputDirectory,
      sourcesContentPolicy: request.options.sourcesContentPolicy
    });
    await writeText(path.join(request.outputDirectory, jsPath), ensureTrailingNewline(js));
    await writeJson(path.join(request.outputDirectory, sourceMapPath), ordinaryMap);
    return { ordinaryMap };
  } finally {
    // <lang><zh-CN>递归清理前核对 mkdtemp 根确实是系统临时目录的本任务直属子目录。</zh-CN><en>Before recursive cleanup, verify mkdtemp's root is a direct task-owned child of the system temporary directory.</en></lang>
    const resolvedRoot = path.resolve(temporaryRoot);
    if (path.dirname(resolvedRoot) !== path.resolve(tmpdir()) || !path.basename(resolvedRoot).startsWith("hia-tsdoc-compile-")) {
      throw new TypeError("Temporary TypeScript compile directory escaped its expected parent.");
    }
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function findSingleFile(directory, fileName) {
  const matches = [];
  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.name === fileName) {
        matches.push(entryPath);
      }
    }
  }
  await visit(directory);
  if (matches.length !== 1) {
    throw new Error(`Expected one compiled output named ${fileName}, found ${matches.length}.`);
  }
  return matches[0];
}

async function findCompiledOutputForSource(directory, sourceAbsolutePath, strict = false) {
  // <lang><zh-CN>匹配集合必须最终恰有一项；并行编译出现同源多输出时拒绝侧载。</zh-CN><en>The match set must contain exactly one output; parallel emission of multiple outputs for a source is refused.</en></lang>
  const matches = [];
  // <lang><zh-CN>严格镜像只能处理有界地图集合；异常的大型导入图不应在挑选主槽位前耗尽内存。</zh-CN><en>Strict snapshots inspect only a bounded map set; an unexpectedly large import graph must not exhaust memory before primary-slot selection.</en></lang>
  const maps = await listFiles(directory, (filePath) => filePath.endsWith(".js.map"), strict ? 128 : Infinity);
  for (const mapPath of maps) {
    // <lang><zh-CN>严格候选图逐张限量读取，避免在挑选主 map 时先无界分配。</zh-CN><en>Read every strict candidate under the byte ceiling before selecting the primary map.</en></lang>
    const sourceMap = JSON.parse(strict
      ? (await readBoundedCoordinateFile(mapPath)).toString("utf8")
      : await readFile(mapPath, "utf8"));
    const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
    if (sources.some((source) => sourceMatchesAbsolutePath(source, path.dirname(mapPath), sourceAbsolutePath))) {
      matches.push(mapPath.replace(/\.map$/u, ""));
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`Expected one compiled output for ${sourceAbsolutePath}, found ${matches.length}.`);
  }

  if (strict) {
    throw new TypeError("Coordinate compiler emitted no proven primary source-map slot.");
  }

  return findSingleFile(directory, `${path.parse(sourceAbsolutePath).name}.js`);
}

async function listFiles(directory, predicate, maxFiles = Infinity) {
  // <lang><zh-CN>累积实际文件命中与目录项访问量分别受限；遇链接不递归。</zh-CN><en>Track matches and traversed entries separately under the strict cap; never recurse into links.</en></lang>
  const matches = [];
  let visited = 0;
  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      visited += 1;
      if (visited > maxFiles) throw new TypeError("Coordinate compiler output exceeds the 128-file inspection limit.");
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (!predicate || predicate(entryPath)) {
        matches.push(entryPath);
      }
    }
  }
  await visit(directory);
  return matches;
}

function sourceMatchesAbsolutePath(source, mapDirectory, sourceAbsolutePath) {
  const sourcePath = resolveSourceMapSource(source, mapDirectory);
  return normalizeComparablePath(sourcePath) === normalizeComparablePath(sourceAbsolutePath);
}

function resolveSourceMapSource(source, mapDirectory) {
  if (typeof source !== "string") {
    return "";
  }
  if (source.startsWith("file:")) {
    try {
      return fileURLToPath(source);
    } catch {
      return "";
    }
  }
  return path.resolve(mapDirectory, source);
}

function normalizeSourceMap({ sourceMap, source, sourcePath, sourceMapPath, workspaceRoot, outputDirectory, sourcesContentPolicy }) {
  const sourceAbsolutePath = path.resolve(workspaceRoot, sourcePath);
  const sourceMapDirectory = path.dirname(path.resolve(outputDirectory, sourceMapPath));
  const sourceRelativePath = toPosix(path.relative(sourceMapDirectory, sourceAbsolutePath));
  return {
    version: 3,
    file: path.posix.basename(sourceMapPath, ".map"),
    sourceRoot: "",
    sources: [sourceRelativePath],
    sourcesContent: sourcesContentPolicy === "embed" ? [source] : [],
    names: Array.isArray(sourceMap.names) ? sourceMap.names : [],
    mappings: sourceMap.mappings ?? "",
    x_compiler: {
      name: "typescript",
      version: "7.0.2"
    }
  };
}

function normalizeRequest(value) {
  assertRecord(value, "TSDoc runner request must be an object.");
  assertAbsoluteDirectory(value.workspaceRoot, "workspaceRoot");
  assertAbsoluteDirectory(value.outputDirectory, "outputDirectory");
  if (!Array.isArray(value.inputs) || value.inputs.length === 0) {
    throw new TypeError("inputs must be a non-empty array.");
  }

  const inputs = value.inputs.map((input, index) => {
    assertRecord(input, `inputs[${index}] must be an object.`);
    assertKnownKeys(input, ["kind", "path", "artifactBasePath"], `inputs[${index}]`);
    const inputPath = normalizeSafeRelativePath(input.path, `inputs[${index}].path`);
    const kind = input.kind ?? "typescript-entry";
    if (!TSDOC_INPUT_KINDS.includes(kind)) {
      throw new TypeError(`Unsupported TSDoc input kind: ${kind}`);
    }
    return {
      kind,
      path: inputPath,
      ...(typeof input.artifactBasePath === "string" ? {
        artifactBasePath: normalizeSafeRelativePath(input.artifactBasePath, `inputs[${index}].artifactBasePath`)
      } : {})
    };
  });

  const runnerOptions = value.options ?? {};
  assertRecord(runnerOptions, "options must be an object.");
  assertKnownKeys(runnerOptions, ["emitDocSourceMap", "emitCoordinateProfile", "ignoreConfig", "lib", "module", "moduleResolution", "skipLibCheck", "sourcesContentPolicy", "target", "types", "writeResultManifest"], "options");
  if (runnerOptions.emitCoordinateProfile !== undefined && typeof runnerOptions.emitCoordinateProfile !== "boolean") {
    throw new TypeError("emitCoordinateProfile must be a boolean.");
  }
  const sourcesContentPolicy = runnerOptions.sourcesContentPolicy ?? "none";
  if (!["none", "reference", "embed"].includes(sourcesContentPolicy)) {
    throw new TypeError(`Unsupported sourcesContentPolicy: ${sourcesContentPolicy}`);
  }
  if (runnerOptions.emitCoordinateProfile === true
    && (runnerOptions.emitDocSourceMap === false || sourcesContentPolicy !== "none" || runnerOptions.ignoreConfig === false)) {
    throw new TypeError("emitCoordinateProfile requires doc-source-map, ignoreConfig and sourcesContentPolicy none.");
  }
  if (runnerOptions.emitCoordinateProfile === true) {
    // <lang><zh-CN>显式或默认基名都需唯一；同一输出被后续输入覆写会令已签摘要失效。</zh-CN><en>Explicit and derived bases must be unique; a later input overwriting the same output would invalidate signed digests.</en></lang>
    const bases = inputs.map((input, index) => normalizeComparablePath(path.resolve(value.outputDirectory, outputBasePath(input, index))));
    if (new Set(bases).size !== bases.length) {
      throw new TypeError("Coordinate inputs must use distinct artifact bases.");
    }
  }
  const profileIds = value.profileIds ?? ["tsdoc", "ts-jsdoc-bridge", "doc-source-map"];
  if (!Array.isArray(profileIds) || profileIds.length === 0 || profileIds.some((id) => typeof id !== "string" || !SAFE_ID_PATTERN.test(id))) {
    throw new TypeError("profileIds must be a non-empty array of lower-case identifiers.");
  }

  return {
    workspaceRoot: path.resolve(value.workspaceRoot),
    outputDirectory: path.resolve(value.outputDirectory),
    inputs,
    profileIds: [...profileIds],
    options: {
      emitDocSourceMap: runnerOptions.emitDocSourceMap !== false,
      emitCoordinateProfile: runnerOptions.emitCoordinateProfile === true,
      ignoreConfig: runnerOptions.ignoreConfig !== false,
      lib: normalizeOptionalStringList(runnerOptions.lib, "options.lib"),
      module: runnerOptions.module ?? "ES2020",
      moduleResolution: typeof runnerOptions.moduleResolution === "string" ? runnerOptions.moduleResolution : null,
      skipLibCheck: runnerOptions.skipLibCheck !== false,
      sourcesContentPolicy,
      target: runnerOptions.target ?? "ES2020",
      types: normalizeOptionalStringList(runnerOptions.types, "options.types"),
      writeResultManifest: runnerOptions.writeResultManifest !== false
    }
  };
}

function resolveTypeScriptCli() {
  const packageJsonPath = require.resolve("typescript/package.json");
  const packageJson = require(packageJsonPath);
  const tscEntry = packageJson?.bin?.tsc;
  if (typeof tscEntry !== "string") {
    throw new Error("TypeScript package does not expose a tsc bin entry.");
  }
  return path.resolve(path.dirname(packageJsonPath), tscEntry);
}

function outputBasePath(input, index) {
  if (input.artifactBasePath) {
    return input.artifactBasePath;
  }
  const parsed = path.posix.parse(input.path);
  const directory = parsed.dir ? `${parsed.dir}/` : "";
  return normalizeSafeRelativePath(
    `artifacts/${directory}${parsed.name}.typescript-entry-${index + 1}`,
    "artifact base path"
  );
}

function normalizeDiagnostics(diagnostics, fallbackPath) {
  return (diagnostics ?? []).map((diagnostic) => ({
    code: typeof diagnostic?.code === "string" ? diagnostic.code : "TSDOC_RUNNER_DIAGNOSTIC",
    message: typeof diagnostic?.message === "string" ? diagnostic.message : "TSDoc runner diagnostic.",
    severity: ["error", "warning", "info"].includes(diagnostic?.severity) ? diagnostic.severity : "info",
    path: typeof diagnostic?.path === "string" ? diagnostic.path : fallbackPath,
    ...(isJsonObject(diagnostic?.data) ? { data: diagnostic.data } : {})
  }));
}

function artifact(id, kind, artifactPath, language, mediaType, profileIds) {
  return {
    id,
    kind,
    path: artifactPath,
    language,
    mediaType,
    profileIds
  };
}

function createDiagnostic(code, message, severity, diagnosticPath, data) {
  return {
    code,
    message,
    severity,
    ...(diagnosticPath ? { path: diagnosticPath } : {}),
    ...(isJsonObject(data) ? { data } : {})
  };
}

/**
 * @lang zh-CN 从已打开文件句柄限量读取侧载签发所需实际字节，增长中的文件也不能绕开 16 MiB 上限。
 * @lang en Read actual signable bytes through one open handle with a hard 16 MiB ceiling, including files growing during the read.
 * @param {string} filePath <lang><zh-CN>已通过路径边界检查的源码或地图。</zh-CN><en>Path-checked source or map.</en></lang>
 * @returns {Promise<Buffer>} <lang><zh-CN>未截断的实际字节。</zh-CN><en>Complete, untruncated actual bytes.</en></lang>
 * @throws {TypeError} <lang><zh-CN>静态或读中超限。</zh-CN><en>Static or in-flight size overflow.</en></lang>
 */
async function readBoundedCoordinateFile(filePath) {
  // <lang><zh-CN>只打开一次以避免先 stat 后重新按路径打开不同目标；此句柄贯穿限量读取。</zh-CN><en>Open once so metadata and bounded reading use one handle instead of resolving a changed path twice.</en></lang>
  const handle = await open(filePath, "r");
  try {
    // <lang><zh-CN>先用同一句柄的元数据快速拒绝明显超限文件，循环读取再防住并发增长。</zh-CN><en>Reject obvious oversize files from the same handle, then cap the read loop against concurrent growth.</en></lang>
    const state = await handle.stat();
    if (!state.isFile() || state.size > COORDINATE_ARTIFACT_LIMIT) {
      throw new TypeError("Coordinate artifact exceeds the 16 MiB reader limit.");
    }
    // <lang><zh-CN>小块累积让增长中的文件最多触及上限加一字节，而非整件读入。</zh-CN><en>Small chunks limit a growing file to at most the ceiling plus one byte instead of reading it whole.</en></lang>
    const pieces = [];
    let total = 0;
    while (total <= COORDINATE_ARTIFACT_LIMIT) {
      // <lang><zh-CN>最后一轮只取剩余额度加一字节，用它辨认真正超限。</zh-CN><en>The final read allows one byte beyond the remaining budget to detect a true overflow.</en></lang>
      const piece = Buffer.allocUnsafe(Math.min(64 * 1024, COORDINATE_ARTIFACT_LIMIT + 1 - total));
      const { bytesRead } = await handle.read(piece, 0, piece.length, null);
      if (bytesRead === 0) return Buffer.concat(pieces, total);
      total += bytesRead;
      if (total > COORDINATE_ARTIFACT_LIMIT) {
        throw new TypeError("Coordinate artifact exceeds the 16 MiB reader limit.");
      }
      pieces.push(piece.subarray(0, bytesRead));
    }
    throw new TypeError("Coordinate artifact exceeds the 16 MiB reader limit.");
  } finally {
    await handle.close();
  }
}

/**
 * @lang zh-CN 仅在已核工作区内逐级建立侧载输出目录，拒绝预存链接或外部路径。
 * @lang en Create strict output directories one component at a time inside the checked workspace; reject links and external paths.
 * @param {string} baseDirectory <lang><zh-CN>允许的现存目录根。</zh-CN><en>Existing allowed directory root.</en></lang>
 * @param {string} targetDirectory <lang><zh-CN>待核或待建立的输出目录。</zh-CN><en>Output directory to verify or create.</en></lang>
 * @returns {Promise<void>} <lang><zh-CN>每级均为真实目录。</zh-CN><en>Every component is a real directory.</en></lang>
 */
async function ensureCoordinateDirectory(baseDirectory, targetDirectory) {
  // <lang><zh-CN>相对关系从调用方允许根起算；不能靠真实路径碰巧回到根内来接受词法越界。</zh-CN><en>Measure from the caller's allowed root; a lexical escape is refused even if a later redirect happens to point back inside.</en></lang>
  const base = path.resolve(baseDirectory);
  const target = path.resolve(targetDirectory);
  const relative = path.relative(base, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new TypeError("Coordinate output escapes its allowed directory.");
  }
  // <lang><zh-CN>实际根固定一次；后续目录即使词法位于根内，也不能经链接跳出。</zh-CN><en>Fix the actual root once; lexically nested components must not redirect through a link.</en></lang>
  const baseReal = await realpath(base);
  // <lang><zh-CN>只沿真实目录逐级行走和创建，严禁 `recursive` 穿过预存链接。</zh-CN><en>Walk and create only real directories component by component; never recursively traverse an existing link.</en></lang>
  let current = base;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let state;
    try {
      state = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(current);
      state = await lstat(current);
    }
    if (state.isSymbolicLink() || !state.isDirectory()) {
      throw new TypeError("Coordinate output contains a linked or non-directory component.");
    }
    // <lang><zh-CN>Windows junction 等重定向也必须由真实路径的包含关系挡住。</zh-CN><en>Real-path containment also catches Windows junction-like redirection.</en></lang>
    const actual = await realpath(current);
    const actualRelative = path.relative(baseReal, actual);
    if (actualRelative === ".." || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative)) {
      throw new TypeError("Coordinate output redirects outside its allowed directory.");
    }
  }
}

/**
 * @lang zh-CN 工件首次写入及旧证明撤销之前，拒绝目标父目录或现存文件的符号链接。
 * @lang en Reject linked parent directories or existing artifact files before the first write or stale-proof revocation.
 * @param {string} outputDirectory <lang><zh-CN>已建立的输出根。</zh-CN><en>Existing output root.</en></lang>
 * @param {string} relativeFile <lang><zh-CN>输出根内的相对工件路径。</zh-CN><en>Relative artifact path inside the output root.</en></lang>
 * @returns {Promise<void>} <lang><zh-CN>目标可安全写入或撤销。</zh-CN><en>The target may be written or revoked.</en></lang>
 */
async function assertSafeOutputFile(outputDirectory, relativeFile) {
  // <lang><zh-CN>先验所有父级，再检查已存在的目标文件；此静态核验不宣称阻止并发恶意换向。</zh-CN><en>Check all parents and any existing target; this static preflight does not claim to prevent adversarial concurrent swaps.</en></lang>
  const absoluteFile = path.resolve(outputDirectory, relativeFile);
  const relative = path.relative(path.resolve(outputDirectory), absoluteFile);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new TypeError("Coordinate artifact escapes the output directory.");
  }
  await ensureCoordinateDirectory(outputDirectory, path.dirname(absoluteFile));
  try {
    const state = await lstat(absoluteFile);
    if (state.isSymbolicLink() || !state.isFile() || state.nlink !== 1) {
      throw new TypeError("Coordinate artifact target is linked or not a single regular file.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/**
 * @lang zh-CN 兼容模式仅在现有路径没有链接跳转时撤销旧侧载；不改变其余产物的历史写入策略。
 * @lang en Revoke a stale sidecar in compatibility mode only when no existing component redirects through a link; leave legacy artifact writes unchanged.
 * @param {string} outputDirectory <lang><zh-CN>可能由旧构建使用的输出根。</zh-CN><en>Output root possibly used by a legacy build.</en></lang>
 * @param {string} relativeFile <lang><zh-CN>旧侧载相对路径。</zh-CN><en>Relative stale-sidecar path.</en></lang>
 * @returns {Promise<boolean>} <lang><zh-CN>可安全撤销时为 true。</zh-CN><en>True only when revocation is safe.</en></lang>
 */
async function canSafelyRevokeCoordinateProfile(outputDirectory, relativeFile) {
  // <lang><zh-CN>兼容模式不限制历史普通产物输出，只给新增的旧证明删除建立保守门禁。</zh-CN><en>Compatibility mode keeps historical ordinary outputs and puts a conservative gate only on the new stale-proof removal.</en></lang>
  const root = path.resolve(outputDirectory);
  const target = path.resolve(root, relativeFile);
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
  try {
    // <lang><zh-CN>根本身或任一祖先发生真实路径重定向时，保留旧文件，由宿主自行清理。</zh-CN><en>When the root or an ancestor redirects, leave the old file for host-managed cleanup.</en></lang>
    if (normalizeComparablePath(await realpath(root)) !== normalizeComparablePath(root)) return false;
    let current = root;
    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment);
      const state = await lstat(current);
      if (state.isSymbolicLink()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

function rewriteSourceMappingUrl(js, sourceMapFileName) {
  const normalized = String(js).replace(/\/\/# sourceMappingURL=.*(?:\r?\n)?$/u, "");
  return `${normalized.trimEnd()}\n//# sourceMappingURL=${sourceMapFileName}\n`;
}

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function normalizeSafeRelativePath(value, label) {
  if (typeof value !== "string" || !isSafeRelativePath(value)) {
    throw new TypeError(`${label} must be a safe relative path.`);
  }
  return value.replaceAll("\\", "/");
}

function isSafeRelativePath(value) {
  const normalized = String(value).replaceAll("\\", "/");
  return Boolean(normalized)
    && !path.posix.isAbsolute(normalized)
    && !path.win32.isAbsolute(value)
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized)
    && !normalized.split("/").includes("..");
}

function normalizeConfigDirectory(value, label) {
  if (typeof value !== "string" || path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
    throw new TypeError(`${label} must be relative to the config/project directory.`);
  }
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.split("/").includes("..")) {
    throw new TypeError(`${label} must not escape its base directory.`);
  }
  return normalized;
}

function normalizeOptionalStringList(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new TypeError(`${label} must be an array of non-empty strings.`);
  }
  return [...value];
}

function assertAbsoluteDirectory(value, label) {
  if (typeof value !== "string" || (!path.posix.isAbsolute(value) && !path.win32.isAbsolute(value))) {
    throw new TypeError(`${label} must be an absolute runtime path.`);
  }
}

function assertKnownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new TypeError(`${label}.${key} is not supported.`);
    }
  }
}

function assertRecord(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
}

function isJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function trimCompilerMessage(value) {
  return String(value || "TypeScript compiler failed.").replace(/\s+/g, " ").trim();
}

function errorCode(error) {
  return typeof error?.code === "string" ? error.code : error?.name ?? "Error";
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "input";
}

function toPosix(value) {
  return String(value).replaceAll("\\", "/");
}

function normalizeComparablePath(value) {
  const normalized = path.resolve(String(value || "")).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
