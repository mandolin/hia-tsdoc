# TS JSDoc Bridge

Bridges TSDoc extraction artifacts with JSDoc semantics.

The P1 bridge preserves runtime symbols for JSDoc-compatible pipelines and records type-only symbols as TS-only bridge metadata.

For `hia-tsdoc-extraction@0.2.0-draft`, `tsDocToJsDocBridgeArtifact()` selects the independent `hia-ts-jsdoc-bridge@0.2.0-draft` output. Both classification arrays retain full signatures, parentage, original sources and supported bilingual comment fields; `metadata.symbolOrder` retains original declaration order. The bridge has `artifact: null`, runtime `bridgeStatus: "not-emitted"` and type-only `bridgeStatus: "ts-only"`. It does not run native JSDoc, emit JavaScript or accept a guessed `jsPath`.

`readTsJsDocBridgeArtifact()` reads either exact version without modifying it. New objects require project module/binding references and explicit non-emission state; changing an old object's version label is invalid. Unknown versions are refused. These are unreleased source APIs, not an npm release or a promise that existing external bridge consumers already read the new format.

## Structured project artifacts

Extraction 0.3.0-draft selects bridge 0.3.0-draft and retains the full type-expression tree and source order across classification arrays. The reader validates the original order, mode marker, source contract and expression graph through the same extraction reader. Exact 0.1/0.2 reading remains available.

中文说明。0.3桥接无损保留结构角色、分支和逐成员正文，精确核版本及原顺序，不产生JavaScript发射事实。

## Generic and array wrappers

Explicit project version 0.4.0-draft adds type applications, array elements and readonly operands to the existing structural tree. Generic target names are lexical source references, with source-ordered argument indices. The producer preserves syntax without evaluating utility types or inferring builtin identities. Select contractVersion in extractTsDocProject(), options.extractionVersion in the runner/producer, or --extraction-version in project CLI mode. Extraction and bridge use 0.4, HIA core stays 0.2.0, and direct maps stay 1.1.0. Earlier versions retain exact reading and their original default/rejection boundaries. Unsupported wrappers concealing members still fail.

中文说明。0.4保留泛型目标与实参、数组元素及readonly操作数，具名引用不按字符串认定内建含义。结构节点只有来源事实，物理成员保留双语。显式重新提取授权源码后迁移，旧0.3包装拒绝与0.2默认保持。
