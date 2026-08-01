/**
 * Unicode-compatible owner evidence-packet evaluator.
 * Unicode-compatible owner evidence-packet 评估器。
 *
 * This module combines two caller-provided, already-materialized report objects. It does not
 * discover a project, read source/artifact bodies, execute a target command, or contact a network service.
 * 本模块组合两份由调用方提供且已经 materialized 的 report object；它不发现项目、不读取源码/产物正文、
 * 不执行 target command，也不访问 network service。
 */

/**
 * Neutral contract identifier for an optional owner-review evidence packet.
 * 可选 owner-review evidence packet 的中性 contract identifier。
 */
export const UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_CONTRACT = "unicode-compatible-owner-evidence-packet";

/**
 * Initial draft contract version for the optional owner-review packet.
 * 可选 owner-review packet 的初始 draft contract version。
 */
export const UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION = "0.1.0-draft";

/**
 * Fixed public-safe diagnostics for packet validation failures.
 * packet validation failure 的固定 public-safe diagnostics。
 *
 * Messages are selected locally from this list and never interpolate caller report content, paths, or target state.
 * message 只从本表本地选取，绝不插入 caller report 内容、path 或 target state。
 */
export const UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_DIAGNOSTIC_CODES = Object.freeze([
  "UNICODE_OWNER_PACKET_ID_INVALID",
  "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID",
  "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID",
  "UNICODE_OWNER_PACKET_VERSION_UNSUPPORTED",
  "UNICODE_OWNER_PACKET_TARGET_IDENTITY_MISMATCH",
  "UNICODE_OWNER_PACKET_PRIVACY_PERMISSION_REFUSED",
  "UNICODE_OWNER_PACKET_ADOPTION_CLAIM_REFUSED"
]);

/** The only accepted source-report contracts for this narrow P2 compatibility surface. / 此受限 P2 compatibility surface 唯一接受的 source-report contracts。 */
const ACCEPTANCE_CONTRACT = "target-documentation-acceptance";
/** W-P73's initial draft version must be exact rather than inferred from SemVer. / W-P73 的初始 draft version 必须 exact，而不能从 SemVer 推断。 */
const ACCEPTANCE_VERSION = "0.1.0-draft";
/** W-P73's generated-evidence precursor remains part of acceptance-report validation. / W-P73 的 generated-evidence precursor 仍属于 acceptance-report validation。 */
const GENERATED_EVIDENCE_CONTRACT = "hia-generated-docs-evidence-summary";
/** The generated-evidence precursor version remains a fixed P2 input. / generated-evidence precursor version 保持固定 P2 input。 */
const GENERATED_EVIDENCE_VERSION = "0.1.0-draft";
/** W-P74's narrow Unicode-compatible handoff report contract. / W-P74 的受限 Unicode-compatible handoff report contract。 */
const HANDOFF_CONTRACT = "unicode-compatible-tsdoc-handoff";
/** W-P74's initial draft version must match exactly. / W-P74 的初始 draft version 必须 exact match。 */
const HANDOFF_VERSION = "0.1.0-draft";
/** The only selected target family; the evaluator deliberately has no generic portfolio fallback. / 唯一选定的 target family；评估器特意没有 generic portfolio fallback。 */
const TARGET_FAMILY = "unicode-compatible";
/** The fixed producer identity that W-P74 already validated. / W-P74 已经验证的固定 producer identity。 */
const TSDOC_PRODUCER_ID = "tsdoc";
/** Stable packet identity excludes paths, URLs, whitespace, and opaque hashes. / 稳定 packet identity 排除 path、URL、空白与 opaque hash。 */
const PACKET_ID_PATTERN = /^unicode-owner-packet:[a-z0-9][a-z0-9-]{0,63}$/u;
/** Stable public target identifiers retain the same compact lower-case shape as the WorkZone packet schema. / 稳定 public target identifier 保持与 WorkZone packet schema 相同的 compact lower-case shape。 */
const TARGET_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
/** Stable report identifiers are metadata-only and cannot contain a path separator. / 稳定 report identifier 是 metadata-only，不能包含 path separator。 */
const REPORT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
/** Logical revisions intentionally do not encode timestamps or source digests. / 逻辑 revision 特意不编码 timestamp 或 source digest。 */
const REVISION_PATTERN = /^r[1-9][0-9]*$/u;
/** Producer versions are bounded labels, not package-manager lookups. / producer version 是有界 label，而不是 package-manager lookup。 */
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u;
/** W-P74's required artifact kinds in deterministic output order. / W-P74 的 required artifact kind 按确定性 output order 排列。 */
const REQUIRED_ARTIFACT_KINDS = Object.freeze([
  "generated-js",
  "ordinary-source-map",
  "tsdoc-extraction",
  "jsdoc-bridge",
  "hia-document",
  "doc-source-map"
]);
/** Diagnostic order is fixed so identical input gives byte-stable JSON ordering. / diagnostic order 固定，使相同 input 获得 byte-stable JSON ordering。 */
const DIAGNOSTIC_ORDER = Object.freeze([...UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_DIAGNOSTIC_CODES]);
/** Refusal families are likewise fixed and never contain caller values. / refusal family 同样固定，绝不包含 caller value。 */
const REFUSAL_REASON_ORDER = Object.freeze([
  "packet-id",
  "acceptance-report",
  "handoff-report",
  "version",
  "target-identity",
  "privacy-permission",
  "adoption-claim"
]);

