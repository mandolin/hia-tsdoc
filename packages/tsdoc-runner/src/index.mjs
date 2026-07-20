import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { readFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tsDocToHiaDocument } from "@hia-doc/ts-doc-adapter";
import { extractTsDoc } from "@hia-doc/ts-doc-extractor";
import { tsDocToJsDocBridgeArtifact } from "@hia-doc/ts-jsdoc-bridge";
import { createTsJsDocSourceMap } from "@hia-doc/ts-to-js-doc-source-map";
import {
  TSDOC_EXTRACTION_CONTRACT,
  TSDOC_EXTRACTION_CONTRACT_VERSION
} from "@hia-doc/tsdoc-spec";

export {
  TSDOC_CONFIG_JSON_SCHEMA,
  TSDOC_CONFIG_SCHEMA_ID,
  TSDOC_CONFIG_SCHEMA_VERSION
} from "./schema.mjs";
import { TSDOC_CONFIG_SCHEMA_ID, TSDOC_CONFIG_SCHEMA_VERSION } from "./schema.mjs";

export const TSDOC_RUNNER_VERSION = "0.1.3";
export const TSDOC_INPUT_KINDS = Object.freeze(["typescript-entry"]);
export const TSDOC_OUTPUT_KINDS = Object.freeze([
  "generated-js",
  "ordinary-source-map",
  "tsdoc-extraction",
  "jsdoc-bridge",
  "hia-document",
  "doc-source-map"
]);

const require = createRequire(import.meta.url);
const RESULT_CONTRACT = "documentation-producer-result";
const RESULT_CONTRACT_VERSION = "0.1.0-draft";
const PRODUCER_ID = "tsdoc";
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

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
  await mkdir(normalized.outputDirectory, { recursive: true });

  const artifacts = [];
  const diagnostics = [];
  let completed = 0;

  for (const [index, input] of normalized.inputs.entries()) {
    if (context.signal?.aborted) {
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
        `Unable to process TSDoc input ${input.path} (${errorCode(error)}).`,
        "error",
        input.path,
        { cause: errorMessage(error) }
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
  const sourcePath = input.path;
  const source = await readFile(path.resolve(request.workspaceRoot, sourcePath), "utf8");
  const basePath = outputBasePath(input, index);
  const jsPath = `${basePath}.js`;
  const sourceMapPath = `${basePath}.js.map`;
  const tsDocPath = `${basePath}.tsdoc.json`;
  const jsDocBridgePath = `${basePath}.jsdoc-bridge.json`;
  const docSourceMapPath = `${basePath}.docmap.json`;
  const hiaDocumentPath = `${basePath}.hia.json`;

  await compileTypeScriptInput({
    input,
    request,
    source,
    jsPath,
    sourceMapPath
  });

  const tsArtifact = extractTsDoc(source, {
    path: sourcePath,
    generatedJsPath: jsPath,
    sourcesContentPolicy: request.options.sourcesContentPolicy
  });
  const jsDocBridge = tsDocToJsDocBridgeArtifact(tsArtifact, { jsPath });
  const hiaDocument = tsDocToHiaDocument(tsArtifact, {
    id: `tsdoc:${sourcePath}`,
    title: path.posix.basename(sourcePath),
    docSourceMapPath,
    entryArtifact: jsPath
  });
  const docSourceMap = createTsJsDocSourceMap({
    id: `docmap:ts-js:${slug(sourcePath)}`,
    tsArtifact,
    jsPath,
    sourceMapPath,
    tsDocPath,
    jsDocBridgePath,
    hiaDocumentPath
  });

  await writeJson(path.join(request.outputDirectory, tsDocPath), tsArtifact);
  await writeJson(path.join(request.outputDirectory, jsDocBridgePath), jsDocBridge);
  await writeJson(path.join(request.outputDirectory, hiaDocumentPath), hiaDocument);
  if (request.options.emitDocSourceMap) {
    await writeJson(path.join(request.outputDirectory, docSourceMapPath), docSourceMap);
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

  if (request.options.emitDocSourceMap) {
    artifacts.push({
      ...artifact(`${artifactIdBase}-doc-source-map`, "doc-source-map", docSourceMapPath, "json", "application/json", request.profileIds),
      contract: "doc-source-map",
      contractVersion: "0.1.0-draft"
    });
  }

  return {
    artifacts,
    diagnostics: normalizeDiagnostics(tsArtifact.diagnostics, sourcePath)
  };
}

async function compileTypeScriptInput({ input, request, source, jsPath, sourceMapPath }) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "hia-tsdoc-compile-"));
  try {
    const tscBin = resolveTypeScriptCli();
    const sourceAbsolutePath = path.resolve(request.workspaceRoot, input.path);
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
    const result = spawnSync(process.execPath, compilerArgs, {
      cwd: request.workspaceRoot,
      encoding: "utf8"
    });

    if (result.error || result.status !== 0) {
      throw new Error(trimCompilerMessage(result.error?.message || result.stderr || result.stdout));
    }

    const compiledJsPath = await findCompiledOutputForSource(temporaryRoot, sourceAbsolutePath);
    const compiledSourceMapPath = `${compiledJsPath}.map`;
    const js = rewriteSourceMappingUrl(await readFile(compiledJsPath, "utf8"), path.posix.basename(sourceMapPath));
    const sourceMap = JSON.parse(await readFile(compiledSourceMapPath, "utf8"));

    await writeText(path.join(request.outputDirectory, jsPath), ensureTrailingNewline(js));
    await writeJson(path.join(request.outputDirectory, sourceMapPath), normalizeSourceMap({
      sourceMap,
      source,
      sourcePath: input.path,
      sourceMapPath,
      workspaceRoot: request.workspaceRoot,
      outputDirectory: request.outputDirectory,
      sourcesContentPolicy: request.options.sourcesContentPolicy
    }));
  } finally {
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

async function findCompiledOutputForSource(directory, sourceAbsolutePath) {
  const matches = [];
  const maps = await listFiles(directory, (filePath) => filePath.endsWith(".js.map"));
  for (const mapPath of maps) {
    const sourceMap = JSON.parse(await readFile(mapPath, "utf8"));
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

  return findSingleFile(directory, `${path.parse(sourceAbsolutePath).name}.js`);
}

async function listFiles(directory, predicate) {
  const matches = [];
  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
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
  assertKnownKeys(runnerOptions, ["emitDocSourceMap", "ignoreConfig", "lib", "module", "moduleResolution", "skipLibCheck", "sourcesContentPolicy", "target", "types", "writeResultManifest"], "options");
  const sourcesContentPolicy = runnerOptions.sourcesContentPolicy ?? "none";
  if (!["none", "reference", "embed"].includes(sourcesContentPolicy)) {
    throw new TypeError(`Unsupported sourcesContentPolicy: ${sourcesContentPolicy}`);
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
