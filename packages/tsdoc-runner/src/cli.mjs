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
    "no-doc-source-map": { type: "boolean" },
    "out-dir": { type: "string", short: "o" },
    version: { type: "boolean", short: "v" },
    "workspace-root": { type: "string" }
  },
  allowPositionals: true,
  strict: true
});

if (values.help) {
  process.stdout.write(`HIA TSDoc ${TSDOC_RUNNER_VERSION}\n\nUsage:\n  hia-tsdoc --config tsdoc.config.json\n  hia-tsdoc [options] <entry.ts...>\n\nOptions:\n  -c, --config <path>\n  -o, --out-dir <path>\n      --workspace-root <path>\n      --no-doc-source-map\n  -v, --version\n`);
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
      writeResultManifest: true
    }
  };
}
