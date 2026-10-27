#!/usr/bin/env node

import path from "node:path";
import { parseArgs } from "node:util";

import {
  TSDOC_RUNNER_VERSION,
  loadTsDocConfig,
  runTsDoc
} from "./index.mjs";

const { values, positionals } = parseArgs({
  options: {
    config: { type: "string", short: "c" },
    help: { type: "boolean", short: "h" },
    lib: { type: "string" },
    module: { type: "string" },
    "module-resolution": { type: "string" },
    "no-doc-source-map": { type: "boolean" },
    // <lang><zh-CN>显式开启严格坐标侧载；未声明时不改变既有 CLI 产物。</zh-CN><en>Explicitly enable strict coordinate evidence; omission preserves previous CLI output.</en></lang>
    "coordinate-profile": { type: "boolean" },
    "no-skip-lib-check": { type: "boolean" },
    "out-dir": { type: "string", short: "o" },
    "sources-content-policy": { type: "string" },
    target: { type: "string" },
    types: { type: "string" },
    version: { type: "boolean", short: "v" },
    "workspace-root": { type: "string" }
  },
  allowPositionals: true,
  strict: true
});

if (values.help) {
  process.stdout.write(`HIA TSDoc ${TSDOC_RUNNER_VERSION}\n\nUsage:\n  hia-tsdoc --config tsdoc.config.json\n  hia-tsdoc [options] <entry.ts...>\n\nOptions:\n  -c, --config <path>\n  -o, --out-dir <path>\n      --workspace-root <path>\n      --target <name>\n      --module <name>\n      --module-resolution <name>\n      --lib <name[,name...]>\n      --types <name[,name...]>\n      --sources-content-policy <none|reference|embed>\n      --no-doc-source-map\n      --coordinate-profile\n      --no-skip-lib-check\n  -v, --version\n`);
  process.exit(0);
}

if (values.version) {
  process.stdout.write(`${TSDOC_RUNNER_VERSION}\n`);
  process.exit(0);
}

try {
  const request = values.config
    ? await loadTsDocConfig(values.config)
    : createCliRequest(values, positionals);

  if (values["out-dir"]) {
    request.outputDirectory = path.resolve(request.workspaceRoot, values["out-dir"]);
  }
  if (values["no-doc-source-map"]) {
    request.options.emitDocSourceMap = false;
  }
  if (values["coordinate-profile"]) {
    // <lang><zh-CN>CLI 开关覆盖配置的默认关闭值，组合约束仍交给 runner 统一检查。</zh-CN><en>The CLI flag overrides a config's default-off value; the runner still checks option compatibility.</en></lang>
    request.options.emitCoordinateProfile = true;
  }

  const result = await runTsDoc(request);
  process.stdout.write(`TSDoc ${result.status}: ${result.artifacts.length} artifact(s).\n`);
  process.exitCode = result.status === "success" ? 0 : 1;
} catch (error) {
  process.stderr.write(`TSDoc failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function createCliRequest(cliValues, inputs) {
  if (inputs.length === 0) {
    throw new TypeError("At least one input or --config is required.");
  }
  const workspaceRoot = path.resolve(process.cwd(), cliValues["workspace-root"] ?? ".");
  return {
    workspaceRoot,
    outputDirectory: path.resolve(workspaceRoot, cliValues["out-dir"] ?? "dist/tsdoc"),
    inputs: inputs.map((inputPath) => ({
      kind: "typescript-entry",
      path: inputPath
    })),
    options: {
      emitDocSourceMap: !cliValues["no-doc-source-map"],
      // <lang><zh-CN>位置参数模式同样默认关闭，不在用户未请求时增加证据工件。</zh-CN><en>Positional mode also defaults off and adds no evidence artifact without a request.</en></lang>
      emitCoordinateProfile: cliValues["coordinate-profile"] === true,
      lib: parseCommaList(cliValues.lib),
      module: cliValues.module,
      moduleResolution: cliValues["module-resolution"],
      skipLibCheck: !cliValues["no-skip-lib-check"],
      sourcesContentPolicy: cliValues["sources-content-policy"],
      target: cliValues.target,
      types: parseCommaList(cliValues.types),
      writeResultManifest: true
    }
  };
}

function parseCommaList(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
