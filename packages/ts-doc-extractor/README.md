# TSDoc Extractor

Extracts TypeScript/TSDoc documentation artifacts from TypeScript source.

The default `extractTsDoc()` entry retains the legacy single-file scanner:

- runtime function/class declarations
- type-only interface/type alias declarations
- TSDoc parser diagnostics
- fixture source ranges using a conservative declaration scanner
- distinct-name top-level exported declarations on the same physical line, with separate UTF-16 ranges and adjacent TSDoc ownership

The scanner is limited to the supported declaration kinds above. It does not resolve same-name overloads or declaration merging, and it is not a complete TypeScript syntax parser. A declaration-range fallback in the documentation source map retains an unknown end boundary even when its extracted range stops before the next declaration.

## Project extraction (unreleased draft)

The opt-in `@hia-doc/ts-doc-extractor/project` entry uses the pinned TypeScript 7.0.2 native compiler API. It resolves real module exports, aliases and re-exports and retains each declaration of overloads and merged symbols, constants, types, namespaces and public/protected members. It never evaluates target modules or emits JavaScript.

```js
import { extractTsDocProject } from "@hia-doc/ts-doc-extractor/project";
import { tsDocToHiaDocument } from "@hia-doc/ts-doc-adapter";
import { createTsDocProjectSourceMap } from "@hia-doc/ts-to-js-doc-source-map";

const extraction = extractTsDocProject({
  workspaceRoot: process.cwd(),
  entrypoints: ["src/index.ts"],
  defaultLocale: "en"
});
const document = tsDocToHiaDocument(extraction);
const sourceMap = createTsDocProjectSourceMap(extraction, {
  extractionPath: "api/project.tsdoc.json",
  hiaDocumentPath: "api/project.hia.json"
});
```

This API produces `hia-tsdoc-extraction@0.2.0-draft`, separate from the original `0.1.0-draft` format. Re-extract actual source to migrate; changing a version label is invalid. Consumers should fail their build on extraction error diagnostics. A binding without an authorized supported declaration remains in the export table with an empty `symbolIds` array and an error diagnostic, rather than a fabricated declaration.

Each entry is a canonical path relative to the authorized workspace. Imported source declarations must stay inside that physical root; external dependency declarations cannot expand permission. A virtual configuration uses ES2022/NodeNext, without loading disk `tsconfig` files, plugins or transformers. Custom compiler options, path aliases and ambient project configuration are not supported by this draft API. Limits: 1,000 unique entries, 20,000 declaration/member symbols and 4 MiB per readable source file. Node.js 22 and 24 are the verified runtimes.

Signatures omit function implementations, preserve explicit syntax and use compiler-inferred variable types when needed. Source ranges use the actual original bytes' UTF-16 positions with one-based coordinates and exclusive ends; CRLF is not normalized. Descriptions, remarks, parameters, type parameters, returns, throws and examples retain field-level bilingual data through the existing `@lang` and inline `<lang>` parser. No translation is generated. Parameter properties, inherited members and complete TypeScript semantic diagnostics are not promised by this draft. Unsupported exposed declaration syntax is an error.

The runner now exposes `runTsDocProject()` and explicit `hia-tsdoc --project` selection; its original single-file/config mode keeps the scanner behavior. The project API does not create ordinary JavaScript source maps or coordinate evidence; `emitted: false` with `emitStatus: "unverified"` records the absence of emission proof. This source candidate is not yet an npm release.

## Structured project mode

Pass contractVersion: '0.3.0-draft' to extractTsDocProject() to preserve anonymous objects, unions and intersections in type aliases and properties. Parenthesized types are transparent. Every direct branch has a zero-based source-order index and a representative node, including opaque leaves. Structural nodes retain actual signatures/ranges and have no invented comments. Physical members retain their own comments and sources. Opaque wrappers hiding anonymous members produce an error. Function return shapes keep their existing signature projection. All structural nodes count toward the 20,000-node budget. Omission still selects 0.2.0-draft.

中文说明。显式选择0.3后，类型别名及属性以结构树保留分支和真实成员。联合允许同时满足多个分支。未知匿名成员不能静默省略，函数返回形状继续原签名投影。四MiB来源与千入口限制保持。

## Generic and array wrappers

Explicit project version 0.4.0-draft adds type applications, array elements and readonly operands to the existing structural tree. Generic target names are lexical source references, with source-ordered argument indices. The producer preserves syntax without evaluating utility types or inferring builtin identities. Select contractVersion in extractTsDocProject(), options.extractionVersion in the runner/producer, or --extraction-version in project CLI mode. Extraction and bridge use 0.4, HIA core stays 0.2.0, and direct maps stay 1.1.0. Earlier versions retain exact reading and their original default/rejection boundaries. Unsupported wrappers concealing members still fail.

中文说明。0.4保留泛型目标与实参、数组元素及readonly操作数，具名引用不按字符串认定内建含义。结构节点只有来源事实，物理成员保留双语。显式重新提取授权源码后迁移，旧0.3包装拒绝与0.2默认保持。

For 0.4, inferred signatures read the pinned compiler's same-version platform library directory. The platform package name and version must match the compiler's optional dependency. This keeps source and installed runs consistent. Earlier identities retain their original read boundaries and inference.

中文说明。0.4按实际编译器依赖定位并核验同版本平台标准库，确保源码运行与归档安装的推导签名一致。其它外部声明仍遵循既有授权根。
