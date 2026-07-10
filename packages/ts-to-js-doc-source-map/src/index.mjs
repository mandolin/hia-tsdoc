import { TSDOC_CLASSIFICATIONS, TSDOC_EXTRACTION_CONTRACT } from "@hia-doc/tsdoc-spec";

export function createTsJsDocSourceMap(options) {
  const {
    tsArtifact,
    jsPath,
    sourceMapPath,
    tsDocPath,
    jsDocBridgePath,
    hiaDocumentPath
  } = options ?? {};

  assertTsDocArtifact(tsArtifact);
  const normalizedJsPath = normalizePath(jsPath ?? "dist/output.js");
  const normalizedSourceMapPath = normalizePath(sourceMapPath ?? "dist/output.js.map");
  const normalizedTsDocPath = normalizePath(tsDocPath ?? "dist/output.tsdoc.json");
  const normalizedJsDocBridgePath = normalizePath(jsDocBridgePath ?? "dist/output.jsdoc-bridge.json");
  const normalizedHiaDocumentPath = normalizePath(hiaDocumentPath ?? "dist/output.hia.json");

  return {
    contract: "doc-source-map",
    contractVersion: "0.1.0-draft",
    id: options.id ?? "docmap:ts-js:document",
    producer: {
      name: "@hia-doc/ts-to-js-doc-source-map",
      version: "0.0.0",
      profile: "ts-jsdoc-bridge"
    },
    artifacts: [
      {
        id: "artifact:js:generated",
        kind: "generated-js",
        path: normalizedJsPath,
        language: "javascript",
        role: "generated",
        contractRefs: [
          {
            contract: "hia-ts-jsdoc-bridge",
            path: normalizedJsDocBridgePath
          }
        ]
      },
      {
        id: "artifact:tsdoc:extraction",
        kind: "extraction-artifact",
        path: normalizedTsDocPath,
        language: "json",
        role: "generated",
        contractRefs: [
          {
            contract: TSDOC_EXTRACTION_CONTRACT,
            path: normalizedTsDocPath
          }
        ]
      },
      {
        id: "artifact:hia:document",
        kind: "extraction-artifact",
        path: normalizedHiaDocumentPath,
        language: "json",
        role: "generated"
      }
    ],
    sources: [
      {
        id: sourceIdForPath(tsArtifact.source.path),
        kind: "typescript-source",
        path: normalizePath(tsArtifact.source.path),
        language: "typescript",
        role: "original",
        sourcesContentPolicy: "none"
      }
    ],
    sourceMaps: [
      {
        id: "sourcemap:ts-js:document",
        kind: "ordinary-source-map",
        format: "source-map-v3",
        path: normalizedSourceMapPath,
        mapsFrom: "artifact:js:generated",
        mapsTo: [sourceIdForPath(tsArtifact.source.path)],
        sourcesContentPolicy: "none",
        pointer: {
          status: "not-written",
          reservedExtensionField: "x_doc_source_map"
        }
      }
    ],
    chains: [
      {
        id: "chain:ts-js:document",
        stages: [
          {
            from: sourceIdForPath(tsArtifact.source.path),
            to: "artifact:js:generated",
            transform: "typescript-compiler",
            sourceMap: "sourcemap:ts-js:document",
            linkage: tsArtifact.symbols.map((symbol) => entryIdForSymbol(symbol))
          },
          {
            from: "artifact:js:generated",
            to: "artifact:hia:document",
            transform: "tsdoc-to-hia-core",
            sourceMap: null,
            linkage: tsArtifact.symbols.filter((symbol) => symbol.classification === TSDOC_CLASSIFICATIONS.runtime).map((symbol) => entryIdForSymbol(symbol))
          }
        ]
      }
    ],
    entries: tsArtifact.symbols.map((symbol) => createSymbolEntry(symbol)),
    privacy: {
      sourcesContentPolicy: "none",
      allowAbsolutePaths: false,
      allowUncPaths: false,
      allowPathTraversal: false,
      releaseGate: {
        requireExplicitEmbedOptIn: true,
        failOnUnsafePath: true,
        failOnUnexpectedSourcesContent: true
      }
    },
    diagnostics: []
  };
}

function createSymbolEntry(symbol) {
  const typeOnly = symbol.classification === TSDOC_CLASSIFICATIONS.typeOnly;
  return {
    id: entryIdForSymbol(symbol),
    kind: "symbol",
    symbolKind: symbol.kind,
    symbolId: symbol.id,
    classification: symbol.classification,
    annotation: symbol.comment
      ? {
          summary: symbol.comment.summary,
          tags: symbol.comment.tags
        }
      : null,
    sourceRefs: [
      {
        sourceId: sourceIdForPath(symbol.source.path),
        range: symbol.comment?.range ?? symbol.source.range,
        rangeSource: "typescript-compiler",
        confidence: "high"
      }
    ],
    artifactRefs: typeOnly
      ? []
      : [
          {
            artifactId: "artifact:js:generated",
            symbolName: symbol.runtime?.jsName ?? symbol.name,
            rangeSource: "source-map",
            confidence: "medium"
          }
        ],
    diagnostics: typeOnly ? ["TS_TYPE_ONLY_NO_JS_EMIT"] : []
  };
}

function assertTsDocArtifact(artifact) {
  if (!artifact || artifact.contract !== TSDOC_EXTRACTION_CONTRACT) {
    throw new Error(`Expected ${TSDOC_EXTRACTION_CONTRACT} artifact.`);
  }
}

function sourceIdForPath(sourcePath) {
  return `source:ts:${slug(sourcePath)}`;
}

function entryIdForSymbol(symbol) {
  return `entry:${slug(symbol.id)}`;
}

function normalizePath(value) {
  const normalized = String(value).replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe doc-source-map path: ${value}`);
  }
  return normalized;
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "unnamed";
}
