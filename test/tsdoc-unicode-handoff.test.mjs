/**
 * Synthetic tests for the Unicode-compatible handoff boundary.
 * Unicode-compatible handoff 边界的 synthetic 测试。
 *
 * The tests create only temporary HIA-owned evidence/report files. They never access a target repository.
 * 测试只创建临时 HIA-owned evidence/report 文件；绝不访问目标仓库。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  UNICODE_COMPATIBLE_TSDOC_HANDOFF_CONTRACT,
  evaluateUnicodeCompatibleTsDocHandoff
} from "../packages/tsdoc-runner/src/index.mjs";

/** Repository root derives fixture and CLI locations without consulting another repository. / repository root 只用于推导 fixture/CLI 位置，不咨询其他仓库。 */
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Fixture path is a checked-in metadata-only contract example. / fixture path 是已提交的 metadata-only contract 示例。 */
const acceptedFixturePath = path.join(repositoryRoot, "fixtures", "unicode-compatible-handoff", "accepted.handoff.json");
/** Handoff CLI path is invoked directly so the test needs no package installation or local link. / handoff CLI 直接调用，因此测试不需要 package installation 或 local link。 */
const handoffCliPath = path.join(repositoryRoot, "packages", "tsdoc-runner", "src", "handoff-cli.mjs");

