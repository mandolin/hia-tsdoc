import { TSDOC_CLASSIFICATIONS, TSDOC_EXTRACTION_CONTRACT } from "@hia-doc/tsdoc-spec";

const HIA_CORE_SCHEMA_VERSION = "0.2.0";
const HIA_SOURCE_MODEL = "hia-source";
const HIA_SOURCE_MODEL_VERSION = "0.2.0";
const DOC_SOURCE_MAP_CONTRACT_VERSION = "1.1.0";

/**
 * @lang zh-CN 将 TypeScript 提取产物投影为 HIA 文档；映射元数据仅在实际映射路径存在时登记，版本可由运行器精确传入。
 * @lang en Projects a TypeScript extraction artifact into an HIA document; registers map metadata only for an actual map path, with its precise version supplied by the runner.
 * @param {object} tsArtifact <lang><zh-CN>TypeScript 提取产物。</zh-CN><en>TypeScript extraction artifact.</en></lang>
 * @param {object} [options] <lang><zh-CN>文档及映射引用选项。</zh-CN><en>Document and map-reference options.</en></lang>
 * @returns {object} <lang><zh-CN>HIA 核心文档，不包含源码正文。</zh-CN><en>HIA core document without source bodies.</en></lang>
 */
export function tsDocToHiaDocument(tsArtifact, options = {}) {
  assertTsDocArtifact(tsArtifact);
  const runtimeSymbols = tsArtifact.symbols.filter((symbol) => symbol.classification === TSDOC_CLASSIFICATIONS.runtime);
  const typeOnlySymbols = tsArtifact.symbols.filter((symbol) => symbol.classification === TSDOC_CLASSIFICATIONS.typeOnly);
  const title = options.title ?? "TSDoc Document";
  const defaultLocale = options.defaultLocale ?? tsArtifact.defaultLocale ?? "en";
  const symbols = runtimeSymbols.map((symbol) => mapRuntimeSymbol(symbol));

  return {
    schemaVersion: HIA_CORE_SCHEMA_VERSION,
    id: options.id ?? "tsdoc:document",
    title,
    defaultLocale,
    locales: collectDocumentLocales(options.locales, tsArtifact.locales, symbols, defaultLocale),
    nodes: [
      {
        id: "root",
        kind: "root",
        title,
        symbolIds: runtimeSymbols.map((symbol) => symbol.id)
      }
    ],
    symbols,
    diagnostics: tsArtifact.diagnostics ?? [],
    metadata: {
      sourceContract: tsArtifact.contract,
      sourceContractVersion: tsArtifact.contractVersion,
      producer: tsArtifact.producer,
      typeOnlySymbols: typeOnlySymbols.map((symbol) => ({
        id: symbol.id,
        name: symbol.name,
        kind: symbol.kind,
        source: symbol.source,
        comment: symbol.comment ?? null
      })),
      docSourceMaps: options.docSourceMapPath
        ? [
            {
              contract: "doc-source-map",
              contractVersion: options.docSourceMapContractVersion ?? DOC_SOURCE_MAP_CONTRACT_VERSION,
              path: options.docSourceMapPath,
              entryArtifact: options.entryArtifact ?? null
            }
          ]
        : []
    }
  };
}

export function assertTsDocArtifact(artifact) {
  if (!artifact || artifact.contract !== TSDOC_EXTRACTION_CONTRACT) {
    throw new Error(`Expected ${TSDOC_EXTRACTION_CONTRACT} artifact.`);
  }
  if (!Array.isArray(artifact.symbols)) {
    throw new Error("TSDoc extraction artifact must contain symbols array.");
  }
}

function mapRuntimeSymbol(symbol) {
  const mapped = {
    id: symbol.id,
    name: symbol.name,
    kind: symbol.kind === "ts-runtime-class" ? "class" : "function",
    signature: symbol.signature,
    summary: symbol.comment?.i18n?.fields?.description?.defaultText ?? symbol.comment?.summary ?? undefined,
    source: {
      model: HIA_SOURCE_MODEL,
      modelVersion: HIA_SOURCE_MODEL_VERSION,
      mode: "link",
      definedIn: {
        kind: "defined-in",
        relativePath: symbol.source.path,
        language: "typescript",
        position: symbol.source.range.start,
        range: symbol.source.range,
        link: {
          enabled: false,
          openMode: "same-tab"
        }
      },
      primaryBlock: null,
      references: [],
      fragments: [],
      diagnostics: []
    },
    diagnostics: symbol.diagnostics ?? [],
    metadata: {
      tsdoc: {
        classification: symbol.classification,
        tsKind: symbol.kind,
        comment: symbol.comment ?? null
      }
    }
  };
  if (symbol.comment?.i18n) {
    mapped.i18n = symbol.comment.i18n;
  }
  return mapped;
}

function collectDocumentLocales(optionLocales, artifactLocales, symbols, defaultLocale) {
  const locales = [
    defaultLocale,
    ...(Array.isArray(optionLocales) ? optionLocales : []),
    ...(Array.isArray(artifactLocales) ? artifactLocales : [])
  ];
  for (const symbol of symbols) {
    locales.push(...(Array.isArray(symbol.i18n?.locales) ? symbol.i18n.locales : []));
  }
  return [...new Set(locales.map((locale) => normalizeLocale(locale)).filter(Boolean))];
}

function normalizeLocale(value) {
  const locale = String(value ?? "").trim().replace(/_/g, "-");
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale) ? locale : "";
}