/**
 * Build a deterministic owner-review packet or a privacy-safe refusal from two explicit reports.
 * 由两份显式 report 构建确定性 owner-review packet 或 privacy-safe refusal。
 *
 * @param {unknown} request <lang><zh-CN>caller-provided packet id/revision 与 W-P73/W-P74 report object。</zh-CN><en>Caller-provided packet id/revision plus W-P73/W-P74 report objects.</en></lang>
 * @returns {object} <lang><zh-CN>ready packet 或不回显 caller input 的 refused packet。</zh-CN><en>A ready packet or a refused packet that does not echo caller input.</en></lang>
 * @lang zh-CN>此函数是 pure evaluator：不读文件、不执行 command、不导入 main CLI runtime、也不触发 network/target action。</lang>
 */
export function createUnicodeCompatibleOwnerEvidencePacket(request) {
  // <lang><zh-CN>primitive/array request 退化为空 record；所有失败仍以固定 diagnostic 返回。</zh-CN><en>A primitive/array request degrades to an empty record; every failure still returns fixed diagnostics.</en></lang>
  const candidate = isRecord(request) ? request : {};
  // <lang><zh-CN>diagnostic map 按 code 去重，避免一个 malformed object 反复放大 report。</zh-CN><en>The diagnostic map deduplicates by code so one malformed object cannot inflate the report.</en></lang>
  const diagnostics = new Map();
  // <lang><zh-CN>packet metadata 在 source-report validation 前单独检查，确保 identity failure 不泄漏 report 字段。</zh-CN><en>Packet metadata is checked separately before source-report validation so identity failure does not leak report fields.</en></lang>
  const packet = normalizePacketMetadata(candidate.packetId, candidate.revision, diagnostics);
  // <lang><zh-CN>acceptance report 只生成所需 count/privacy summary；不会保留 entry id 或 evidence body。</zh-CN><en>The acceptance report produces only the required count/privacy summary; it retains no entry id or evidence body.</en></lang>
  const acceptance = normalizeAcceptanceReport(candidate.acceptanceReport, diagnostics);
  // <lang><zh-CN>handoff report 只生成 kind/count/policy summary；path 与 original artifact body 永不跨越函数边界。</zh-CN><en>The handoff report produces only kind/count/policy summaries; paths and original artifact bodies never cross the function boundary.</en></lang>
  const handoff = normalizeHandoffReport(candidate.handoffReport, diagnostics);
  // <lang><zh-CN>caller 若显式声称 run/adoption，立即拒绝；遗漏并不被解释为 affirmative evidence。</zh-CN><en>An explicit caller run/adoption claim is immediately refused; omission is never interpreted as affirmative evidence.</en></lang>
  if (candidate.targetRunClaimed === true || candidate.targetAdoptionClaimed === true) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_ADOPTION_CLAIM_REFUSED");
  }
  // <lang><zh-CN>只有两个已验证 target projection 都存在时才比较；无法验证时拒绝结果也不回显 identity。</zh-CN><en>Compare only when both validated target projections exist; an unverifiable identity is not echoed in a refusal result.</en></lang>
  const target = combineTargetIdentity(acceptance?.target, handoff?.target, diagnostics);

  // <lang><zh-CN>任何 error 都 fail closed；refusal shape 不含 packet id、target 或 source-report projection。</zh-CN><en>Any error fails closed; the refusal shape contains no packet id, target, or source-report projection.</en></lang>
  if (diagnostics.size > 0 || !packet || !acceptance || !handoff || !target) {
    return createRefusalPacket(diagnostics);
  }

  // <lang><zh-CN>ready packet 只由 already-sanitized projection 组成，使 JSON output 与 caller report 的未知字段隔离。</zh-CN><en>The ready packet uses only already-sanitized projections, isolating JSON output from unknown caller-report fields.</en></lang>
  return freezePacket({
    contract: UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_CONTRACT,
    contractVersion: UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION,
    status: "ready-for-owner-review",
    packet,
    target,
    sourceReports: {
      acceptance: acceptance.summary,
      handoff: handoff.summary
    },
    compatibility: {
      acceptanceReportVersion: ACCEPTANCE_VERSION,
      handoffReportVersion: HANDOFF_VERSION,
      targetIdentityMatch: true,
      entryIdentityCorrelation: "not-asserted"
    },
    evidenceSemantics: {
      resolution: "report-contract-validated",
      confidence: "caller-provided-unverified",
      provenance: "metadata-only-derived-projection"
    },
    privacy: privacyBoundary(),
    permissions: permissionBoundary(),
    adoption: adoptionBoundary(),
    diagnostics: []
  });
}

