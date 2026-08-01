#!/usr/bin/env node

/**
 * Explicit-file CLI for Unicode-compatible owner evidence packets.
 * Unicode-compatible owner evidence packet 的显式文件 CLI。
 *
 * The command reads exactly two caller-selected report JSON files. It never discovers a target
 * repository, opens source/artifact/source-map bodies, executes a target command, or contacts a network service.
 * 本命令只读取两份 caller-selected report JSON 文件；绝不发现 target repository、打开 source/artifact/source-map
 * body、执行 target command 或访问 network service。
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION,
  createUnicodeCompatibleOwnerEvidencePacket
} from "./unicode-compatible-owner-evidence-packet.mjs";

/** The option set intentionally contains no target path, discovery, network, or publish switch. / option set 特意不包含 target path、discovery、network 或 publish switch。 */
const { values } = parseArgs({
  options: {
    acceptance: { type: "string", short: "a" },
    handoff: { type: "string", short: "h" },
    help: { type: "boolean" },
    out: { type: "string", short: "o" },
    "packet-id": { type: "string", short: "p" },
    revision: { type: "string", short: "r" },
    version: { type: "boolean", short: "v" }
  },
  strict: true
});

/** Help is static and does not inspect the caller workspace. / help 是静态的，不检查 caller workspace。 */
if (values.help) {
  process.stdout.write(`HIA TSDoc Unicode-compatible owner packet ${UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION}\n\nUsage:\n  hia-tsdoc-owner-packet --acceptance <safe-relative-json> --handoff <safe-relative-json> --packet-id <id> --revision <rN> [--out <safe-relative-json>]\n\nThe command only evaluates two explicit public-safe reports. It does not discover or run a target project.\n`);
  process.exit(0);
}

/** Version output is package-local metadata only. / version output 只包含 package-local metadata。 */
if (values.version) {
  process.stdout.write(`${UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION}\n`);
  process.exit(0);
}

try {
  // <lang><zh-CN>在读取前先限制两个 input path，禁止 caller 以 traversal、URI 或 absolute path 扩大读取范围。</zh-CN><en>Constrain both input paths before reading so traversal, URIs, and absolute paths cannot expand the caller read scope.</en></lang>
  const acceptancePath = resolveSafeRelativePath(values.acceptance, "--acceptance");
  const handoffPath = resolveSafeRelativePath(values.handoff, "--handoff");
  // <lang><zh-CN>每份 report 都是唯一 filesystem input；不会从 report value 继续发现目录、manifest 或 target state。</zh-CN><en>Each report is the sole filesystem input; no directory, manifest, or target state is discovered from a report value.</en></lang>
  const acceptanceReport = await readReportJson(acceptancePath);
  const handoffReport = await readReportJson(handoffPath);
  // <lang><zh-CN>pure evaluator 只获得已解析 object 与 scalar CLI metadata；它无法执行 target action。</zh-CN><en>The pure evaluator receives parsed objects and scalar CLI metadata only; it cannot execute a target action.</en></lang>
  const report = createUnicodeCompatibleOwnerEvidencePacket({
    acceptanceReport,
    handoffReport,
    packetId: values["packet-id"],
    revision: values.revision
  });
  // <lang><zh-CN>serialized output 是唯一 output body；report 从不复制输入 path 或 report body。</zh-CN><en>The serialized report is the only output body; it never copies input paths or report bodies.</en></lang>
  const serialized = `${JSON.stringify(report, null, 2)}\n`;

  if (values.out) {
    // <lang><zh-CN>只有 caller 显式给出 safe-relative out 时才写文件；默认 stdout 保持无写入。</zh-CN><en>Write a file only when the caller explicitly gives a safe-relative out; stdout remains no-write by default.</en></lang>
    const outputPath = resolveSafeRelativePath(values.out, "--out");
    await writeFile(outputPath, serialized, "utf8");
  } else {
    process.stdout.write(serialized);
  }

  // <lang><zh-CN>refused 是正常 fail-closed safety outcome，而不是允许重试 source discovery 的错误。</zh-CN><en>refused is a normal fail-closed safety outcome, not an error that permits source-discovery retry.</en></lang>
  process.exitCode = report.status === "ready-for-owner-review" ? 0 : 1;
} catch (error) {
  // <lang><zh-CN>CLI error 不回显 JSON、路径或 filesystem detail，保持 output public-safe。</zh-CN><en>CLI errors do not echo JSON, paths, or filesystem detail, keeping output public-safe.</en></lang>
  process.stderr.write(`TSDoc owner packet failed: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
}

/**
 * Resolves one safe path under the invocation directory without permitting escape or URI forms.
 * 在 invocation directory 下解析一个安全路径，不允许 escape 或 URI form。
 *
 * @param {unknown} value <lang><zh-CN>候选 CLI path。</zh-CN><en>Candidate CLI path.</en></lang>
 * @param {string} optionName <lang><zh-CN>public-safe option label。</zh-CN><en>Public-safe option label.</en></lang>
 * @returns {string} <lang><zh-CN>current working directory 下的绝对读取/写入路径。</zh-CN><en>Absolute read/write path under the current working directory.</en></lang>
 */
function resolveSafeRelativePath(value, optionName) {
  // <lang><zh-CN>separator normalization 使 Windows/POSIX path 都经过相同的 segment policy。</zh-CN><en>Separator normalization applies the same segment policy to Windows/POSIX paths.</en></lang>
  const normalized = typeof value === "string" ? value.replaceAll("\\", "/") : "";
  // <lang><zh-CN>segment scan 在 path.resolve 前执行，防止 parent traversal 被绝对化后掩盖。</zh-CN><en>The segment scan happens before path.resolve so parent traversal cannot be hidden by absolutization.</en></lang>
  const segments = normalized.split("/");
  if (!normalized
    || normalized.startsWith("/")
    || normalized.startsWith("\\")
    || /^[A-Za-z]:/u.test(normalized)
    || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(normalized)
    || segments.includes("..")
    || segments.some((segment) => segment.length === 0)) {
    throw new TypeError(`${optionName} must be a safe relative path.`);
  }
  return path.resolve(process.cwd(), normalized);
}

/**
 * Reads one explicit JSON report while hiding parser/filesystem detail from the CLI surface.
 * 读取一份显式 JSON report，同时从 CLI surface 隐藏 parser/filesystem detail。
 *
 * @param {string} filePath <lang><zh-CN>已验证的 caller-selected path。</zh-CN><en>Validated caller-selected path.</en></lang>
 * @returns {Promise<unknown>} <lang><zh-CN>已解析 JSON value。</zh-CN><en>Parsed JSON value.</en></lang>
 */
async function readReportJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    throw new TypeError("A selected report must be a readable JSON object.");
  }
}

/**
 * Converts unexpected errors to a fixed public-safe CLI message.
 * 将 unexpected error 转为固定 public-safe CLI message。
 *
 * @param {unknown} error <lang><zh-CN>捕获到的错误。</zh-CN><en>Caught error.</en></lang>
 * @returns {string} <lang><zh-CN>不含 path/JSON 内容的错误文本。</zh-CN><en>Error text without paths/JSON content.</en></lang>
 */
function safeErrorMessage(error) {
  if (error instanceof TypeError && error.message.startsWith("--")) {
    return error.message;
  }
  return "Unable to evaluate explicit owner packet reports.";
}
