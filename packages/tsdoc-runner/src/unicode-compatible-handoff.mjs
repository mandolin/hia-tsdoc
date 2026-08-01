/**
 * Unicode-compatible TSDoc host handoff evaluator.
 * Unicode-compatible TSDoc 宿主交接评估器。
 *
 * This module consumes caller-supplied metadata only. It never discovers a project,
 * reads source/artifact bodies, executes a target command, or performs network I/O.
 * 本模块只消费调用方显式提供的元数据；绝不发现项目、读取源码/产物正文、执行目标命令或进行网络 I/O。
 */

/** The versioned report identity for this optional host handoff. / 此可选宿主交接的版本化报告标识。 */
export const UNICODE_COMPATIBLE_TSDOC_HANDOFF_CONTRACT = "unicode-compatible-tsdoc-handoff";

/** The draft version of the optional host handoff report. / 可选宿主交接报告的草案版本。 */
export const UNICODE_COMPATIBLE_TSDOC_HANDOFF_VERSION = "0.1.0-draft";

/** The only portfolio family accepted by this narrowly-scoped evaluator. / 本受限评估器唯一接受的 portfolio family。 */
export const UNICODE_COMPATIBLE_TARGET_FAMILY = "unicode-compatible";

/** Stable diagnostics emitted without copying caller paths or source content. / 不复制调用方路径或源码内容的稳定诊断码。 */
export const UNICODE_COMPATIBLE_TSDOC_HANDOFF_DIAGNOSTIC_CODES = Object.freeze([
  "TSDOC_UNICODE_HANDOFF_INVALID_REQUEST",
  "TSDOC_UNICODE_HANDOFF_UNSUPPORTED_FAMILY",
  "TSDOC_UNICODE_HANDOFF_PRODUCER_FAILED",
  "TSDOC_UNICODE_HANDOFF_MISSING_ARTIFACT",
  "TSDOC_UNICODE_HANDOFF_UNSAFE_ARTIFACT_PATH",
  "TSDOC_UNICODE_HANDOFF_DUPLICATE_ENTRY_ID",
  "TSDOC_UNICODE_HANDOFF_SOURCE_POLICY_REFUSED",
  "TSDOC_UNICODE_HANDOFF_EMBEDDED_SOURCE_REFUSED",
  "TSDOC_UNICODE_HANDOFF_DOC_LINKAGE_REFUSED",
  "TSDOC_UNICODE_HANDOFF_RELEASE_BOUNDARY_REFUSED"
]);

/** Required producer artifact kinds for a complete TypeScript-to-host handoff. / 完整 TypeScript 到宿主交接所需的 producer 产物类型。 */
const REQUIRED_ARTIFACT_KINDS = Object.freeze([
  "generated-js",
  "ordinary-source-map",
  "tsdoc-extraction",
  "jsdoc-bridge",
  "hia-document",
  "doc-source-map"
]);

/**
 * Evaluates public-safe TSDoc producer metadata for an optional Unicode-compatible host handoff.
 * 评估 public-safe TSDoc producer 元数据，以供可选的 Unicode-compatible 宿主交接。
 *
 * @param {unknown} request Explicit handoff evidence; source/artifact bodies are forbidden.
 * @returns {object} A versioned accepted/refused report with metadata-only diagnostics.
 */