/**
 * Validates caller-provided packet metadata without copying invalid values.
 * 验证 caller-provided packet metadata，不复制无效值。
 *
 * @param {unknown} packetId <lang><zh-CN>候选稳定 packet id。</zh-CN><en>Candidate stable packet id.</en></lang>
 * @param {unknown} revision <lang><zh-CN>候选逻辑 revision。</zh-CN><en>Candidate logical revision.</en></lang>
 * @param {Map<string, object>} diagnostics <lang><zh-CN>固定 diagnostic 收集器。</zh-CN><en>Fixed diagnostic collector.</en></lang>
 * @returns {{ id: string, revision: string } | null} <lang><zh-CN>安全 metadata；失败为 null。</zh-CN><en>Safe metadata; null on failure.</en></lang>
 */
function normalizePacketMetadata(packetId, revision, diagnostics) {
  // <lang><zh-CN>两个 identifier 必须同时合格，防止 partial packet 伪装为可回滚 revision。</zh-CN><en>Both identifiers must be valid, preventing a partial packet from impersonating a rollback revision.</en></lang>
  if (typeof packetId !== "string" || !PACKET_ID_PATTERN.test(packetId) || typeof revision !== "string" || !REVISION_PATTERN.test(revision)) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_ID_INVALID");
    return null;
  }
  return Object.freeze({ id: packetId, revision });
}

/**
 * Validates and projects one W-P73 acceptance report.
 * 验证并投影一份 W-P73 acceptance report。
 *
 * @param {unknown} value <lang><zh-CN>caller-provided acceptance report。</zh-CN><en>Caller-provided acceptance report.</en></lang>
 * @param {Map<string, object>} diagnostics <lang><zh-CN>固定 diagnostic 收集器。</zh-CN><en>Fixed diagnostic collector.</en></lang>
 * @returns {{ target: { id: string, family: string }, summary: object } | null} <lang><zh-CN>安全 projection；失败为 null。</zh-CN><en>Safe projection; null on failure.</en></lang>
 */
