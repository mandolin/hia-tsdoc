import { TSDOC_CLASSIFICATIONS, TSDOC_EXTRACTION_CONTRACT } from "@hia-doc/tsdoc-spec";

/** @lang zh-CN 本写入器当前输出的文档源码映射契约身份。 @lang en Contract identity currently emitted by this documentation source-map writer. */
export const TS_JS_DOC_SOURCE_MAP_CONTRACT_VERSION = "1.1.0";

/**
 * @lang zh-CN 将 TypeScript 提取产物链接到生成 JavaScript 与 HIA 文档；源码范围精度逐引用声明，且不读取源码正文。
 * @lang en Links a TypeScript extraction artifact to generated JavaScript and HIA documentation; declares source-range precision per reference without reading source bodies.
 * @param {object} options <lang><zh-CN>提取产物、产物路径和可选映射 ID。</zh-CN><en>Extraction artifact, artifact paths, and optional map ID.</en></lang>
 * @returns {object} <lang><zh-CN>`doc-source-map@1.1.0`，未知精度保持未知。</zh-CN><en>A `doc-source-map@1.1.0` with unproven precision left unknown.</en></lang>
 */
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
    contractVersion: TS_JS_DOC_SOURCE_MAP_CONTRACT_VERSION,
    id: options.id ?? "docmap:ts-js:document",
    producer: {
      name: "@hia-doc/ts-to-js-doc-source-map",
      version: "0.1.3",
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
    entries: tsArtifact.symbols.map((symbol) => createSymbolEntry(symbol, tsArtifact.producer?.name)),
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

/**
 * @lang zh-CN 仅本地扫描器已测注释可给出精确范围；声明回退保留终点未知，外来提取工件双维未知。
 * @lang en Only proven local scanner comments receive an exact range; declaration fallbacks keep the end unknown, and foreign extraction artifacts keep both dimensions unknown.
 * @param {object} symbol <lang><zh-CN>提取符号。</zh-CN><en>Extracted symbol.</en></lang>
 * @param {string | undefined} producerName <lang><zh-CN>提取产物声明的生产者。</zh-CN><en>Producer declared by the extraction artifact.</en></lang>
 * @returns {object} <lang><zh-CN>映射符号条目。</zh-CN><en>Source-map symbol entry.</en></lang>
 */
function createSymbolEntry(symbol, producerName) {
  const typeOnly = symbol.classification === TSDOC_CLASSIFICATIONS.typeOnly;
  // <lang><zh-CN>注释优先于声明；范围约定必须与真正选用的来源一致。</zh-CN><en>Comments take precedence over declarations; the convention must match the source actually selected.</en></lang>
  const sourceRef = createSourceRef(symbol, producerName);
  return {
    id: entryIdForSymbol(symbol),
    kind: "symbol",
    symbolKind: symbol.kind,
    symbolId: symbol.id,
    classification: symbol.classification,
    // <lang><zh-CN>无注释符号省略 annotation；null 会被当前映射契约判为错误对象。</zh-CN><en>Omit annotation for undocumented symbols; null is invalid under the current map contract.</en></lang>
    ...(symbol.comment
      ? { annotation: {
          summary: symbol.comment.summary,
          tags: symbol.comment.tags
        } }
      : {}),
    sourceRefs: [sourceRef],
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

/**
 * @lang zh-CN 按实际提取分支选择来源位置，并独立声明终点和列单位；无范围时不编造约定。
 * @lang en Selects the actual extraction branch and declares end boundary and column unit independently; omits a convention when there is no range.
 * @param {object} symbol <lang><zh-CN>含源码路径与可选注释的符号。</zh-CN><en>Symbol with source path and optional comment.</en></lang>
 * @param {string | undefined} producerName <lang><zh-CN>提取产物的生产者名称。</zh-CN><en>Extraction producer name.</en></lang>
 * @returns {object} <lang><zh-CN>带显式精度或仅来源身份的引用。</zh-CN><en>Reference with explicit precision or source identity alone.</en></lang>
 */
function createSourceRef(symbol, producerName) {
  // <lang><zh-CN>本地扫描器身份与来源标签同时匹配，才能套用本轮实样结论。</zh-CN><en>Both the local scanner identity and source label must match before applying the measured semantics.</en></lang>
  const localScanner = producerName === "@hia-doc/ts-doc-extractor" && symbol.source?.rangeSource === "fixture-scanner";
  const hasCommentRange = symbol.comment?.range !== undefined && symbol.comment?.range !== null;
  const range = hasCommentRange ? symbol.comment.range : symbol.source?.range;
  const sourceId = sourceIdForPath(symbol.source.path);
  if (!range) {
    return { sourceId, rangeSource: "unresolved", confidence: "none" };
  }

  // <lang><zh-CN>列单位只在起止列齐备时声明为 UTF-16；缺列不把行线索伪装为精确坐标。</zh-CN><en>Declare UTF-16 only when both endpoint columns exist; incomplete line hints must not masquerade as precise coordinates.</en></lang>
  const completeColumns = Number.isSafeInteger(range.start?.column) && Number.isSafeInteger(range.end?.column);
  const localComment = localScanner && hasCommentRange;
  const columnUnit = localScanner && completeColumns ? "utf16-code-unit" : "unknown";
  const endBoundary = localComment && completeColumns ? "exclusive" : "unknown";
  const rangeSource = localScanner ? "heuristic" : "adapter";
  const rangeSourceDetail = localScanner
    ? `tsdoc-fixture-scanner:${localComment ? "attached-comment" : "declaration"}`
    : "external-tsdoc-extraction";
  return {
    sourceId,
    range,
    rangeConvention: { endBoundary, columnUnit },
    rangeSource,
    rangeSourceDetail,
    confidence: localComment && completeColumns ? "high" : localScanner ? "medium" : "low"
  };
}

/**
 * @lang zh-CN 限定单源提取边界，拒绝任何会产生未登记 sourceId 的跨文件符号。
 * @lang en Enforces the single-source extraction boundary and rejects cross-file symbols that would create unregistered source IDs.
 * @param {object} artifact <lang><zh-CN>待转换的提取产物。</zh-CN><en>Extraction artifact to convert.</en></lang>
 * @returns {void} <lang><zh-CN>合法时不返回值。</zh-CN><en>Returns nothing when valid.</en></lang>
 * @throws {Error} <lang><zh-CN>契约不匹配或符号引用另一源文件。</zh-CN><en>The contract mismatches or a symbol refers to another source file.</en></lang>
 */
function assertTsDocArtifact(artifact) {
  if (!artifact || artifact.contract !== TSDOC_EXTRACTION_CONTRACT) {
    throw new Error(`Expected ${TSDOC_EXTRACTION_CONTRACT} artifact.`);
  }
  // <lang><zh-CN>写入器仅为根路径登记一个 source；多文件输入须在上游拆分，不能静默产生坏引用。</zh-CN><en>The writer registers only the root source path; upstream must split multi-file inputs instead of silently emitting broken references.</en></lang>
  for (const symbol of artifact.symbols ?? []) {
    if (symbol.source?.path !== artifact.source?.path) {
      throw new Error("TS_DOC_SOURCE_MAP_CROSS_FILE_SOURCE: 符号来源不属于单源提取产物 / Symbol source differs from the single-source extraction artifact.");
    }
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
