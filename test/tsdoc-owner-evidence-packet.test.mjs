/**
 * Synthetic tests for the Unicode-compatible owner-evidence packet boundary.
 * Unicode-compatible owner-evidence packet 边界的 synthetic 测试。
 *
 * The tests compose checked-in public-safe report fixtures or temporary HIA-owned copies only.
 * 测试只组合已提交的 public-safe report fixture 或临时 HIA-owned 副本。
 * They never discover, read, run, or write a target repository.
 * 它们绝不发现、读取、运行或写入 target repository。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_CONTRACT,
  UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION,
  createUnicodeCompatibleOwnerEvidencePacket
} from "../packages/tsdoc-runner/src/index.mjs";

/** Repository root is used only for local fixture and CLI resolution. / repository root 只用于本地 fixture 与 CLI 解析。 */
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Accepted W-P73-shaped report fixture remains metadata-only. / accepted W-P73-shaped report fixture 仍保持 metadata-only。 */
const acceptanceFixturePath = path.join(repositoryRoot, "fixtures", "unicode-owner-evidence-packet", "accepted.acceptance-report.json");
/** Accepted W-P74-shaped report fixture remains metadata-only. / accepted W-P74-shaped report fixture 仍保持 metadata-only。 */
const handoffFixturePath = path.join(repositoryRoot, "fixtures", "unicode-owner-evidence-packet", "accepted.handoff-report.json");
/** CLI is invoked by its repository-local path, requiring neither install nor a local link. / CLI 通过其 repository-local path 调用，不需要 install 或 local link。 */
const ownerPacketCliPath = path.join(repositoryRoot, "packages", "tsdoc-runner", "src", "owner-evidence-packet-cli.mjs");