function normalizeAcceptanceReport(value, diagnostics) {
  // <lang><zh-CN>record/exact-key guard 拒绝未经审查的扩展字段，特别是可能夹带 source/path 的 report clone。</zh-CN><en>The record/exact-key guard rejects unreviewed extension fields, especially a report clone that could carry source/path data.</en></lang>
  if (!isRecord(value) || !hasExactKeys(value, ["acceptance", "contract", "contractVersion", "diagnostics", "input", "privacy", "status", "target"])) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID");
    return null;
  }
  // <lang><zh-CN>contract 与 version 分开诊断，避免未知 future version 被当作当前 draft compatible。</zh-CN><en>Contract and version are diagnosed separately so an unknown future version is not treated as current-draft compatible.</en></lang>
  if (value.contract !== ACCEPTANCE_CONTRACT) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID");
  }
  if (value.contractVersion !== ACCEPTANCE_VERSION) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_VERSION_UNSUPPORTED");
  }
  // <lang><zh-CN>accepted report 不应携带 upstream error；任何其它 status/diagnostic 都会拒绝组合。</zh-CN><en>An accepted report must carry no upstream error; any other status/diagnostic refuses composition.</en></lang>
  if (value.status !== "accepted" || !Array.isArray(value.diagnostics) || value.diagnostics.length !== 0) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID");
  }
  // <lang><zh-CN>input 只确认 W-P73 已知 generated-evidence lineage，不复制其原始 evidence。</zh-CN><en>input only confirms the known W-P73 generated-evidence lineage and does not copy its raw evidence.</en></lang>
  if (!isRecord(value.input) || !hasExactKeys(value.input, ["contract", "contractVersion"]) || value.input.contract !== GENERATED_EVIDENCE_CONTRACT || value.input.contractVersion !== GENERATED_EVIDENCE_VERSION) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID");
  }
  // <lang><zh-CN>target projection 仅返回安全 stable id/family；无效值不进入 output。</zh-CN><en>The target projection returns only a safe stable id/family; invalid values do not enter output.</en></lang>
  const target = normalizeTarget(value.target, diagnostics);
  // <lang><zh-CN>acceptance subrecord 的所有 bool/count 必须已证明完备，不能将缺失归一为 success。</zh-CN><en>Every acceptance boolean/count must already prove completeness; absence is never normalized to success.</en></lang>
  const acceptance = isRecord(value.acceptance) ? value.acceptance : null;
  const acceptanceValid = acceptance !== null
    && hasExactKeys(acceptance, ["producerCompatibility", "requiredOutputs", "requiredPermissions", "stableEntryIdentity"])
    && validRequiredOutputs(acceptance.requiredOutputs)
    && validAcceptanceProducerCompatibility(acceptance.producerCompatibility)
    && validAcceptanceIdentity(acceptance.stableEntryIdentity)
    && validAcceptancePermissions(acceptance.requiredPermissions);
  if (!acceptanceValid) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID");
  }
  // <lang><zh-CN>privacy 违反有独立 code，以便 owner 清楚其不能以 warning 忽略。</zh-CN><en>A privacy violation has its own code so an owner knows it cannot be ignored as a warning.</en></lang>
  const privacy = isRecord(value.privacy) ? value.privacy : null;
  if (!validAcceptancePrivacy(privacy)) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_PRIVACY_PERMISSION_REFUSED");
  }
  if (!target || !acceptanceValid || !validAcceptancePrivacy(privacy) || value.contract !== ACCEPTANCE_CONTRACT || value.contractVersion !== ACCEPTANCE_VERSION || value.status !== "accepted" || !Array.isArray(value.diagnostics) || value.diagnostics.length !== 0) {
    return null;
  }

  // <lang><zh-CN>summary 从已验证 scalar 创建，绝不从 caller object spread，以免未来字段意外泄漏。</zh-CN><en>The summary is created from validated scalars, never a caller-object spread, preventing accidental future-field leakage.</en></lang>
  return Object.freeze({
    target,
    summary: Object.freeze({
      contract: ACCEPTANCE_CONTRACT,
      contractVersion: ACCEPTANCE_VERSION,
      status: "accepted",
      stableEntryIdentity: Object.freeze({
        entryCount: acceptance.stableEntryIdentity.entryCount,
        uniqueCount: acceptance.stableEntryIdentity.uniqueCount,
        duplicateCount: 0
      }),
      producerCompatibility: Object.freeze({
        producerCount: acceptance.producerCompatibility.producerCount,
        successfulProducerCount: acceptance.producerCompatibility.successfulProducerCount
      }),
      privacy: Object.freeze({
        sourcePresentation: "none",
        sourcesContentPolicy: "none",
        sourcesContentPresent: false,
        sourceBodyPresent: false,
        absolutePathLikeStringCount: 0
      }),
      permissions: Object.freeze({
        targetRepositoryWrite: false,
        sourceBodyRead: false,
        network: false
      })
    })
  });
}

/**
 * Validates and projects one W-P74 Unicode-compatible handoff report.
 * 验证并投影一份 W-P74 Unicode-compatible handoff report。
 *
 * @param {unknown} value <lang><zh-CN>caller-provided handoff report。</zh-CN><en>Caller-provided handoff report.</en></lang>
 * @param {Map<string, object>} diagnostics <lang><zh-CN>固定 diagnostic 收集器。</zh-CN><en>Fixed diagnostic collector.</en></lang>
 * @returns {{ target: { id: string, family: string }, summary: object } | null} <lang><zh-CN>安全 projection；失败为 null。</zh-CN><en>Safe projection; null on failure.</en></lang>
 */
