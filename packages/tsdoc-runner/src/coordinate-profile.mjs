/**
 * @file
 * @lang zh-CN TypeScript 原生编译器同轮产物的独立无正文坐标侧载；只签发已证明的单一原始槽位。
 * @lang en Independent body-free coordinate sidecar for one native TypeScript compilation; signs only a proven single original slot.
 */
import { createHash } from "node:crypto";
import path from "node:path";

/** @lang zh-CN 与共享严格读取器一致的单件字节上限。 @lang en Per-artifact byte ceiling shared with the strict reader. */
const ARTIFACT_LIMIT = 16 * 1024 * 1024;
/** @lang zh-CN 与共享严格读取器一致的侧载字节上限。 @lang en Sidecar byte ceiling shared with the strict reader. */
const PROFILE_LIMIT = 2 * 1024 * 1024;
/** @lang zh-CN 新侧载身份的公开安全词法；文档条目 ID 不受此规则约束。 @lang en Public-safe syntax for new sidecar identities; documentation entry IDs are independent. */
const IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*(?![\s\S])/;
/** @lang zh-CN ECMA-426 映射 Base64 VLQ 字母表，仅用于保守判断原始槽位是否真正有段。 @lang en ECMA-426 mapping Base64 VLQ alphabet, used only to conservatively detect a real original-slot segment. */
const BASE64_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * @lang zh-CN 严格解码一份实际源码字节；保留原 BOM 对应的 U+FEFF 和 CRLF。
 * @lang en Strictly decode actual source bytes, preserving an existing BOM as U+FEFF and keeping CRLF.
 * @param {Uint8Array} sourceBytes <lang><zh-CN>获准读取的主源码原始字节。</zh-CN><en>Authorized primary-source bytes.</en></lang>
 * @returns {string} <lang><zh-CN>供提取和临时镜像编译共用的逻辑文本。</zh-CN><en>Logical text shared by extraction and staged compilation.</en></lang>
 * @throws {TypeError} <lang><zh-CN>超限或无效 UTF-8。</zh-CN><en>Oversized or malformed UTF-8.</en></lang>
 */
export function decodeCoordinateSource(sourceBytes) {
  if (!(sourceBytes instanceof Uint8Array) || sourceBytes.byteLength > ARTIFACT_LIMIT) {
    throw new TypeError("Coordinate source must be at most 16 MiB of bytes.");
  }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(sourceBytes);
}

/**
 * @lang zh-CN 将同一源码快照与最终双图实际字节绑定，不把暂存路径或正文写进结果。
 * @lang en Bind one source snapshot to actual final bytes of both maps without writing staged paths or source text.
 * @param {object} input <lang><zh-CN>严格编译已核原始槽位、最终双图和主输入快照。</zh-CN><en>Verified raw slot, final maps and primary-input snapshot from strict compilation.</en></lang>
 * @returns {object} <lang><zh-CN>`ordinary-source-map-coordinate-profile@0.1.0-draft` 侧载。</zh-CN><en>`ordinary-source-map-coordinate-profile@0.1.0-draft` sidecar.</en></lang>
 * @throws {TypeError} <lang><zh-CN>内容、身份、隐私或限额证据不完整。</zh-CN><en>Incomplete byte, identity, privacy or size evidence.</en></lang>
 */