export function evaluateUnicodeCompatibleTsDocHandoff(request) {
  /** Diagnostics are accumulated instead of throwing so an owner receives a complete refusal. / 累积诊断而非抛出，以便 owner 获得完整拒绝结果。 */
  const diagnostics = [];
  /** The request must remain a plain metadata record. / 请求必须保持为纯元数据 record。 */
  const evidence = isRecord(request) ? request : {};
  /** The target projection is normalized before any report field is exposed. / 先规范化目标投影，再暴露任何报告字段。 */
  const target = normalizeTarget(evidence.target, diagnostics);
  /** Producer projection keeps only its public id/version/status facts. / Producer 投影只保留公开 id/version/status 事实。 */
  const producer = normalizeProducer(evidence.producerResult, diagnostics);
  /** Artifact projection is checked without returning paths. / 检查产物投影，但不返回路径。 */
  const artifacts = normalizeArtifacts(evidence.producerResult?.artifacts, diagnostics);
  /** Stable entry projection is checked independently from compiler artifact identity. / 独立于编译器产物标识检查稳定 entry 投影。 */
  const entries = normalizeDocumentationEntries(evidence.documentationEntries, artifacts.byId, diagnostics);
  /** Source-map metadata confirms policy and linkage without opening a map. / Source-map 元数据确认 policy/linkage，而不打开 map。 */
  const sourceMapSummary = evaluateSourceMapEvidence(evidence.sourceMapEvidence, artifacts.byKind, diagnostics);
  /** Package-consumer isolation is explicit evidence, never inferred from a target layout. / package-consumer 隔离必须是显式 evidence，不从 target layout 推断。 */
  const releaseIsolation = evaluateReleaseIsolation(evidence.releaseIsolation, diagnostics);
  /** A valid report needs the exact request identity to avoid accidental cross-contract reuse. / 有效报告需要精确请求标识，避免意外跨 contract 复用。 */
  const requestIdentityValid = evidence.contract === "unicode-compatible-tsdoc-handoff-request"
    && evidence.contractVersion === UNICODE_COMPATIBLE_TSDOC_HANDOFF_VERSION;

  if (!requestIdentityValid) {
    diagnostics.push(diagnostic(
      "TSDOC_UNICODE_HANDOFF_INVALID_REQUEST",
      "交接 evidence 必须声明 unicode-compatible-tsdoc-handoff-request@0.1.0-draft。",
      "Handoff evidence must declare unicode-compatible-tsdoc-handoff-request@0.1.0-draft."
    ));
  }

  /** Refusal is deterministic: any error denies handoff rather than silently weakening privacy. / 拒绝是确定性的：任何 error 都拒绝交接，而非静默弱化隐私。 */
  const status = diagnostics.some((item) => item.severity === "error") ? "refused" : "accepted";

  return Object.freeze({
    contract: UNICODE_COMPATIBLE_TSDOC_HANDOFF_CONTRACT,
    contractVersion: UNICODE_COMPATIBLE_TSDOC_HANDOFF_VERSION,
    status,
    target,
    producer,
    entries,
    artifacts: artifacts.publicArtifacts,
    sourceMaps: sourceMapSummary,
    releaseIsolation,
    permissions: Object.freeze({
      targetRepositoryWrite: false,
      targetCommandExecuted: false,
      targetSourceBodyRead: false,
      targetArtifactBodyRead: false,
      networkAccessed: false,
      packagePublished: false
    }),
    diagnostics
  });
}

/**
 * Normalizes target identity while refusing unknown families.
 * 规范化目标标识，同时拒绝未知 family。
 *
 * @param {unknown} value Candidate target projection.
 * @param {Array<object>} diagnostics Mutable metadata-only diagnostic collection.
 * @returns {{ id: string, family: string }} Safe report target projection.
 */
function normalizeTarget(value, diagnostics) {
  /** Target must be a record because no filesystem discovery fallback is allowed. / target 必须是 record，因为不允许 filesystem discovery fallback。 */
  const target = isRecord(value) ? value : {};
  /** Invalid ids collapse to a neutral label and are not reflected verbatim. / 无效 id 收敛为中性标签，且不原样回显。 */
  const id = isStableIdentifier(target.id) ? target.id : "unknown";
  /** Only Unicode compatible hosts belong to this narrow report. / 只有 Unicode compatible host 属于此受限报告。 */
  const family = target.family === UNICODE_COMPATIBLE_TARGET_FAMILY ? target.family : "unknown";

  if (id === "unknown" || family === "unknown") {
    diagnostics.push(diagnostic(
      "TSDOC_UNICODE_HANDOFF_UNSUPPORTED_FAMILY",
      "target 必须提供安全 id，并且 family 必须为 unicode-compatible。",
      "target must provide a safe id and the unicode-compatible family."
    ));
  }

  return Object.freeze({ id, family });
}

/**
 * Normalizes result metadata and rejects a producer that did not finish successfully.
 * 规范化 result 元数据，并拒绝未成功完成的 producer。
 *
 * @param {unknown} value Candidate documentation producer result.
 * @param {Array<object>} diagnostics Mutable metadata-only diagnostic collection.
 * @returns {{ id: string, version: string, status: string }} Safe producer projection.
 */