function normalizeHandoffReport(value, diagnostics) {
  // <lang><zh-CN>W-P74 output 的字段集合固定；未知字段被拒绝，避免 source/path 被伪装为 report extension。</zh-CN><en>W-P74 output has a fixed field set; unknown fields are refused so source/path cannot masquerade as a report extension.</en></lang>
  if (!isRecord(value) || !hasExactKeys(value, ["artifacts", "contract", "contractVersion", "diagnostics", "entries", "permissions", "producer", "releaseIsolation", "sourceMaps", "status", "target"])) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
    return null;
  }
  if (value.contract !== HANDOFF_CONTRACT) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
  }
  if (value.contractVersion !== HANDOFF_VERSION) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_VERSION_UNSUPPORTED");
  }
  if (value.status !== "accepted" || !Array.isArray(value.diagnostics) || value.diagnostics.length !== 0) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
  }
  // <lang><zh-CN>target 与 producer 分别验证；producer 不可由 arbitrary label 替代 TSDoc owner。</zh-CN><en>target and producer are validated separately; an arbitrary label cannot replace the TSDoc owner.</en></lang>
  const target = normalizeTarget(value.target, diagnostics);
  const producer = normalizeHandoffProducer(value.producer, diagnostics);
  // <lang><zh-CN>entries/artifacts 在内存中交叉验证，但 output 只带 count/kind，不带 id。</zh-CN><en>entries/artifacts are cross-validated in memory, while output carries only count/kind and no ids.</en></lang>
  const artifactKinds = validateHandoffArtifacts(value.artifacts, diagnostics);
  const entryCount = validateHandoffEntries(value.entries, value.artifacts, diagnostics);
  // <lang><zh-CN>source map 与 release isolation 都是 explicit metadata，不接受 omission-as-safe。</zh-CN><en>source maps and release isolation are explicit metadata; omission-as-safe is not accepted.</en></lang>
  const sourceMaps = normalizeSourceMaps(value.sourceMaps, diagnostics);
  const releaseIsolation = normalizeReleaseIsolation(value.releaseIsolation, diagnostics);
  const permissionsValid = validHandoffPermissions(value.permissions);
  if (!permissionsValid) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_PRIVACY_PERMISSION_REFUSED");
  }
  if (!target || !producer || !artifactKinds || entryCount === null || !sourceMaps || !releaseIsolation || !permissionsValid || value.contract !== HANDOFF_CONTRACT || value.contractVersion !== HANDOFF_VERSION || value.status !== "accepted" || !Array.isArray(value.diagnostics) || value.diagnostics.length !== 0) {
    return null;
  }

  return Object.freeze({
    target,
    summary: Object.freeze({
      contract: HANDOFF_CONTRACT,
      contractVersion: HANDOFF_VERSION,
      status: "accepted",
      producer,
      entryCount,
      artifactKinds: Object.freeze([...artifactKinds]),
      sourceMaps,
      releaseIsolation,
      permissions: Object.freeze({
        targetRepositoryWrite: false,
        targetCommandExecuted: false,
        targetSourceBodyRead: false,
        targetArtifactBodyRead: false,
        networkAccessed: false,
        packagePublished: false
      })
    })
  });
}

/**
 * Normalizes a safe target projection and refuses malformed/other-family identities.
 * 规范化安全 target projection，并拒绝 malformed/other-family identity。
 *
 * @param {unknown} value <lang><zh-CN>候选 target record。</zh-CN><en>Candidate target record.</en></lang>
 * @param {Map<string, object>} diagnostics <lang><zh-CN>固定 diagnostic 收集器。</zh-CN><en>Fixed diagnostic collector.</en></lang>
 * @returns {{ id: string, family: string } | null} <lang><zh-CN>安全 target 或 null。</zh-CN><en>Safe target or null.</en></lang>
 */
function normalizeTarget(value, diagnostics) {
  if (!isRecord(value) || !hasExactKeys(value, ["family", "id"]) || typeof value.id !== "string" || !TARGET_ID_PATTERN.test(value.id) || value.family !== TARGET_FAMILY) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_TARGET_IDENTITY_MISMATCH");
    return null;
  }
  return Object.freeze({ id: value.id, family: TARGET_FAMILY });
}

/**
 * Compares two independently validated target projections.
 * 比较两个独立验证的 target projection。
 *
 * @param {{ id: string, family: string } | undefined} acceptanceTarget <lang><zh-CN>acceptance target projection。</zh-CN><en>Acceptance target projection.</en></lang>
 * @param {{ id: string, family: string } | undefined} handoffTarget <lang><zh-CN>handoff target projection。</zh-CN><en>Handoff target projection.</en></lang>
 * @param {Map<string, object>} diagnostics <lang><zh-CN>固定 diagnostic 收集器。</zh-CN><en>Fixed diagnostic collector.</en></lang>
 * @returns {{ id: string, family: string } | null} <lang><zh-CN>匹配的安全 target 或 null。</zh-CN><en>Matching safe target or null.</en></lang>
 */
function combineTargetIdentity(acceptanceTarget, handoffTarget, diagnostics) {
  if (!acceptanceTarget || !handoffTarget) {
    return null;
  }
  if (acceptanceTarget.id !== handoffTarget.id || acceptanceTarget.family !== handoffTarget.family) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_TARGET_IDENTITY_MISMATCH");
    return null;
  }
  return Object.freeze({ id: acceptanceTarget.id, family: TARGET_FAMILY });
}

