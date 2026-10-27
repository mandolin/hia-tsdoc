/**
 * @file
 * @lang zh-CN TypeScript 导出声明的源码终点回归；验证单行闭合和跨行类型/签名不会吞入相邻声明。
 * @lang en Source-end regressions for exported TypeScript declarations, covering one-line closures and multiline types/signatures without consuming adjacent declarations.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { extractTsDoc } from "../packages/ts-doc-extractor/src/index.mjs";

/**
 * @lang zh-CN 按稳定符号 ID 读取源码范围，避免测试将声明顺序误当作契约。
 * @lang en Reads a source range by stable symbol ID rather than treating declaration order as a contract.
 * @param {string} source <lang><zh-CN>公开合成 TypeScript 源码。</zh-CN><en>Public synthetic TypeScript source.</en></lang>
 * @param {string} id <lang><zh-CN>待核对的导出符号 ID。</zh-CN><en>ID of the exported symbol under inspection.</en></lang>
 * @returns {{start:{line:number,column:number},end:{line:number,column:number}}} <lang><zh-CN>声明扫描器给出的行列范围。</zh-CN><en>Line-column range emitted by the declaration scanner.</en></lang>
 */
function rangeOf(source, id) {
  // <lang><zh-CN>使用固定的安全相对路径，只观察提取边界而不写入工件。</zh-CN><en>Use a fixed safe relative path and inspect extraction boundaries without writing artifacts.</en></lang>
  const artifact = extractTsDoc(source, { path: "fixtures/range-probe.ts" });
  const symbol = artifact.symbols.find((item) => item.id === id);
  assert.ok(symbol, `Expected ${id}`);
  return symbol.source.range;
}

/** @lang zh-CN 单行已闭合的函数不得把下一行声明算入范围。 @lang en A balanced one-line function must not consume the next declaration line. */
test("ends a one-line function before its next declaration", () => {
  const source = "export function one(): number { return 1; }\r\nexport function two(): number { return 2; }\r\n";
  assert.deepEqual(rangeOf(source, "function:one"), {
    start: { line: 1, column: 1 },
    end: { line: 1, column: source.split("\r\n")[0].length + 1 }
  });
  assert.deepEqual(rangeOf(source, "function:two"), {
    start: { line: 2, column: 1 },
    end: { line: 2, column: source.split("\r\n")[1].length + 1 }
  });
});

/** @lang zh-CN 参数默认对象与跨行返回类型不能提前终止函数体定位。 @lang en Object defaults and multiline return types must not end the function before its body closes. */
test("keeps a multiline function signature and body together", () => {
  const source = [
    "export function build(",
    "  options: { enabled: boolean } = {}",
    "): { ready: boolean } {",
    "  return { ready: options.enabled };",
    "}",
    "export function next(): void {}"
  ].join("\n");
  assert.deepEqual(rangeOf(source, "function:build"), {
    start: { line: 1, column: 1 }, end: { line: 5, column: 2 }
  });
  assert.deepEqual(rangeOf(source, "function:next"), {
    start: { line: 6, column: 1 }, end: { line: 6, column: 32 }
  });
});

/** @lang zh-CN 联合类型成员的对象大括号并非类型别名终点，应持续到顶层分号。 @lang en Braces in union members are not the type alias end; scanning continues through the top-level semicolon. */
test("ends a multiline type alias at its top-level semicolon", () => {
  const source = [
    "export type Message =",
    "  | { kind: 'ready' }",
    "  | { kind: 'done' };",
    "export interface Next { value: string; }"
  ].join("\n");
  assert.deepEqual(rangeOf(source, "type:Message"), {
    start: { line: 1, column: 1 }, end: { line: 3, column: source.split("\n")[2].length + 1 }
  });
  assert.deepEqual(rangeOf(source, "interface:Next"), {
    start: { line: 4, column: 1 }, end: { line: 4, column: 41 }
  });
});

/** @lang zh-CN 无分号类型别名遇到空行和下一个导出时，保留最后一行实质内容作为终点。 @lang en An alias without a semicolon ends at its last content line before blank lines and the next export. */
test("does not include blank lines or the next export for an unterminated alias", () => {
  const source = "export type Name =\n  string\n\nexport function next(): void {}";
  assert.deepEqual(rangeOf(source, "type:Name"), {
    start: { line: 1, column: 1 }, end: { line: 2, column: 9 }
  });
});

