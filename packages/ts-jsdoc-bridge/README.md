# TS JSDoc Bridge

Bridges TSDoc extraction artifacts with JSDoc semantics.

The P1 bridge preserves runtime symbols for JSDoc-compatible pipelines and records type-only symbols as TS-only bridge metadata.

For `hia-tsdoc-extraction@0.2.0-draft`, `tsDocToJsDocBridgeArtifact()` selects the independent `hia-ts-jsdoc-bridge@0.2.0-draft` output. Both classification arrays retain full signatures, parentage, original sources and supported bilingual comment fields; `metadata.symbolOrder` retains original declaration order. The bridge has `artifact: null`, runtime `bridgeStatus: "not-emitted"` and type-only `bridgeStatus: "ts-only"`. It does not run native JSDoc, emit JavaScript or accept a guessed `jsPath`.

`readTsJsDocBridgeArtifact()` reads either exact version without modifying it. New objects require project module/binding references and explicit non-emission state; changing an old object's version label is invalid. Unknown versions are refused. These are unreleased source APIs, not an npm release or a promise that existing external bridge consumers already read the new format.