/**
 * Normalizes the fixed TSDoc producer summary.
 * 规范化固定 TSDoc producer summary。
 */
function normalizeHandoffProducer(value, diagnostics) {
  if (!isRecord(value) || !hasExactKeys(value, ["id", "status", "version"]) || value.id !== TSDOC_PRODUCER_ID || value.status !== "success" || typeof value.version !== "string" || !VERSION_PATTERN.test(value.version)) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
    return null;
  }
  return Object.freeze({ id: TSDOC_PRODUCER_ID, version: value.version, status: "success" });
}

/**
 * Validates all W-P74 artifacts and returns the deterministic required kind sequence.
 * 验证所有 W-P74 artifact，并返回确定性的 required kind sequence。
 */
function validateHandoffArtifacts(value, diagnostics) {
  if (!Array.isArray(value) || value.length < REQUIRED_ARTIFACT_KINDS.length) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
    return null;
  }
  const ids = new Set();
  const kinds = new Set();
  for (const item of value) {
    if (!isRecord(item) || !hasExactKeys(item, ["id", "kind"]) || typeof item.id !== "string" || !REPORT_ID_PATTERN.test(item.id) || typeof item.kind !== "string" || !REQUIRED_ARTIFACT_KINDS.includes(item.kind) || ids.has(item.id)) {
      addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
      return null;
    }
    ids.add(item.id);
    kinds.add(item.kind);
  }
  if (REQUIRED_ARTIFACT_KINDS.some((kind) => !kinds.has(kind))) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
    return null;
  }
  return REQUIRED_ARTIFACT_KINDS;
}

/**
 * Validates W-P74 entry identities and their HIA/documentation-map relation without projecting ids.
 * 验证 W-P74 entry identity 与 HIA/documentation-map relation，但不投影 id。
 */
function validateHandoffEntries(value, artifacts, diagnostics) {
  if (!Array.isArray(value) || value.length === 0 || !Array.isArray(artifacts)) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
    return null;
  }
  const artifactKindsById = new Map(artifacts.filter(isRecord).map((artifact) => [artifact.id, artifact.kind]));
  const entryIds = new Set();
  for (const entry of value) {
    if (!isRecord(entry) || !hasExactKeys(entry, ["artifactIds", "id"]) || typeof entry.id !== "string" || !REPORT_ID_PATTERN.test(entry.id) || entryIds.has(entry.id) || !Array.isArray(entry.artifactIds) || entry.artifactIds.length < 2 || entry.artifactIds.some((artifactId) => typeof artifactId !== "string" || !REPORT_ID_PATTERN.test(artifactId))) {
      addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
      return null;
    }
    const entryKinds = entry.artifactIds.map((artifactId) => artifactKindsById.get(artifactId));
    if (!entryKinds.includes("hia-document") || !entryKinds.includes("doc-source-map")) {
      addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID");
      return null;
    }
    entryIds.add(entry.id);
  }
  return value.length;
}

/**
 * Validates the two source-map counts and the mandatory none policy.
 * 验证两个 source-map count 与 mandatory none policy。
 */
function normalizeSourceMaps(value, diagnostics) {
  if (!isRecord(value) || !hasExactKeys(value, ["documentationSourceMapCount", "ordinarySourceMapCount", "sourcesContentPolicy"]) || !isPositiveInteger(value.ordinarySourceMapCount) || !isPositiveInteger(value.documentationSourceMapCount) || value.sourcesContentPolicy !== "none") {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_PRIVACY_PERMISSION_REFUSED");
    return null;
  }
  return Object.freeze({
    ordinarySourceMapCount: value.ordinarySourceMapCount,
    documentationSourceMapCount: value.documentationSourceMapCount,
    sourcesContentPolicy: "none"
  });
}

/**
 * Validates tarball isolation and every explicit no-action boundary.
 * 验证 tarball isolation 与每个显式 no-action boundary。
 */
function normalizeReleaseIsolation(value, diagnostics) {
  if (!isRecord(value) || !hasExactKeys(value, ["consumerSurface", "localLink", "network", "sourceBodyRead", "targetRepositoryWrite"]) || value.consumerSurface !== "npm-tarball" || value.localLink !== false || value.targetRepositoryWrite !== false || value.sourceBodyRead !== false || value.network !== false) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_PRIVACY_PERMISSION_REFUSED");
    return null;
  }
  return Object.freeze({
    consumerSurface: "npm-tarball",
    localLink: false,
    targetRepositoryWrite: false,
    sourceBodyRead: false,
    network: false
  });
}