function normalizeProducer(value, diagnostics) {
  /** Producer result remains caller supplied and must not be loaded from an output directory. / producer result 保持调用方提供，不得从 output directory 加载。 */
  const result = isRecord(value) ? value : {};
  /** Producer identity defaults to unknown when it cannot be safely projected. / producer identity 无法安全投影时默认为 unknown。 */
  const id = isStableIdentifier(result.producer?.id) ? result.producer.id : "unknown";
  /** Producer version is metadata, not a package lookup. / producer version 是元数据，不做 package lookup。 */
  const version = isVersionLabel(result.producer?.version) ? result.producer.version : "unknown";
  /** Only a completed producer can be handed to a compatible host owner. / 只有完成的 producer 才能交给 compatible host owner。 */
  const status = result.status === "success" ? "success" : "not-success";

  /** This runner's handoff must be attributable to the fixed TSDoc producer, not an arbitrary producer label. / 此 runner 的 handoff 必须可归因于固定 TSDoc producer，而非任意 producer label。 */
  const producerIsTsDoc = id === "tsdoc" && version !== "unknown";

  if (result.contract !== "documentation-producer-result" || result.contractVersion !== "0.1.0-draft" || status !== "success" || !producerIsTsDoc) {
    diagnostics.push(diagnostic(
      "TSDOC_UNICODE_HANDOFF_PRODUCER_FAILED",
      "producer result 必须是带 tsdoc id/version 的成功 documentation-producer-result@0.1.0-draft。",
      "producer result must be a successful documentation-producer-result@0.1.0-draft with a tsdoc id/version."
    ));
  }

  return Object.freeze({ id, version, status });
}

/**
 * Checks required artifact kinds and rejects unsafe path metadata without exposing it.
 * 检查必需产物类型，并拒绝不安全的路径元数据而不暴露路径。
 *
 * @param {unknown} value Candidate artifact array.
 * @param {Array<object>} diagnostics Mutable metadata-only diagnostic collection.
 * @returns {{ byId: Map<string, object>, byKind: Map<string, object[]>, publicArtifacts: object[] }} Internal and public projections.
 */
function normalizeArtifacts(value, diagnostics) {
  /** A missing array produces an empty projection and explicit missing-kind diagnostics. / 缺少数组会产生空投影及明确 missing-kind 诊断。 */
  const candidates = Array.isArray(value) ? value : [];
  /** Artifact ids are indexed to validate documentation entry references. / 按 artifact id 建索引以验证 documentation entry 引用。 */
  const byId = new Map();
  /** Artifact kinds are grouped to validate source-map evidence coverage. / 按 artifact kind 分组以验证 source-map evidence 覆盖。 */
  const byKind = new Map();
  /** Public projection deliberately excludes the caller artifact path. / public projection 特意排除调用方 artifact path。 */
  const publicArtifacts = [];

  for (const candidate of candidates) {
    /** Each artifact must be a record because scalar coercion can hide malformed evidence. / 每个 artifact 必须是 record，避免标量强制转换隐藏错误 evidence。 */
    const artifact = isRecord(candidate) ? candidate : {};
    /** Artifact ids are the only artifact locator copied into the report. / artifact id 是唯一复制到报告的 artifact locator。 */
    const id = isStableIdentifier(artifact.id) ? artifact.id : null;
    /** Kind is intentionally constrained to the runner's documented output vocabulary. / kind 有意约束为 runner 已文档化的 output vocabulary。 */
    const kind = typeof artifact.kind === "string" ? artifact.kind : null;
    /** Path policy rejects absolute/traversal-like values before they can escape as report data. / path policy 在路径可能逃逸为报告数据前拒绝 absolute/traversal-like 值。 */
    const pathIsSafe = isSafeRelativePath(artifact.path);

    if (!id || !kind) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_MISSING_ARTIFACT",
        "每个 producer artifact 都必须提供安全 id 和 kind。",
        "Every producer artifact must provide a safe id and kind."
      ));
      continue;
    }

    if (!pathIsSafe) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_UNSAFE_ARTIFACT_PATH",
        "producer artifact path 必须是安全相对路径；报告不会回显该路径。",
        "A producer artifact path must be safe and relative; the report does not echo it."
      ));
      continue;
    }

    if (byId.has(id)) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_MISSING_ARTIFACT",
        "producer artifact id 必须唯一。",
        "Producer artifact ids must be unique."
      ));
      continue;
    }

    /** Stored artifact has no path, preserving the report's privacy boundary. / 存储的 artifact 不含 path，以保持报告隐私边界。 */
    const safeArtifact = Object.freeze({ id, kind });
    byId.set(id, safeArtifact);
    /** Existing kind group is reused so multiple inputs are assessed independently. / 复用现有 kind group，使多个 input 分别受评估。 */
    const kindArtifacts = byKind.get(kind) ?? [];
    kindArtifacts.push(safeArtifact);
    byKind.set(kind, kindArtifacts);
    publicArtifacts.push(safeArtifact);
  }

  for (const requiredKind of REQUIRED_ARTIFACT_KINDS) {
    if (!byKind.has(requiredKind)) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_MISSING_ARTIFACT",
        `缺少 Unicode compatible handoff 所需的 ${requiredKind} artifact。`,
        `The ${requiredKind} artifact required by a Unicode compatible handoff is missing.`
      ));
    }
  }

  return Object.freeze({
    byId,
    byKind,
    publicArtifacts: Object.freeze(publicArtifacts)
  });
}

