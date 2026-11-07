# TS JSDoc Bridge

Bridges TSDoc extraction artifacts with JSDoc semantics.

The P1 bridge preserves runtime symbols for JSDoc-compatible pipelines and records type-only symbols as TS-only bridge metadata.

For `hia-tsdoc-extraction@0.2.0-draft`, `tsDocToJsDocBridgeArtifact()` selects the independent `hia-ts-jsdoc-bridge@0.2.0-draft` output. Both classification arrays retain full signatures, parentage, original sources and supported bilingual comment fields; `metadata.symbolOrder` retains original declaration order. The bridge has `artifact: null`, runtime `bridgeStatus: "not-emitted"` and type-only `bridgeStatus: "ts-only"`. It does not run native JSDoc, emit JavaScript or accept a guessed `jsPath`.

`readTsJsDocBridgeArtifact()` reads either exact version without modifying it. New objects require project module/binding references and explicit non-emission state; changing an old object's version label is invalid. Unknown versions are refused. These are unreleased source APIs, not an npm release or a promise that existing external bridge consumers already read the new format.

## Structured project artifacts

Extraction 0.3.0-draft selects bridge 0.3.0-draft and retains the full type-expression tree and source order across classification arrays. The reader validates the original order, mode marker, source contract and expression graph through the same extraction reader. Exact 0.1/0.2 reading remains available.

中文说明。0.3桥接无损保留结构角色、分支和逐成员正文，精确核版本及原顺序，不产生JavaScript发射事实。
