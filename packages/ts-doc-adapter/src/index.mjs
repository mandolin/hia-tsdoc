import { TSDOC_CLASSIFICATIONS, TSDOC_EXTRACTION_CONTRACT, readTsDocExtraction } from "@hia-doc/tsdoc-spec";

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
  // <lang lang="zh-CN">新项目格式呈现实际类型和成员；旧版仍精确保留只在metadata呈现类型的行为。</lang><lang lang="en">The project format presents real types and members; legacy artifacts retain metadata-only type behavior.</lang>
  const visibleSymbols = tsArtifact.contractVersion === "0.2.0-draft" ? tsArtifact.symbols : runtimeSymbols;
  const symbols = visibleSymbols.map((symbol) => mapRuntimeSymbol(symbol));

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
        symbolIds: visibleSymbols.map((symbol) => symbol.id)
      }
    ],
    symbols,
    diagnostics: tsArtifact.diagnostics ?? [],
    metadata: {
      sourceContract: tsArtifact.contract,
      sourceContractVersion: tsArtifact.contractVersion,
      producer: tsArtifact.producer,
      ...(tsArtifact.contractVersion === "0.2.0-draft" ? { typeScriptProject: { modules: tsArtifact.modules } } : {}),
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

/**
 * @lang zh-CN 核验两代提取身份，新项目对象额外校验模块和逐声明引用。
 * @lang en Validate both extraction generations, additionally checking module/declaration references for project objects.
 * @param {object} artifact - 已解析输入。 Parsed input.
 * @returns {void} 有效时返回。 Returns when valid.
 * @throws {Error} 身份、版本或引用无效。 Invalid identity, version or references.
 */
export function assertTsDocArtifact(artifact) {
  readTsDocExtraction(artifact);
  if (!artifact || artifact.contract !== TSDOC_EXTRACTION_CONTRACT) {
    throw new Error(`Expected ${TSDOC_EXTRACTION_CONTRACT} artifact.`);
  }
  if (!Array.isArray(artifact.symbols)) {
    throw new Error("TSDoc extraction artifact must contain symbols array.");
  }
}

/**
 * @lang zh-CN 投影真实声明及原注释，项目类型/成员沿用核心词汇，不产生源码访问权限。
 * @lang en Project actual declarations and comments using core kinds for project types/members without granting source access.
 * @param {object} symbol - 已验证提取符号。 Validated extraction symbol.
 * @returns {object} 核心符号。 Core symbol.
 */
function mapRuntimeSymbol(symbol) {
  // <lang><zh-CN>核心对象保留实际来源和类型分类；可见摘要只是完整i18n字段的缓存。</zh-CN><en>The core object retains actual sources and classifications; its visible summary only caches the full i18n fields.</en></lang>
  const mapped = {
    id: symbol.id,
    name: symbol.name,
    kind: ({"ts-runtime-class":"class","ts-runtime-constant":"constant","ts-runtime-variable":"member","ts-interface":"typedef","ts-type-alias":"typedef","ts-property":"member","ts-method":"function","ts-namespace":"module","ts-runtime-enum":"typedef"})[symbol.kind] ?? "function",
    ...(symbol.parentId ? { parentId: symbol.parentId } : {}),
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
        ...(symbol.metadata?.modulePath ? { modulePath: symbol.metadata.modulePath, syntaxKind: symbol.metadata.syntaxKind } : {}),
        comment: symbol.comment ?? null
      }
    }
  };
  if (symbol.comment?.i18n) {
    mapped.i18n = symbol.comment.i18n;
  }
  // <lang lang="zh-CN">新项目产物直接满足JSON数据约束；无注释时省略未定义缓存字段，旧对象行为保持。</lang><lang lang="en">Project output directly satisfies JSON-data constraints by omitting undefined caches for undocumented declarations; legacy object behavior remains unchanged.</lang>
  if (symbol.metadata?.modulePath) for (const key of Object.keys(mapped)) if (mapped[key] === undefined) delete mapped[key];
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