/** @lang zh-CN 同行不同名运行时声明分别保留完整身份和不重叠的 UTF-16 范围。 @lang en Distinct same-line runtime declarations retain separate identities and nonoverlapping UTF-16 ranges. */
test("extracts two same-line exported functions without swallowing the second", () => {
  const source = "export function one(): number { return 1; } export function two(): number { return 2; }";
  const artifact = extractTsDoc(source, { path: "fixtures/range-probe.ts" });
  assert.deepEqual(artifact.symbols.map((symbol) => symbol.id), ["function:one", "function:two"]);
  assert.deepEqual(rangeOf(source, "function:one"), {
    start: { line: 1, column: 1 }, end: { line: 1, column: source.indexOf("} export") + 2 }
  });
  assert.deepEqual(rangeOf(source, "function:two"), {
    start: { line: 1, column: source.indexOf("export function two") + 1 },
    end: { line: 1, column: source.length + 1 }
  });
});

/** @lang zh-CN 类型与运行时混排仍逐声明提取，类型不得伪造运行时产物。 @lang en Mixed type and runtime declarations are extracted separately without inventing type runtime output. */
test("extracts distinct same-line types and mixed declarations", () => {
  const types = "export type One = string; export type Two = number;";
  const mixed = "export interface Shape { x: number } export class Box {} export function make(): void {}";
  assert.deepEqual(extractTsDoc(types).symbols.map((symbol) => symbol.id), ["type:One", "type:Two"]);
  assert.deepEqual(rangeOf(types, "type:One").end, { line: 1, column: types.indexOf(";") + 2 });
  const artifact = extractTsDoc(mixed);
  assert.deepEqual(artifact.symbols.map((symbol) => symbol.id), ["interface:Shape", "class:Box", "function:make"]);
  assert.equal(artifact.symbols[0].runtime.emitted, false);
  assert.ok(artifact.symbols[0].source.range.end.column <= artifact.symbols[1].source.range.start.column);
  assert.ok(artifact.symbols[1].source.range.end.column <= artifact.symbols[2].source.range.start.column);
});

/** @lang zh-CN 字符串、模板、注释和嵌套体内的 export 不应产生虚假顶层符号。 @lang en Exports inside strings, templates, comments, and nested bodies must not fabricate top-level symbols. */
test("ignores export text outside top-level code", () => {
  const source = [
    "const quoted = 'export function fakeOne() {}';",
    "const doubleQuoted = \"export type FakeTwo = string;\";",
    "const template = `export interface FakeThree {}`;",
    "const pattern = /export function fakeRegex()/;",
    "if (true) /export function fakeConditional()/;",
    "/* export class FakeFour {} */",
    "// export function fakeFive() {}",
    "export function real(): void { const nested = 'export type FakeSix = number;'; }"
  ].join("\n");
  assert.deepEqual(extractTsDoc(source).symbols.map((symbol) => symbol.id), ["function:real"]);
});

/** @lang zh-CN 非 BMP 前缀占两个 UTF-16 单位，CRLF 不增加列宽；首个 TSDoc 不可复制到同行下一项。 @lang en A non-BMP prefix occupies two UTF-16 units while CRLF does not widen columns; the first TSDoc cannot attach to the next same-line item. */
test("keeps UTF-16 positions and same-line comment ownership", () => {
  const line = "/*😀*/ export function one(): void {} /** Second. */ export function two(): void {}";
  const artifact = extractTsDoc(`/** First. */\r\n${line}`, { path: "fixtures/range-probe.ts" });
  assert.deepEqual(artifact.symbols.map((symbol) => symbol.id), ["function:one", "function:two"]);
  assert.equal(artifact.symbols[0].source.range.start.column, line.indexOf("export function one") + 1);
  assert.equal(artifact.symbols[1].source.range.start.column, line.indexOf("export function two") + 1);
  assert.notEqual(artifact.symbols[0].comment?.summary, artifact.symbols[1].comment?.summary);
  assert.equal(artifact.symbols[1].comment?.summary, "Second.");
});
