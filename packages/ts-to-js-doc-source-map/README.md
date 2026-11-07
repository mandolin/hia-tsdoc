# TS To JS Doc Source Map

Defines source linkage between TypeScript documentation and emitted JavaScript documentation.

The P1 manifest references TypeScript ordinary source maps, records runtime JS artifact refs and marks type-only symbols with `TS_TYPE_ONLY_NO_JS_EMIT`.

The current writer emits `doc-source-map@1.1.0`. For source references produced by the local TSDoc fixture scanner, attached comment ranges are exclusive UTF-16 positions. Declaration fallbacks use UTF-16 columns but keep the end boundary `unknown` because complex syntax can exceed the scanner's proven coverage. References from other extraction producers mark both dimensions `unknown`. The ordinary TypeScript-to-JavaScript source map remains a separate source-map-v3 artifact.

The extraction artifact is single-source. The writer rejects a symbol whose source path differs from the artifact source path, since that symbol would otherwise refer to an unregistered source. Disabling `emitDocSourceMap` also removes the optional HIA document map reference.

For the unreleased `0.2.0-draft` project format, use the separate `createTsDocProjectSourceMap()` export. It emits a direct AST-to-HIA `doc-source-map@1.1.0`, registers every actual source file and retains types, members and attached comment ranges. It emits no ordinary JavaScript map, generated JavaScript artifact or cross-map coordinate proof. `extractionPath` and `hiaDocumentPath` must identify the corresponding saved artifacts using safe relative paths; the function does not write them. Source text remains excluded. The legacy TS-to-JS writer keeps its single-source behavior.

## Structured project maps

createTsDocProjectSourceMap() also accepts exact extraction 0.3.0-draft. Every expression and physical declaration receives its actual source range. Documentation comments retain separate references. Extraction/bridge contract references use the actual selected version while the direct map remains 1.1.0.

中文说明。0.3结构容器和真实成员均生成直接地图引用，声明与注释范围分开，桥接引用使用实际版本，无普通地图或跨地图证明。
