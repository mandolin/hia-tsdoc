import { TSDOC_CLASSIFICATIONS, TSDOC_EXTRACTION_CONTRACT } from "@hia-doc/tsdoc-spec";

export function tsDocToJsDocBridgeArtifact(tsArtifact, options = {}) {
  assertTsDocArtifact(tsArtifact);
  const jsPath = normalizePath(options.jsPath ?? "dist/output.js");
  const runtimeSymbols = tsArtifact.symbols.filter((symbol) => symbol.classification === TSDOC_CLASSIFICATIONS.runtime);

  return {
    contract: "hia-ts-jsdoc-bridge",
    contractVersion: "0.1.0-draft",
    producer: {
      name: "@hia-doc/ts-jsdoc-bridge",
      version: "0.1.1"
    },
    source: tsArtifact.source,
    artifact: {
      kind: "generated-js",
      path: jsPath,
      language: "javascript"
    },
    runtimeSymbols: runtimeSymbols.map((symbol) => ({
      id: symbol.id,
      name: symbol.name,
      kind: symbol.kind,
      jsName: symbol.runtime?.jsName ?? symbol.name,
      summary: symbol.comment?.summary ?? null,
      source: symbol.source
    })),
    typeOnlySymbols: tsArtifact.symbols
      .filter((symbol) => symbol.classification === TSDOC_CLASSIFICATIONS.typeOnly)
      .map((symbol) => ({
        id: symbol.id,
        name: symbol.name,
        kind: symbol.kind,
        bridgeStatus: "ts-only"
      })),
    diagnostics: []
  };
}

function assertTsDocArtifact(artifact) {
  if (!artifact || artifact.contract !== TSDOC_EXTRACTION_CONTRACT) {
    throw new Error(`Expected ${TSDOC_EXTRACTION_CONTRACT} artifact.`);
  }
}

function normalizePath(value) {
  const normalized = String(value).replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe TS/JSDoc bridge path: ${value}`);
  }
  return normalized;
}
