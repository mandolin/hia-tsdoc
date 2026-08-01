#!/usr/bin/env node

/**
 * Explicit-file CLI for Unicode-compatible TSDoc handoff reports.
 * Unicode-compatible TSDoc 交接报告的显式文件 CLI。
 *
 * The command reads only a caller-selected JSON evidence file. It does not discover
 * target repositories, inspect source/artifact bodies, or execute target commands.
 * 命令只读取调用方指定的 JSON evidence 文件；绝不发现目标仓库、检查源码/产物正文或执行目标命令。
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  UNICODE_COMPATIBLE_TSDOC_HANDOFF_VERSION,
  evaluateUnicodeCompatibleTsDocHandoff
} from "./unicode-compatible-handoff.mjs";

/** The parsed CLI surface deliberately has no target discovery options. / 解析出的 CLI surface 特意没有 target discovery option。 */
const { values } = parseArgs({
  options: {
    evidence: { type: "string", short: "e" },
    help: { type: "boolean", short: "h" },
    out: { type: "string", short: "o" },
    version: { type: "boolean", short: "v" }
  },
  strict: true
});

/** Help is static and does not inspect the current workspace. / help 是静态的，不检查当前 workspace。 */
if (values.help) {
  process.stdout.write(`HIA TSDoc Unicode-compatible handoff ${UNICODE_COMPATIBLE_TSDOC_HANDOFF_VERSION}\n\nUsage:\n  hia-tsdoc-handoff --evidence <safe-relative-json> [--out <safe-relative-json>]\n\nThe command only evaluates explicit metadata-only evidence. It does not discover or run a target project.\n`);
  process.exit(0);
}

/** Version output is package-local metadata only. / version output 只包含 package-local 元数据。 */
if (values.version) {
  process.stdout.write(`${UNICODE_COMPATIBLE_TSDOC_HANDOFF_VERSION}\n`);
  process.exit(0);
}

try {
  /** Evidence path is constrained before the process reads any caller file. / 在进程读取调用方文件前约束 evidence path。 */
  const evidencePath = resolveSafeRelativePath(values.evidence, "--evidence");
  /** Evidence parsing is limited to one explicit JSON metadata file. / evidence parsing 限制为一个显式 JSON metadata file。 */
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  /** Evaluation is pure and cannot trigger a target command or source discovery. / evaluation 是纯函数，不会触发 target command 或 source discovery。 */
  const report = evaluateUnicodeCompatibleTsDocHandoff(evidence);
  /** Serialized report is the only output body produced by this command. / serialized report 是本命令唯一产生的 output body。 */
  const serialized = `${JSON.stringify(report, null, 2)}\n`;

  if (values.out) {
    /** Output path is caller-selected but must stay relative to the invocation directory. / output path 由调用方选择，但必须保持相对于 invocation directory。 */
    const outputPath = resolveSafeRelativePath(values.out, "--out");
    await writeFile(outputPath, serialized, "utf8");
  } else {
    process.stdout.write(serialized);
  }

  /** A refused report is a normal safety outcome and produces a nonzero process status. / refused report 是正常 safety outcome，产生 nonzero process status。 */
  process.exitCode = report.status === "accepted" ? 0 : 1;
} catch (error) {
  /** Failure reporting intentionally omits arbitrary JSON and filesystem content. / failure reporting 特意省略任意 JSON 与 filesystem 内容。 */
  const message = error instanceof Error ? error.message : "Unable to evaluate handoff evidence.";
  process.stderr.write(`TSDoc handoff failed: ${message}\n`);
  process.exitCode = 1;
}

/**
 * Resolves a safe path under the invocation directory without accepting traversal or URIs.
 * 在 invocation directory 下解析安全路径，不接受 traversal 或 URI。
 *
 * @param {unknown} value Candidate CLI path.
 * @param {string} optionName Option label for a public error.
 * @returns {string} Absolute path rooted at the current working directory.
 */
function resolveSafeRelativePath(value, optionName) {
  /** String normalization keeps the policy portable across Windows and POSIX shells. / string normalization 使 policy 跨 Windows/POSIX shell 可移植。 */
  const normalized = typeof value === "string" ? value.replaceAll("\\", "/") : "";
  /** Segment inspection happens before `path.resolve` to prevent caller escape. / 在 `path.resolve` 前检查 segment，以防调用方逃逸。 */
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