export function createTypeScriptCoordinateProfile(input) {
  // <lang><zh-CN>只使用严格 runner 传来的同轮源码快照、最终双图和路径身份；未提供字段会在下面的门禁中拒绝。</zh-CN><en>Use only same-build source, final maps and path identities from the strict runner; missing fields fail the guards below.</en></lang>
  const { sourceBytes, sourceText, sourcePath, workspaceRoot, outputDirectory, sourceMapPath, ordinaryMap, ordinaryMapBytes, documentationMap, documentationMapBytes, inputIndex } = input;
  if (!Number.isSafeInteger(inputIndex) || inputIndex < 0) {
    throw new TypeError("Coordinate input index must be a nonnegative safe integer.");
  }
  // <lang><zh-CN>字节必须属于本次实际落盘 JSON；签名不能仅信内存对象或同名旧文件。</zh-CN><en>Bytes must be the actual JSON written in this run; never sign only an in-memory object or an old file with the same name.</en></lang>
  if (!(ordinaryMapBytes instanceof Uint8Array) || !(documentationMapBytes instanceof Uint8Array)
    || ordinaryMapBytes.byteLength > ARTIFACT_LIMIT || documentationMapBytes.byteLength > ARTIFACT_LIMIT
    || !Buffer.from(ordinaryMapBytes).equals(serializedJson(ordinaryMap))
    || !Buffer.from(documentationMapBytes).equals(serializedJson(documentationMap))) {
    throw new TypeError("Coordinate map bytes do not match this build.");
  }
  if (!(sourceBytes instanceof Uint8Array) || typeof sourceText !== "string"
    || decodeCoordinateSource(sourceBytes) !== sourceText) {
    throw new TypeError("Coordinate source text does not match its input bytes.");
  }
  // <lang><zh-CN>规范化普通图只保留一个已证明的镜像来源槽，不允许嵌入正文或外部定位符。</zh-CN><en>The normalized ordinary map retains only the proven snapshot slot, with no embedded body or external locator.</en></lang>
  // <lang><zh-CN>来源 URL 后面还会解析回文档源文件；单看非绝对形式不足以签发。</zh-CN><en>The source URL is later resolved back to the documented file; a relative spelling alone is insufficient to sign.</en></lang>
  const ordinarySource = ordinaryMap?.sources?.[0];
  if (ordinaryMap?.version !== 3 || !Array.isArray(ordinaryMap.sources) || ordinaryMap.sources.length !== 1
    || typeof ordinarySource !== "string" || !ordinarySource.trim()
    || path.posix.isAbsolute(ordinarySource) || path.win32.isAbsolute(ordinarySource)
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ordinarySource)
    || ordinaryMap.sourceRoot !== ""
    || !Array.isArray(ordinaryMap.sourcesContent) || ordinaryMap.sourcesContent.length !== 0
    || typeof ordinaryMap.mappings !== "string") {
    throw new TypeError("Coordinate ordinary source map has no supported body-free primary slot.");
  }
  // <lang><zh-CN>文档图的唯一主来源和普通地图声明必须同向指向本次生成工件。</zh-CN><en>The sole documentation source and ordinary-map declaration must point to this generated artifact together.</en></lang>
  // <lang><zh-CN>这三个身份必须分别一致，不能用地图路径或同名字符串替代 sourceId。</zh-CN><en>These three identities must align independently; a map path or similarly named string cannot replace sourceId.</en></lang>
  const sourceNode = documentationMap?.sources?.[0];
  const sourceMapNode = documentationMap?.sourceMaps?.[0];
  const sourceId = sourceNode?.id;
  if (documentationMap?.contract !== "doc-source-map" || documentationMap.contractVersion !== "1.1.0"
    || documentationMap.privacy?.sourcesContentPolicy !== "none"
    || !Array.isArray(documentationMap.sources) || documentationMap.sources.length !== 1
    || !Array.isArray(documentationMap.sourceMaps) || documentationMap.sourceMaps.length !== 1
    || !safeIdentity(documentationMap.id) || !safeIdentity(sourceId)
    || !safeIdentity(sourceMapNode?.id) || !safeIdentity(sourceMapNode?.mapsFrom)
    || sourceMapNode?.kind !== "ordinary-source-map"
    || sourceMapNode.sourcesContentPolicy !== "none"
    || !Array.isArray(sourceMapNode.mapsTo) || sourceMapNode.mapsTo.length !== 1 || sourceMapNode.mapsTo[0] !== sourceId
    || sourceNode.sourcesContentPolicy !== "none" || Object.hasOwn(sourceNode, "sourcesContent")
    || sourceNode.path !== sourcePath
    || !documentationMap.artifacts?.some((artifact) => artifact.id === sourceMapNode.mapsFrom)) {
    throw new TypeError("Coordinate documentation source map identities are not linked.");
  }
  // <lang><zh-CN>普通 map 的公开相对来源 URL 必须还原到文档来源的原工作区文件，不得残留临时镜像地址。</zh-CN><en>The ordinary map's public relative source URL must resolve to the original workspace file named by the documentation source, never the staged snapshot.</en></lang>
  // <lang><zh-CN>分别从地图目录和工作区根解析，比较的是实际目标而非未经解释的路径文本。</zh-CN><en>Resolve separately from the map directory and workspace root; compare targets rather than raw path strings.</en></lang>
  const ordinarySourceAbsolute = path.resolve(path.dirname(path.resolve(outputDirectory, sourceMapPath)), ordinarySource);
  const documentedSourceAbsolute = path.resolve(workspaceRoot, sourceNode.path);
  if (ordinarySourceAbsolute !== documentedSourceAbsolute) {
    throw new TypeError("Coordinate ordinary source map path does not resolve to the documented source.");
  }
  // <lang><zh-CN>TypeScript 7.0.2 的已实测 UTF-16 主槽只有在普通图存在段时签发；type-only 节点仍由逐引用查询判为未核。</zh-CN><en>Sign the measured TypeScript 7.0.2 UTF-16 primary slot only when the ordinary map has segments; per-reference querying still leaves type-only nodes unverified.</en></lang>
  // <lang><zh-CN>字节摘要与逻辑 UTF-16 摘要各管不同失配；原文不进入 sidecar。</zh-CN><en>Raw-byte and logical UTF-16 digests guard different mismatches; source text never enters the sidecar.</en></lang>
  const sourceSlots = !hasOriginalSlotMapping(ordinaryMap.mappings) ? [] : [{
    sectionIndex: null,
    sourceIndex: 0,
    sourceId,
    columnUnit: "utf16-code-unit",
    sourceRevision: `content-sha256:${createHash("sha256").update(sourceBytes).digest("hex")}`,
    sourceByteDigest: { algorithm: "sha256", value: sha256(sourceBytes) },
    sourceTextEncoding: "utf-8",
    sourceTextTransform: "none",
    sourceTextDigest: { representation: "decoded-utf16-code-units", algorithm: "sha256", value: sha256(Buffer.from(sourceText, "utf16le")) }
  }];
  // <lang><zh-CN>两个地图身份和摘要分开签入，消费端必须对本次提供的两份实际字节各自复核。</zh-CN><en>Record identities and digests of both maps separately so consumers must recheck each set of supplied actual bytes.</en></lang>
  const profile = {
    contract: "ordinary-source-map-coordinate-profile",
    contractVersion: "0.1.0-draft",
    id: `coordinate-profile:ts-js:input-${inputIndex + 1}`,
    ordinaryMap: { sourceMapId: sourceMapNode.id, artifactId: sourceMapNode.mapsFrom, digest: { algorithm: "sha256", value: sha256(ordinaryMapBytes) } },
    documentationMap: { id: documentationMap.id, contractVersion: "1.1.0", digest: { algorithm: "sha256", value: sha256(documentationMapBytes) } },
    sourceSlots,
    privacy: { sourcesContentPolicy: "none" }
  };
  if (serializedJson(profile).byteLength > PROFILE_LIMIT) throw new TypeError("Coordinate profile exceeds the 2 MiB reader limit.");
  return profile;
}

