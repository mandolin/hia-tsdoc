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