/**
 * Validates stable documentation entries and their artifact references.
 * 验证稳定 documentation entry 及其 artifact 引用。
 *
 * @param {unknown} value Candidate stable entry array.
 * @param {Map<string, object>} artifactsById Safe artifact index.
 * @param {Array<object>} diagnostics Mutable metadata-only diagnostic collection.
 * @returns {object[]} Privacy-safe stable entry report projection.
 */
function normalizeDocumentationEntries(value, artifactsById, diagnostics) {
  /** Entry candidates are never inferred from source code or HIA document bodies. / entry candidates 绝不从源码或 HIA document 正文推断。 */
  const candidates = Array.isArray(value) ? value : [];
  /** Seen ids make duplicate identity a deterministic refusal. / 已见 id 使 duplicate identity 成为确定性拒绝。 */
  const seenIds = new Set();
  /** Only stable ids and artifact ids survive into the report. / 只有 stable id 与 artifact id 进入报告。 */
  const entries = [];

  if (candidates.length === 0) {
    diagnostics.push(diagnostic(
      "TSDOC_UNICODE_HANDOFF_DUPLICATE_ENTRY_ID",
      "handoff 至少需要一个 stable documentation entry。",
      "A handoff requires at least one stable documentation entry."
    ));
  }

  for (const candidate of candidates) {
    /** Candidate entries are records to keep the accepted projection deterministic. / candidate entry 必须为 record，以保持 accepted projection 确定性。 */
    const entry = isRecord(candidate) ? candidate : {};
    /** Stable entry identity cannot contain path separators or whitespace. / stable entry identity 不能包含 path separator 或空白。 */
    const id = isStableIdentifier(entry.id) ? entry.id : null;
    /** Artifact references are IDs, not paths or source locations. / artifact 引用是 ID，而不是 path 或 source location。 */
    const artifactIds = Array.isArray(entry.artifactIds) ? entry.artifactIds.filter(isStableIdentifier) : [];

    if (!id || seenIds.has(id)) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_DUPLICATE_ENTRY_ID",
        "documentation entry id 必须安全且唯一。",
        "A documentation entry id must be safe and unique."
      ));
      continue;
    }

    seenIds.add(id);
    /** Missing references deny handoff because a host must not guess the entry artifact. / 缺失引用会拒绝 handoff，因为 host 不能猜测 entry artifact。 */
    /** Invalid IDs cannot be silently discarded because a host must be able to reproduce every claimed relation. / invalid ID 不能被静默丢弃，因为 host 必须能复现每个已声明 relation。 */
    const hasInvalidArtifactId = !Array.isArray(entry.artifactIds) || entry.artifactIds.length !== artifactIds.length;
    /** Unknown references deny handoff because the report does not carry artifact paths as a fallback. / unknown reference 拒绝 handoff，因为报告不携带 artifact path 作为 fallback。 */
    const hasUnknownArtifact = artifactIds.length === 0 || artifactIds.some((artifactId) => !artifactsById.has(artifactId));
    /** A document entry needs both its projected HIA document and its provenance map. / document entry 需要 projected HIA document 与 provenance map。 */
    const referencedKinds = artifactIds.map((artifactId) => artifactsById.get(artifactId)?.kind);
    /** Required relation kinds prevent a stable id from pointing only to generated JavaScript. / required relation kind 防止 stable id 只指向 generated JavaScript。 */
    const hasDocumentationProjection = referencedKinds.includes("hia-document") && referencedKinds.includes("doc-source-map");

    if (hasInvalidArtifactId || hasUnknownArtifact || !hasDocumentationProjection) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_MISSING_ARTIFACT",
        "documentation entry 必须引用已知、有效的 HIA document 与 doc-source-map artifact id。",
        "A documentation entry must reference known, valid HIA document and doc-source-map artifact ids."
      ));
      continue;
    }

    entries.push(Object.freeze({ id, artifactIds: Object.freeze([...artifactIds]) }));
  }

  return Object.freeze(entries);
}