/**
 * @lang zh-CN 仅识别普通图中真实引用原始槽 0 的段；全为无来源段时不签发槽位，非法 VLQ 保守拒绝。
 * @lang en Recognize real segments referencing original slot zero; generated-only maps sign no slot and malformed VLQ is refused.
 * @param {string} mappings <lang><zh-CN>TypeScript 实际写出的普通映射编码。</zh-CN><en>Actual TypeScript ordinary mappings encoding.</en></lang>
 * @returns {boolean} <lang><zh-CN>至少一段明确引用唯一原始槽。</zh-CN><en>Whether at least one segment explicitly references the sole original slot.</en></lang>
 */
function hasOriginalSlotMapping(mappings) {
  // <lang><zh-CN>Source Map 来源索引是跨段增量；不等于零的最终序号都不能冒充唯一主槽。</zh-CN><en>Source Map source indices are delta encoded across segments; any resulting nonzero ordinal cannot stand in for the sole primary slot.</en></lang>
  let sourceIndex = 0;
  let found = false;
  for (const segment of mappings.split(/[;,]/)) {
    if (!segment) continue;
    // <lang><zh-CN>每个终止位收束一个 VLQ 字段；1 字段段只有生成位置，4/5 字段段才含来源槽。</zh-CN><en>Each terminal bit closes one VLQ field; one-field segments are generated-only while four/five fields carry an original slot.</en></lang>
    // <lang><zh-CN>每段重置字段累加器，但来源槽位序号必须跨段保留。</zh-CN><en>Reset field accumulation per segment while retaining the source ordinal across segments.</en></lang>
    const fields = [];
    let encoded = 0;
    let multiplier = 1;
    for (const character of segment) {
      // <lang><zh-CN>非法 Base64 字符与超出安全整数的 VLQ 一律拒绝，不能猜测段含义。</zh-CN><en>Reject invalid Base64 and unsafe VLQ integers rather than guessing segment meaning.</en></lang>
      const digit = BASE64_DIGITS.indexOf(character);
      if (digit < 0) throw new TypeError("Coordinate ordinary map contains invalid VLQ.");
      encoded += (digit & 31) * multiplier;
      if (!Number.isSafeInteger(encoded)) throw new TypeError("Coordinate ordinary map VLQ exceeds the safe integer range.");
      if (digit & 32) {
        multiplier *= 32;
        if (!Number.isSafeInteger(multiplier)) throw new TypeError("Coordinate ordinary map VLQ exceeds the safe integer range.");
      } else {
        fields.push(encoded % 2 === 1 ? -Math.floor(encoded / 2) : Math.floor(encoded / 2));
        encoded = 0;
        multiplier = 1;
      }
    }
    if (multiplier !== 1 || ![1, 4, 5].includes(fields.length)) {
      throw new TypeError("Coordinate ordinary map has an unsupported segment shape.");
    }
    if (fields.length > 1) {
      sourceIndex += fields[1];
      if (sourceIndex !== 0) throw new TypeError("Coordinate ordinary map segment points outside the primary source slot.");
      found = true;
    }
  }
  return found;
}

/** @lang zh-CN 侧载身份仅含公开安全 ASCII token。 @lang en Sidecar identities contain only public-safe ASCII tokens. */
function safeIdentity(value) { return typeof value === "string" && value.length <= 512 && IDENTITY_PATTERN.test(value); }
/** @lang zh-CN 与 runner 写盘使用相同缩进和尾随换行。 @lang en Match runner JSON indentation and trailing newline byte-for-byte. */
function serializedJson(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"); }
/** @lang zh-CN 返回 32 字节 SHA-256 摘要的 canonical Base64。 @lang en Return canonical Base64 of the 32-byte SHA-256 digest. */
function sha256(bytes) { return createHash("sha256").update(bytes).digest("base64"); }