/** Validates W-P73's complete generated-output flags. / 验证 W-P73 的 complete generated-output flags。 */
function validRequiredOutputs(value) {
  return isRecord(value) && hasExactKeys(value, ["indexHtml", "manifest", "projectIndex"]) && value.indexHtml === true && value.manifest === true && value.projectIndex === true;
}

/** Validates W-P73's producer count/status summary. / 验证 W-P73 的 producer count/status summary。 */
function validAcceptanceProducerCompatibility(value) {
  return isRecord(value) && hasExactKeys(value, ["artifactCount", "producerCount", "successfulProducerCount"]) && isPositiveInteger(value.artifactCount) && isPositiveInteger(value.producerCount) && value.successfulProducerCount === value.producerCount;
}

/** Validates W-P73's count-only stable entry identity summary. / 验证 W-P73 的 count-only stable entry identity summary。 */
function validAcceptanceIdentity(value) {
  return isRecord(value) && hasExactKeys(value, ["duplicateCount", "entryCount", "uniqueCount"]) && isPositiveInteger(value.entryCount) && value.uniqueCount === value.entryCount && value.duplicateCount === 0;
}

/** Validates W-P73's declared no-action permissions. / 验证 W-P73 声明的 no-action permissions。 */
function validAcceptancePermissions(value) {
  return isRecord(value) && hasExactKeys(value, ["network", "sourceBodyRead", "targetRepositoryWrite"]) && value.targetRepositoryWrite === false && value.sourceBodyRead === false && value.network === false;
}

/** Validates W-P73's source/privacy summary. / 验证 W-P73 的 source/privacy summary。 */
function validAcceptancePrivacy(value) {
  return isRecord(value) && hasExactKeys(value, ["absolutePathLikeStringCount", "sourceBodyPresent", "sourcePresentation", "sourcesContentPolicy", "sourcesContentPresent"]) && value.sourcePresentation === "none" && value.sourcesContentPolicy === "none" && value.sourcesContentPresent === false && value.sourceBodyPresent === false && value.absolutePathLikeStringCount === 0;
}

/** Validates W-P74's declared no-action permissions. / 验证 W-P74 声明的 no-action permissions。 */
function validHandoffPermissions(value) {
  return isRecord(value) && hasExactKeys(value, ["networkAccessed", "packagePublished", "targetArtifactBodyRead", "targetCommandExecuted", "targetRepositoryWrite", "targetSourceBodyRead"]) && value.targetRepositoryWrite === false && value.targetCommandExecuted === false && value.targetSourceBodyRead === false && value.targetArtifactBodyRead === false && value.networkAccessed === false && value.packagePublished === false;
}

/**
 * Builds a refusal packet from fixed diagnostic metadata only.
 * 只从固定 diagnostic metadata 构建 refusal packet。
 */
function createRefusalPacket(diagnostics) {
  // <lang><zh-CN>未知异常仍得到 generic report-invalid code；不会把 Error message 或 caller data 写入输出。</zh-CN><en>An unknown failure still receives a generic report-invalid code; no Error message or caller data is written to output.</en></lang>
  if (diagnostics.size === 0) {
    addDiagnostic(diagnostics, "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID");
  }
  const orderedDiagnostics = sortDiagnostics(diagnostics);
  const reasonFamilies = refusalReasonFamilies(orderedDiagnostics);
  return freezePacket({
    contract: UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_CONTRACT,
    contractVersion: UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION,
    status: "refused",
    privacy: privacyBoundary(),
    permissions: permissionBoundary(),
    adoption: adoptionBoundary(),
    refusal: Object.freeze({
      inputReflected: false,
      targetIdentityReflected: false,
      reasonFamilies: Object.freeze(reasonFamilies)
    }),
    diagnostics: Object.freeze(orderedDiagnostics)
  });
}

/** Builds the fixed no-serialization privacy boundary. / 构建固定 no-serialization privacy boundary。 */
function privacyBoundary() {
  return Object.freeze({
    sourceBodySerialized: false,
    artifactBodySerialized: false,
    artifactPathSerialized: false,
    absolutePathSerialized: false,
    workingStateSerialized: false,
    credentialSerialized: false,
    sourceMapBodySerialized: false
  });
}

/** Builds the fixed no-action permission boundary. / 构建固定 no-action permission boundary。 */
function permissionBoundary() {
  return Object.freeze({
    localLink: false,
    targetRepositoryWrite: false,
    targetCommandExecuted: false,
    targetSourceBodyRead: false,
    targetArtifactBodyRead: false,
    networkAccessed: false,
    packagePublished: false
  });
}