describe("Unicode-compatible owner evidence packet", () => {
  it("creates a deterministic ready packet from two accepted public-safe reports", async () => {
    /** Each load returns fresh mutable fixture data for test isolation. / 每次 load 都返回新的可变 fixture data，以保持测试隔离。 */
    const { acceptanceReport, handoffReport } = await loadAcceptedReports();
    /** The pure evaluator receives report objects only and cannot perform target-side work. / pure evaluator 仅接收 report object，不能执行 target-side work。 */
    const report = createUnicodeCompatibleOwnerEvidencePacket({
      acceptanceReport,
      handoffReport,
      packetId: "unicode-owner-packet:consumer-r1",
      revision: "r1"
    });
    /** Serialization proves the packet is a count/policy projection rather than source/artifact transport. / serialization 证明 packet 是 count/policy projection，而非 source/artifact transport。 */
    const serialized = JSON.stringify(report);

    assert.equal(report.contract, UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_CONTRACT);
    assert.equal(report.contractVersion, UNICODE_COMPATIBLE_OWNER_EVIDENCE_PACKET_VERSION);
    assert.equal(report.status, "ready-for-owner-review");
    assert.deepEqual(report.packet, { id: "unicode-owner-packet:consumer-r1", revision: "r1" });
    assert.equal(report.compatibility.targetIdentityMatch, true);
    assert.equal(report.compatibility.entryIdentityCorrelation, "not-asserted");
    assert.equal(report.evidenceSemantics.resolution, "report-contract-validated");
    assert.equal(report.evidenceSemantics.confidence, "caller-provided-unverified");
    assert.equal(report.evidenceSemantics.provenance, "metadata-only-derived-projection");
    assert.equal(report.permissions.targetCommandExecuted, false);
    assert.equal(report.adoption.targetAdoptionClaimed, false);
    assert.doesNotMatch(serialized, /artifactIds|entry-generated-js|acceptance-report\.json/u);
  });

  it("fails closed without reflecting an unsafe packet identity or source-report content", async () => {
    /** Synthetic report copies stay inside the test process; the mutated strings are never treated as paths to read. / synthetic report copies 保持在 test process 内；变更字符串绝不作为 path 读取。 */
    const { acceptanceReport, handoffReport } = await loadAcceptedReports();
    /** Invalid metadata and an unknown report field simulate privacy-sensitive caller input. / invalid metadata 与未知 report field 模拟 privacy-sensitive caller input。 */
    acceptanceReport.unsafeCallerPath = "C:\\private\\target-source.ts";
    /** A claimed adoption must be refused instead of being promoted to evidence. / claimed adoption 必须被拒绝，不能升级为 evidence。 */
    const report = createUnicodeCompatibleOwnerEvidencePacket({
      acceptanceReport,
      handoffReport,
      packetId: "C:\\private\\packet",
      revision: "not-a-revision",
      targetAdoptionClaimed: true
    });
    /** Refusal serialization cannot echo the invalid identity, target identity, path, or caller field. / refusal serialization 不得回显 invalid identity、target identity、path 或 caller field。 */
    const serialized = JSON.stringify(report);

    assert.equal(report.status, "refused");
    assert.equal(report.refusal.inputReflected, false);
    assert.equal(report.refusal.targetIdentityReflected, false);
    assert.equal("packet" in report, false);
    assert.equal("target" in report, false);
    assert.ok(report.diagnostics.some((item) => item.code === "UNICODE_OWNER_PACKET_ID_INVALID"));
    assert.ok(report.diagnostics.some((item) => item.code === "UNICODE_OWNER_PACKET_ACCEPTANCE_REPORT_INVALID"));
    assert.ok(report.diagnostics.some((item) => item.code === "UNICODE_OWNER_PACKET_ADOPTION_CLAIM_REFUSED"));
    assert.doesNotMatch(serialized, /private|target-source|unicodeartjs-compatible-host/u);
  });

  it("refuses an unsupported report version without reflecting it", async () => {
    /** Independent fixture copies keep the one-version failure deterministic. / 独立 fixture copies 使单一 version failure 保持确定性。 */
    const { acceptanceReport, handoffReport } = await loadAcceptedReports();
    /** Version mismatch must not be accepted through loose SemVer interpretation. / version mismatch 不得通过 loose SemVer interpretation 被接受。 */
    acceptanceReport.contractVersion = "0.1.1-draft";
    /** The evaluator returns a fixed refusal rather than exposing altered values. / evaluator 返回固定 refusal，不暴露 altered value。 */
    const report = createUnicodeCompatibleOwnerEvidencePacket({
      acceptanceReport,
      handoffReport,
      packetId: "unicode-owner-packet:consumer-r2",
      revision: "r2"
    });
    /** Report JSON must not transport the substituted version or target identity. / report JSON 不得传输 substituted version 或 target identity。 */
    const serialized = JSON.stringify(report);

    assert.equal(report.status, "refused");
    assert.ok(report.diagnostics.some((item) => item.code === "UNICODE_OWNER_PACKET_VERSION_UNSUPPORTED"));
    assert.deepEqual(report.refusal.reasonFamilies, ["version"]);
    assert.doesNotMatch(serialized, /0\.1\.1-draft|unicodeartjs-compatible-host/u);
  });

  it("refuses a cross-report target mismatch without reflecting either identity", async () => {
    /** Fresh accepted reports isolate the identity policy from version/privacy validation. / fresh accepted report 使 identity policy 与 version/privacy validation 隔离。 */
    const { acceptanceReport, handoffReport } = await loadAcceptedReports();
    /** A separate safe-looking target id still cannot cross-report compose. / 即使 target id 看似安全，不同 report 间也不能 compose。 */
    handoffReport.target.id = "different-compatible-host";
    /** The evaluator refuses an identity mismatch after both reports independently validate. / 两份 report 分别验证后，evaluator 拒绝 identity mismatch。 */
    const report = createUnicodeCompatibleOwnerEvidencePacket({
      acceptanceReport,
      handoffReport,
      packetId: "unicode-owner-packet:consumer-r3",
      revision: "r3"
    });
    /** Neither original nor substituted target identity can cross the refusal boundary. / original 与 substituted target identity 都不得跨越 refusal boundary。 */
    const serialized = JSON.stringify(report);

    assert.equal(report.status, "refused");
    assert.ok(report.diagnostics.some((item) => item.code === "UNICODE_OWNER_PACKET_TARGET_IDENTITY_MISMATCH"));
    assert.deepEqual(report.refusal.reasonFamilies, ["target-identity"]);
    assert.doesNotMatch(serialized, /unicodeartjs-compatible-host|different-compatible-host/u);
  });

  it("refuses a declared privacy or permission boundary violation", async () => {
    /** Fresh accepted reports isolate no-action policy validation from identity validation. / fresh accepted report 使 no-action policy validation 与 identity validation 隔离。 */
    const { acceptanceReport, handoffReport } = await loadAcceptedReports();
    /** An explicit network capability models a policy claim only; this test performs no network request. / explicit network capability 只模拟 policy claim；本测试不执行 network request。 */
    handoffReport.permissions.networkAccessed = true;
    /** The evaluator produces a fixed privacy refusal without preserving the caller report. / evaluator 产生固定 privacy refusal，不保留 caller report。 */
    const report = createUnicodeCompatibleOwnerEvidencePacket({
      acceptanceReport,
      handoffReport,
      packetId: "unicode-owner-packet:consumer-r4",
      revision: "r4"
    });

    assert.equal(report.status, "refused");
    assert.ok(report.diagnostics.some((item) => item.code === "UNICODE_OWNER_PACKET_PRIVACY_PERMISSION_REFUSED"));
    assert.deepEqual(report.refusal.reasonFamilies, ["privacy-permission"]);
  });

  it("writes only an explicit safe-relative output in an HIA-owned temporary directory", async () => {
    /** Temporary directory belongs to this test and is removed unconditionally. / temporary directory 属于本测试，并无条件删除。 */
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "hia-tsdoc-owner-packet-"));
    /** Input and output names remain relative to the temporary invocation directory. / input 与 output 名称都相对于 temporary invocation directory。 */
    const acceptancePath = path.join(temporaryDirectory, "acceptance.json");
    const handoffPath = path.join(temporaryDirectory, "handoff.json");
    const outputPath = path.join(temporaryDirectory, "owner-packet.json");
    /** Fixture records contain reports only, never a target path or artifact/source body. / fixture record 只包含 report，不含 target path 或 artifact/source body。 */
    const { acceptanceReport, handoffReport } = await loadAcceptedReports();

    try {
      await writeFile(acceptancePath, `${JSON.stringify(acceptanceReport)}\n`, "utf8");
      await writeFile(handoffPath, `${JSON.stringify(handoffReport)}\n`, "utf8");
      /** Spawned CLI touches only explicit temporary JSON files and writes only its requested temporary output. / spawned CLI 只处理显式 temporary JSON file，并且只写入所请求的 temporary output。 */
      const execution = spawnSync(process.execPath, [ownerPacketCliPath, "--acceptance", "acceptance.json", "--handoff", "handoff.json", "--packet-id", "unicode-owner-packet:cli-r1", "--revision", "r1", "--out", "owner-packet.json"], {
        cwd: temporaryDirectory,
        encoding: "utf8"
      });
      /** The written packet is read from the same HIA-owned temporary directory only. / written packet 只从同一 HIA-owned temporary directory 读取。 */
      const report = JSON.parse(await readFile(outputPath, "utf8"));

      assert.equal(execution.status, 0, execution.stderr);
      assert.equal(report.status, "ready-for-owner-review");
      assert.equal(report.packet.id, "unicode-owner-packet:cli-r1");
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("rejects a traversal output option without creating a file outside the invocation directory", async () => {
    /** Temporary invocation directory isolates the CLI safety check from every repository. / temporary invocation directory 将 CLI safety check 与每个 repository 隔离。 */
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "hia-tsdoc-owner-packet-path-"));
    /** Fixture copies are written under the temporary cwd so the CLI sees only explicit relative inputs. / fixture copy 写入 temporary cwd，使 CLI 只看到显式 relative input。 */
    const { acceptanceReport, handoffReport } = await loadAcceptedReports();

    try {
      await writeFile(path.join(temporaryDirectory, "acceptance.json"), `${JSON.stringify(acceptanceReport)}\n`, "utf8");
      await writeFile(path.join(temporaryDirectory, "handoff.json"), `${JSON.stringify(handoffReport)}\n`, "utf8");
      /** Traversal is rejected before any output path resolves outside the cwd. / traversal 在任何 output path 解析到 cwd 外之前被拒绝。 */
      const execution = spawnSync(process.execPath, [ownerPacketCliPath, "--acceptance", "acceptance.json", "--handoff", "handoff.json", "--packet-id", "unicode-owner-packet:cli-r2", "--revision", "r2", "--out", "../outside.json"], {
        cwd: temporaryDirectory,
        encoding: "utf8"
      });

      assert.equal(execution.status, 1);
      assert.match(execution.stderr, /--out must be a safe relative path\./u);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

/**
 * Loads fresh deep copies of the two accepted public-safe report fixtures.
 * 加载两份 accepted public-safe report fixture 的全新深拷贝。
 *
 * @returns {Promise<{ acceptanceReport: object, handoffReport: object }>} <lang><zh-CN>独立可变 report pair。</zh-CN><en>Independent mutable report pair.</en></lang>
 */
async function loadAcceptedReports() {
  // <lang><zh-CN>两个 fixture 都是当前 repository 内的 synthetic contract output，不属于或不代表 target repository 状态。</zh-CN><en>Both fixtures are synthetic contract outputs in this repository; they neither belong to nor represent target-repository state.</en></lang>
  const [acceptanceText, handoffText] = await Promise.all([
    readFile(acceptanceFixturePath, "utf8"),
    readFile(handoffFixturePath, "utf8")
  ]);
  return {
    acceptanceReport: JSON.parse(acceptanceText),
    handoffReport: JSON.parse(handoffText)
  };
}
