/**
 * @file
 * @lang zh-CN 0.4泛型/数组/readonly包装的真实原生链与精确旧读回归。
 * @lang en Native-chain and exact legacy-reading regressions for 0.4 generic, array and readonly wrappers.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { extractTsDocProject } from "../packages/ts-doc-extractor/src/project.mjs";
import { readTsDocExtraction } from "../packages/tsdoc-spec/src/index.mjs";
import { tsDocToJsDocBridgeArtifact, readTsJsDocBridgeArtifact } from "../packages/ts-jsdoc-bridge/src/index.mjs";
import { tsDocToHiaDocument } from "../packages/ts-doc-adapter/src/index.mjs";
import { createTsDocProjectSourceMap } from "../packages/ts-to-js-doc-source-map/src/project.mjs";
import { runTsDocProject } from "../packages/tsdoc-runner/src/project.mjs";
/**
 * @lang zh-CN 创建独占类型夹具，版本由调用方精确选择。
 * @lang en Creates an owned type fixture with an exact caller-selected version.
 * @param {string} body <lang><zh-CN>源码文本。</zh-CN><en>Source text.</en></lang>
 * @returns {string} <lang><zh-CN>本次根。</zh-CN><en>Root for this case.</en></lang>
 */
function fixture(body) {
    const parent = fileURLToPath(new URL("../temp/", import.meta.url));
    fs.mkdirSync(parent, { recursive: true });
    const root = fs.mkdtempSync(path.join(parent, "wrapped-types-"));
    fs.writeFileSync(path.join(root, "index.ts"), body);
    return root;
}
test("0.4 preserves generic arguments, readonly operands and array elements", () => {
    const root = fixture('export type Wrapped = Readonly<{copies: readonly {from:string;to:string}[]}>;');
    const data = extractTsDocProject({ workspaceRoot: root, entrypoints: ["index.ts"], contractVersion: "0.4.0-draft" });
    assert.deepEqual(data.diagnostics, []);
    assert.strictEqual(readTsDocExtraction(data), data);
    const application = data.symbols.find(node => node.kind === "ts-type-application");
    assert.equal(application.metadata.typeExpression.targetName, "Readonly");
    assert.equal(data.symbols.find(node => node.parentId === application.id).metadata.typeExpression.argumentIndex, 0);
    assert.equal(data.symbols.filter(node => node.kind === "ts-array-type").length, 1);
    assert.equal(data.symbols.find(node => node.kind === "ts-type-operator").metadata.typeExpression.typeOperator, "readonly");
    assert(data.symbols.some(node => node.name === "from"));
    assert(data.symbols.some(node => node.name === "to"));
});
test("shadowed generic names stay lexical references and multiple arguments stay ordered", () => {
    const root = fixture('type Readonly<A,B> = A; export type Wrapped = Readonly<{first:string},{second:number}>;');
    const data = extractTsDocProject({ workspaceRoot: root, entrypoints: ["index.ts"], contractVersion: "0.4.0-draft" });
    assert.deepEqual(data.diagnostics, []);
    const application = data.symbols.find(node => node.kind === "ts-type-application");
    assert.equal(application.metadata.typeExpression.targetName, "Readonly");
    assert(!Object.hasOwn(application.metadata.typeExpression, "builtin"));
    assert.deepEqual(data.symbols.filter(node => node.parentId === application.id).map(node => node.metadata.typeExpression.argumentIndex), [0, 1]);
    assert(data.symbols.some(node => node.name === "second"));
});
test("exact 0.3 still refuses anonymous wrappers and 0.2 keeps its default tree", () => {
    const root = fixture('export type Wrapped = Readonly<{value:string}>;');
    const old = extractTsDocProject({ workspaceRoot: root, entrypoints: ["index.ts"], contractVersion: "0.3.0-draft" });
    assert(old.diagnostics.some(item => item.code === "TSDOC_TYPE_EXPRESSION_UNSUPPORTED"));
    assert.equal(extractTsDocProject({ workspaceRoot: root, entrypoints: ["index.ts"] }).contractVersion, "0.2.0-draft");
});
test("unimplemented tuple wrappers retain errors in 0.4", () => {
    const root = fixture('export type Wrapped = [{value:string}];');
    const data = extractTsDocProject({ workspaceRoot: root, entrypoints: ["index.ts"], contractVersion: "0.4.0-draft" });
    assert(data.diagnostics.some(item => item.code === "TSDOC_TYPE_EXPRESSION_UNSUPPORTED"));
});
test("readers reject wrong argument order, missing operands and forged wrapper fields", () => {
    const root = fixture('type Pair<A,B>=A; export type Wrapped = Pair<{a:string},readonly {b:string}[]>;');
    const data = extractTsDocProject({ workspaceRoot: root, entrypoints: ["index.ts"], contractVersion: "0.4.0-draft" });
    for (const change of ["argument", "element", "target", "readonly"]) {
        const invalid = structuredClone(data);
        const application = invalid.symbols.find(node => node.kind === "ts-type-application");
        if (change === "argument")
            invalid.symbols.filter(node => node.parentId === application.id)[1].metadata.typeExpression.argumentIndex = 0;
        if (change === "target")
            delete application.metadata.typeExpression.targetName;
        if (change === "readonly")
            invalid.symbols.find(node => node.kind === "ts-type-operator").metadata.typeExpression.typeOperator = "keyof";
        if (change === "element") {
            const array = invalid.symbols.find(node => node.kind === "ts-array-type");
            invalid.symbols = invalid.symbols.filter(node => node.parentId !== array.id);
        }
        assert.throws(() => readTsDocExtraction(invalid), undefined, change);
    }
});
test("0.4 runner, bridge, core and direct map preserve the selected model", async () => {
    const root = fixture('export type Wrapped = Readonly<{values: readonly {id:string}[]}>;');
    const result = await runTsDocProject({ workspaceRoot: root, outputDirectory: path.join(root, "out"), inputs: [{ kind: "typescript-project", paths: ["index.ts"] }], options: { extractionVersion: "0.4.0-draft" } });
    assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
    const extraction = JSON.parse(fs.readFileSync(path.join(root, "out/project.tsdoc.json"), "utf8"));
    const bridge = readTsJsDocBridgeArtifact(tsDocToJsDocBridgeArtifact(extraction));
    const core = tsDocToHiaDocument(extraction);
    const map = createTsDocProjectSourceMap(extraction, { jsDocBridgePath: "bridge.json" });
    assert.equal(bridge.contractVersion, "0.4.0-draft");
    for (const node of extraction.symbols.filter(node => node.metadata.typeExpression))
        assert.equal(core.symbols.find(item => item.id === node.id).kind, "typedef");
    assert.equal(map.entries.length, extraction.symbols.length);
    assert.equal(map.artifacts.find(item => item.kind === "bridge-artifact").contractRefs[0].contractVersion, "0.4.0-draft");
});
test("0.4 CLI selects the wrapper model and wrapper nodes count toward the node budget", () => {
    const root = fixture('export type Wrapped = Readonly<{value:string}>;');
    const cli = fileURLToPath(new URL("../packages/tsdoc-runner/src/cli.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [cli, "--project", "--extraction-version", "0.4.0-draft", "--workspace-root", root, "--out-dir", "cli", "index.ts"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "cli/project.tsdoc.json"), "utf8")).contractVersion, "0.4.0-draft");
    const large = fixture('export type Budget = ' + Array(10000).fill('Array<string>').join('|') + ';');
    assert.throws(() => extractTsDocProject({ workspaceRoot: large, entrypoints: ["index.ts"], contractVersion: "0.4.0-draft" }), /extraction failed/);
});