/**
 * Confirms source-map policies and provenance links from metadata-only evidence.
 * 从 metadata-only evidence 确认 source-map policy 与 provenance link。
 *
 * @param {unknown} value Candidate source-map evidence.
 * @param {Map<string, object[]>} artifactsByKind Safe artifact-kind index.
 * @param {Array<object>} diagnostics Mutable metadata-only diagnostic collection.
 * @returns {{ ordinarySourceMapCount: number, documentationSourceMapCount: number, sourcesContentPolicy: string }} Safe source-map summary.
 */
function evaluateSourceMapEvidence(value, artifactsByKind, diagnostics) {
  /** Source-map evidence is an optional object only syntactically; both map families are mandatory semantically. / source-map evidence 在语法上可选 object，但语义上两类 map 都必需。 */
  const evidence = isRecord(value) ? value : {};
  /** Ordinary map facts represent the compiler map without opening it. / ordinary map facts 代表 compiler map，但不打开它。 */
  const ordinary = Array.isArray(evidence.ordinary) ? evidence.ordinary : [];
  /** Documentation map facts represent HIA linkage without embedding the map model. / documentation map facts 代表 HIA linkage，但不嵌入 map model。 */
  const documentation = Array.isArray(evidence.documentation) ? evidence.documentation : [];
  /** Expected ordinary map ids come from producer metadata, not target filesystem discovery. / 预期 ordinary map id 来自 producer metadata，而非 target filesystem discovery。 */
  const ordinaryArtifactIds = new Set((artifactsByKind.get("ordinary-source-map") ?? []).map((artifact) => artifact.id));
  /** Expected documentation map ids come from producer metadata, not source inspection. / 预期 documentation map id 来自 producer metadata，而非 source inspection。 */
  const documentationArtifactIds = new Set((artifactsByKind.get("doc-source-map") ?? []).map((artifact) => artifact.id));
  /** Matched ordinary ids detect both missing and forged coverage evidence. / matched ordinary id 检测缺失与伪造 coverage evidence。 */
  const matchedOrdinaryIds = new Set();
  /** Matched documentation ids detect missing provenance linkage. / matched documentation id 检测缺少 provenance linkage。 */
  const matchedDocumentationIds = new Set();

  for (const candidate of ordinary) {
    /** Evidence entries are isolated as records so malformed input has no side effect. / 将 evidence entry 隔离为 record，使畸形 input 无副作用。 */
    const entry = isRecord(candidate) ? candidate : {};
    /** Evidence must name a known map artifact id. / evidence 必须给出已知 map artifact id。 */
    const artifactId = isStableIdentifier(entry.artifactId) ? entry.artifactId : null;
    /** `none` is the only policy that can cross this handoff boundary. / `none` 是唯一可跨越此 handoff 边界的 policy。 */
    const policyIsNone = entry.sourcesContentPolicy === "none";
    /** Embedded or fetched body flags are explicit denial facts. / embedded 或 fetched body flag 是显式 denial fact。 */
    const bodyIsAbsent = entry.sourceBodyPresent === false && entry.fetchedSourceBodyPresent !== true;

    if (!artifactId || !ordinaryArtifactIds.has(artifactId)) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_MISSING_ARTIFACT",
        "ordinary source-map evidence 必须引用已知 ordinary-source-map artifact。",
        "Ordinary source-map evidence must reference a known ordinary-source-map artifact."
      ));
      continue;
    }

    matchedOrdinaryIds.add(artifactId);

    if (!policyIsNone) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_SOURCE_POLICY_REFUSED",
        "ordinary source map 的 sourcesContentPolicy 必须为 none。",
        "An ordinary source map must declare sourcesContentPolicy none."
      ));
    }

    if (!bodyIsAbsent) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_EMBEDDED_SOURCE_REFUSED",
        "ordinary source-map evidence 不能声明 embedded 或 fetched source body。",
        "Ordinary source-map evidence must not declare embedded or fetched source bodies."
      ));
    }
  }

  for (const candidate of documentation) {
    /** Documentation evidence entry remains metadata-only and never contains the sidecar body. / documentation evidence entry 保持 metadata-only，绝不包含 sidecar 正文。 */
    const entry = isRecord(candidate) ? candidate : {};
    /** Map artifact id binds provenance to the producer result. / map artifact id 将 provenance 绑定到 producer result。 */
    const artifactId = isStableIdentifier(entry.artifactId) ? entry.artifactId : null;
    /** Linkage asserts the approved TS-to-JS provenance direction. / linkage 断言已批准的 TS-to-JS provenance 方向。 */
    const linkageIsValid = entry.linkage === "ts-to-js";
    /** Documentation sidecar source bodies are forbidden just as ordinary map bodies are. / documentation sidecar source body 与 ordinary map body 一样被禁止。 */
    const bodyIsAbsent = entry.sourceBodyPresent === false && entry.fetchedSourceBodyPresent !== true;

    if (!artifactId || !documentationArtifactIds.has(artifactId)) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_MISSING_ARTIFACT",
        "doc-source-map evidence 必须引用已知 doc-source-map artifact。",
        "doc-source-map evidence must reference a known doc-source-map artifact."
      ));
      continue;
    }

    matchedDocumentationIds.add(artifactId);

    if (!linkageIsValid || !bodyIsAbsent) {
      diagnostics.push(diagnostic(
        "TSDOC_UNICODE_HANDOFF_DOC_LINKAGE_REFUSED",
        "doc-source-map evidence 必须声明 ts-to-js linkage 且无 source body。",
        "doc-source-map evidence must declare ts-to-js linkage and no source body."
      ));
    }
  }

  if (matchedOrdinaryIds.size !== ordinaryArtifactIds.size || matchedDocumentationIds.size !== documentationArtifactIds.size) {
    diagnostics.push(diagnostic(
      "TSDOC_UNICODE_HANDOFF_MISSING_ARTIFACT",
      "每个 producer source-map artifact 都需要一条 metadata-only evidence。",
      "Every producer source-map artifact requires metadata-only evidence."
    ));
  }

  return Object.freeze({
    ordinarySourceMapCount: matchedOrdinaryIds.size,
    documentationSourceMapCount: matchedDocumentationIds.size,
    sourcesContentPolicy: "none"
  });
}

