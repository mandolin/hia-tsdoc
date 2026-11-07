# TS To JS Doc Source Map

Defines source linkage between TypeScript documentation and emitted JavaScript documentation.

The P1 manifest references TypeScript ordinary source maps, records runtime JS artifact refs and marks type-only symbols with `TS_TYPE_ONLY_NO_JS_EMIT`.

The current writer emits `doc-source-map@1.1.0`. For source references produced by the local TSDoc fixture scanner, attached comment ranges are exclusive UTF-16 positions. Declaration fallbacks use UTF-16 columns but keep the end boundary `unknown` because complex syntax can exceed the scanner's proven coverage. References from other extraction producers mark both dimensions `unknown`. The ordinary TypeScript-to-JavaScript source map remains a separate source-map-v3 artifact.

The extraction artifact is single-source. The writer rejects a symbol whose source path differs from the artifact source path, since that symbol would otherwise refer to an unregistered source. Disabling `emitDocSourceMap` also removes the optional HIA document map reference.

For the unreleased `0.2.0-draft` project format, use the separate `createTsDocProjectSourceMap()` export. It emits a direct AST-to-HIA `doc-source-map@1.1.0`, registers every actual source file and retains types, members and attached comment ranges. It emits no ordinary JavaScript map, generated JavaScript artifact or cross-map coordinate proof. `extractionPath` and `hiaDocumentPath` must identify the corresponding saved artifacts using safe relative paths; the function does not write them. Source text remains excluded. The legacy TS-to-JS writer keeps its single-source behavior.

## Structured project maps

createTsDocProjectSourceMap() also accepts exact extraction 0.3.0-draft. Every expression and physical declaration receives its actual source range. Documentation comments retain separate references. Extraction/bridge contract references use the actual selected version while the direct map remains 1.1.0.

中文说明。0.3结构容器和真实成员均生成直接地图引用，声明与注释范围分开，桥接引用使用实际版本，无普通地图或跨地图证明。

## Generic and array wrappers

Explicit project version 0.4.0-draft adds type applications, array elements and readonly operands to the existing structural tree. Generic target names are lexical source references, with source-ordered argument indices. The producer preserves syntax without evaluating utility types or inferring builtin identities. Select contractVersion in extractTsDocProject(), options.extractionVersion in the runner/producer, or --extraction-version in project CLI mode. Extraction and bridge use 0.4, HIA core stays 0.2.0, and direct maps stay 1.1.0. Earlier versions retain exact reading and their original default/rejection boundaries. Unsupported wrappers concealing members still fail.

中文说明。0.4保留泛型目标与实参、数组元素及readonly操作数，具名引用不按字符串认定内建含义。结构节点只有来源事实，物理成员保留双语。显式重新提取授权源码后迁移，旧0.3包装拒绝与0.2默认保持。