/** Builds the fixed non-adoption boundary. / 构建固定 non-adoption boundary。 */
function adoptionBoundary() {
  return Object.freeze({
    handoffAuthority: "caller-provided-unverified",
    targetOwnerAction: "optional-owner-review",
    targetRunClaimed: false,
    targetAdoptionClaimed: false
  });
}

/** Adds one fixed bilingual diagnostic once. / 仅添加一次固定双语 diagnostic。 */
function addDiagnostic(diagnostics, code) {
  if (!diagnostics.has(code)) {
    diagnostics.set(code, diagnostic(code));
  }
}

/** Converts ordered diagnostic codes to a fixed public-safe refusal family set. / 将有序 diagnostic code 转成固定 public-safe refusal family set。 */
function refusalReasonFamilies(diagnostics) {
  const families = new Set();
  for (const item of diagnostics) {
    families.add(refusalFamilyForCode(item.code));
  }
  return REFUSAL_REASON_ORDER.filter((family) => families.has(family));
}

/** Maps a diagnostic code to its bounded refusal family. / 将 diagnostic code 映射到其有界 refusal family。 */
function refusalFamilyForCode(code) {
  if (code === "UNICODE_OWNER_PACKET_ID_INVALID") return "packet-id";
  if (code === "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID") return "acceptance-report";
  if (code === "UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID") return "handoff-report";
  if (code === "UNICODE_OWNER_PACKET_VERSION_UNSUPPORTED") return "version";
  if (code === "UNICODE_OWNER_PACKET_TARGET_IDENTITY_MISMATCH") return "target-identity";
  if (code === "UNICODE_OWNER_PACKET_PRIVACY_PERMISSION_REFUSED") return "privacy-permission";
  return "adoption-claim";
}

/** Sorts diagnostics by public contract order rather than discovery order. / 以 public contract order 而非 discovery order 排序 diagnostics。 */
function sortDiagnostics(diagnostics) {
  return [...diagnostics.values()].sort((left, right) => DIAGNOSTIC_ORDER.indexOf(left.code) - DIAGNOSTIC_ORDER.indexOf(right.code));
}

/** Creates a frozen bilingual message from a fixed code. / 从固定 code 创建 frozen bilingual message。 */
function diagnostic(code) {
  const messages = {
    UNICODE_OWNER_PACKET_ID_INVALID: ["packet id 与 revision 必须是安全且稳定的显式标识。", "packet id and revision must be safe, stable, and explicit identifiers."],
    UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID: ["acceptance report 必须是完整且已接受的公开安全 report。", "The acceptance report must be a complete, accepted, public-safe report."],
    UNICODE_OWNER_PACKET_HANDOFF_REPORT_INVALID: ["handoff report 必须是完整且已接受的 Unicode-compatible TSDoc report。", "The handoff report must be a complete, accepted Unicode-compatible TSDoc report."],
    UNICODE_OWNER_PACKET_VERSION_UNSUPPORTED: ["source report contract version 必须是本 packet 明确支持的 draft。", "A source report contract version must be an explicitly supported draft for this packet."],
    UNICODE_OWNER_PACKET_TARGET_IDENTITY_MISMATCH: ["两个 report 必须有相同且安全的 Unicode-compatible target identity。", "Both reports must have the same safe Unicode-compatible target identity."],
    UNICODE_OWNER_PACKET_PRIVACY_PERMISSION_REFUSED: ["source、path、local link、target action、network 或 publish 边界不满足 packet policy。", "A source, path, local-link, target-action, network, or publish boundary does not satisfy packet policy."],
    UNICODE_OWNER_PACKET_ADOPTION_CLAIM_REFUSED: ["packet 不接受 target run 或 adoption 的 caller claim。", "The packet does not accept a caller claim of a target run or adoption."]
  };
  const [zhCn, en] = messages[code] ?? messages.UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID;
  return Object.freeze({
    code,
    severity: "error",
    message: Object.freeze({ "zh-CN": zhCn, en })
  });
}

/** Deep-freezes the small packet graph so callers cannot mutate a validated report after return. / deep-freeze 小型 packet graph，避免 caller 在 return 后修改 validated report。 */
function freezePacket(value) {
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) Object.freeze(child);
    else if (isRecord(child)) Object.freeze(child);
  }
  return Object.freeze(value);
}

/** Checks exact object keys after lexical sorting. / lexical sorting 后检查 exact object key。 */
function hasExactKeys(value, expectedKeys) {
  const actualKeys = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index]);
}

/** Identifies a non-null plain record. / 识别 non-null plain record。 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Checks an integer count greater than zero. / 检查大于零的 integer count。 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}