/**
 * Validates tarball-consumer isolation and denies any target-side capability.
 * 验证 tarball-consumer 隔离，并拒绝任何 target-side capability。
 *
 * @param {unknown} value Candidate release-isolation evidence.
 * @param {Array<object>} diagnostics Mutable metadata-only diagnostic collection.
 * @returns {{ consumerSurface: string, localLink: boolean | string, targetRepositoryWrite: boolean | string, sourceBodyRead: boolean | string, network: boolean | string }} Safe boundary projection.
 */
function evaluateReleaseIsolation(value, diagnostics) {
  /** Release evidence must be explicit because package layouts differ among Wave 1 hosts. / release evidence 必须显式，因为 Wave 1 host 的 package layout 不同。 */
  const evidence = isRecord(value) ? value : {};
  /** A tarball surface avoids accidental monorepo or local-link coupling. / tarball surface 避免意外 monorepo 或 local-link 耦合。 */
  const consumerSurface = evidence.consumerSurface === "npm-tarball" ? "npm-tarball" : "unknown";
  /** Local-link evidence must be explicit; unknown is refused rather than normalized to false. / local-link evidence 必须显式；unknown 会被拒绝，不能规范化为 false。 */
  const localLink = normalizeBoundaryBoolean(evidence.localLink);
  /** Target-write evidence must be explicit; it is never inferred from a missing field. / target-write evidence 必须显式；绝不从缺失字段推断。 */
  const targetRepositoryWrite = normalizeBoundaryBoolean(evidence.targetRepositoryWrite);
  /** Source-read evidence includes map bodies and must be explicitly denied. / source-read evidence 包括 map body，必须显式拒绝。 */
  const sourceBodyRead = normalizeBoundaryBoolean(evidence.sourceBodyRead);
  /** Network evidence is explicit because an offline report cannot trust omission. / network evidence 是显式的，因为离线报告不能信任 omission。 */
  const network = normalizeBoundaryBoolean(evidence.network);

  if (consumerSurface !== "npm-tarball" || localLink !== false || targetRepositoryWrite !== false || sourceBodyRead !== false || network !== false) {
    diagnostics.push(diagnostic(
      "TSDOC_UNICODE_HANDOFF_RELEASE_BOUNDARY_REFUSED",
      "release isolation 必须是 npm-tarball consumer，且 local link、target write、source read、network 必须显式全为 false。",
      "Release isolation requires an npm-tarball consumer and explicit false local-link, target-write, source-read, and network flags."
    ));
  }

  return Object.freeze({
    consumerSurface,
    localLink,
    targetRepositoryWrite,
    sourceBodyRead,
    network
  });
}