describe("Unicode-compatible TSDoc handoff", () => {
  it("accepts metadata-only evidence and omits caller artifact paths", async () => {
    /** Fixture data remains synthetic and deliberately lacks source/artifact bodies. / fixture data 保持 synthetic，且特意没有 source/artifact body。 */
    const evidence = await loadAcceptedFixture();
    /** Pure evaluation creates no file, target command, network request, or source read. / pure evaluation 不创建文件、target command、network request 或 source read。 */
    const report = evaluateUnicodeCompatibleTsDocHandoff(evidence);
    /** Serialized output is checked to prove raw artifact paths do not cross the report boundary. / 检查 serialized output，证明 raw artifact path 不跨越报告边界。 */
    const serialized = JSON.stringify(report);

    assert.equal(report.contract, UNICODE_COMPATIBLE_TSDOC_HANDOFF_CONTRACT);
    assert.equal(report.status, "accepted");
    assert.equal(report.permissions.targetRepositoryWrite, false);
    assert.equal(report.permissions.targetSourceBodyRead, false);
    assert.equal(report.permissions.networkAccessed, false);
    assert.doesNotMatch(serialized, /api\/entry\.js/u);
  });

  it("refuses embedded source policy and unsafe artifact-path metadata", async () => {
    /** Fixture cloning lets each refusal test remain independent and deterministic. / fixture cloning 让每个 refusal test 保持独立和确定。 */
    const evidence = await loadAcceptedFixture();
    /** Policy mutation simulates a caller declaration only; it does not create source content. / policy mutation 只模拟 caller declaration，不创建 source content。 */
    evidence.sourceMapEvidence.ordinary[0].sourcesContentPolicy = "embed";
    /** Path mutation proves that an unsafe locator is denied and not reflected in output. / path mutation 证明 unsafe locator 被拒绝且不在 output 中反射。 */
    evidence.producerResult.artifacts[0].path = "C:\\private\\entry.js";
    /** Evaluation produces a complete refusal report instead of throwing. / evaluation 产生完整 refusal report，而非抛出。 */
    const report = evaluateUnicodeCompatibleTsDocHandoff(evidence);
    /** Output serialization verifies that the absolute-like caller path is not leaked. / output serialization 验证 absolute-like caller path 不泄漏。 */
    const serialized = JSON.stringify(report);

    assert.equal(report.status, "refused");
    assert.ok(report.diagnostics.some((item) => item.code === "TSDOC_UNICODE_HANDOFF_SOURCE_POLICY_REFUSED"));
    assert.ok(report.diagnostics.some((item) => item.code === "TSDOC_UNICODE_HANDOFF_UNSAFE_ARTIFACT_PATH"));
    assert.doesNotMatch(serialized, /private/u);
  });

  it("refuses duplicate stable entries and a target-side release capability", async () => {
    /** Fixture cloning keeps the accepted baseline available to later tests. / fixture cloning 保持 accepted baseline 可供后续测试使用。 */
    const evidence = await loadAcceptedFixture();
    /** Duplicate entry models identity ambiguity without consulting an HIA document body. / duplicate entry 在不查阅 HIA document body 情况下模拟 identity ambiguity。 */
    evidence.documentationEntries.push({ ...evidence.documentationEntries[0] });
    /** Target write flag models a declared boundary violation rather than performing one. / target write flag 模拟已声明 boundary violation，而不是执行它。 */
    evidence.releaseIsolation.targetRepositoryWrite = true;
    /** Pure evaluation leaves the target boundary untouched. / pure evaluation 保持 target boundary 不变。 */
    const report = evaluateUnicodeCompatibleTsDocHandoff(evidence);

    assert.equal(report.status, "refused");
    assert.ok(report.diagnostics.some((item) => item.code === "TSDOC_UNICODE_HANDOFF_DUPLICATE_ENTRY_ID"));
    assert.ok(report.diagnostics.some((item) => item.code === "TSDOC_UNICODE_HANDOFF_RELEASE_BOUNDARY_REFUSED"));
  });

  it("refuses omitted release-boundary booleans instead of inferring a safe default", async () => {
    /** Fixture cloning yields a valid producer/report baseline before one required boundary proof is omitted. / fixture cloning 在省略一项必需 boundary proof 前提供有效 producer/report baseline。 */
    const evidence = await loadAcceptedFixture();
    /** Omission models incomplete metadata only; no target capability is performed. / omission 只模拟不完整 metadata；不执行 target capability。 */
    delete evidence.releaseIsolation.network;
    /** Pure evaluation must mark the unproven boundary as refused. / pure evaluation 必须把未证明的 boundary 标记为 refused。 */
    const report = evaluateUnicodeCompatibleTsDocHandoff(evidence);

    assert.equal(report.status, "refused");
    assert.equal(report.releaseIsolation.network, "unknown");
    assert.ok(report.diagnostics.some((item) => item.code === "TSDOC_UNICODE_HANDOFF_RELEASE_BOUNDARY_REFUSED"));
  });

  it("writes an accepted report only to an explicit temporary safe-relative output path", async () => {
    /** Temporary directory belongs solely to this HIA-owned test and is removed in finally. / temporary directory 仅属于此 HIA-owned test，并在 finally 中删除。 */
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "hia-tsdoc-handoff-"));
    /** Evidence file is written inside the temporary directory, never into a target. / evidence file 写入 temporary directory 内，绝不写入 target。 */
    const evidencePath = path.join(temporaryDirectory, "evidence.json");
    /** Output path is a safe-relative CLI destination under the same temporary cwd. / output path 是同一 temporary cwd 下的 safe-relative CLI destination。 */
    const outputPath = path.join(temporaryDirectory, "report.json");
    /** Fixture content remains metadata-only when passed to the CLI. / fixture content 传给 CLI 时仍保持 metadata-only。 */
    const evidence = await loadAcceptedFixture();

    try {
      await writeFile(evidencePath, `${JSON.stringify(evidence)}\n`, "utf8");
      /** Spawned process invokes only the HIA CLI against its explicit temporary evidence file. / spawned process 只针对显式 temporary evidence file 调用 HIA CLI。 */
      const execution = spawnSync(process.execPath, [handoffCliPath, "--evidence", "evidence.json", "--out", "report.json"], {
        cwd: temporaryDirectory,
        encoding: "utf8"
      });
      /** Report body is read back only from the HIA-owned temporary output. / report body 只从 HIA-owned temporary output 读回。 */
      const report = JSON.parse(await readFile(outputPath, "utf8"));

      assert.equal(execution.status, 0, execution.stderr);
      assert.equal(report.status, "accepted");
      assert.equal(report.permissions.targetArtifactBodyRead, false);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

/**
 * Loads a fresh deep copy of the accepted metadata-only fixture for each test.
 * 为每个测试加载 accepted metadata-only fixture 的全新深拷贝。
 *
 * @returns {Promise<object>} Mutable synthetic evidence record.
 */
async function loadAcceptedFixture() {
  /** JSON text is local fixture metadata, not target source or an artifact body. / JSON text 是本地 fixture metadata，不是 target source 或 artifact body。 */
  const text = await readFile(acceptedFixturePath, "utf8");
  return JSON.parse(text);
}