/**
 * Preserves an explicit boundary boolean or reports unknown instead of inventing a safe default.
 * 保留显式 boundary boolean；未知时报告 unknown，而不是虚构安全默认值。
 *
 * @param {unknown} value Candidate boundary value.
 * @returns {boolean | string} Explicit boolean or the `unknown` refusal marker.
 */
function normalizeBoundaryBoolean(value) {
  return typeof value === "boolean" ? value : "unknown";
}

/**
 * Creates an immutable bilingual diagnostic without leaking source data.
 * 创建不泄漏源码数据的不可变双语诊断。
 *
 * @param {string} code Stable diagnostic code.
 * @param {string} messageZh Chinese explanation.
 * @param {string} messageEn English explanation.
 * @returns {{ code: string, severity: string, message: { zh-CN: string, en: string } }} Safe diagnostic.
 */
function diagnostic(code, messageZh, messageEn) {
  return Object.freeze({
    code,
    severity: "error",
    message: Object.freeze({ "zh-CN": messageZh, en: messageEn })
  });
}

/**
 * Detects a plain record without accepting arrays or null.
 * 判断 plain record，不接受 array 或 null。
 *
 * @param {unknown} value Candidate value.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Allows compact stable IDs while forbidding whitespace and path separators.
 * 允许紧凑 stable ID，同时禁止空白和 path separator。
 *
 * @param {unknown} value Candidate identifier.
 * @returns {value is string} Whether the identifier is safe for report projection.
 */
function isStableIdentifier(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(value);
}

/**
 * Accepts a compact version label without interpreting package semantics.
 * 接受紧凑 version label，但不解释 package semantics。
 *
 * @param {unknown} value Candidate version label.
 * @returns {value is string} Whether the version is safe for report projection.
 */
function isVersionLabel(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u.test(value);
}

/**
 * Rejects absolute, URI-like, traversal, and empty artifact path values.
 * 拒绝 absolute、URI-like、traversal 和 empty artifact path 值。
 *
 * @param {unknown} value Candidate artifact path.
 * @returns {boolean} Whether the path is safe and relative.
 */
function isSafeRelativePath(value) {
  /** Normalization makes Windows separators subject to the same traversal check. / normalization 使 Windows separator 接受同一 traversal 检查。 */
  const normalized = typeof value === "string" ? value.replaceAll("\\", "/") : "";
  /** Segments are inspected without resolving against a local filesystem. / 检查 segment，但不对本地 filesystem resolve。 */
  const segments = normalized.split("/");

  return Boolean(normalized)
    && !normalized.startsWith("/")
    && !normalized.startsWith("\\")
    && !/^[A-Za-z]:/u.test(normalized)
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(normalized)
    && !segments.includes("..")
    && !segments.some((segment) => segment.length === 0);
}
