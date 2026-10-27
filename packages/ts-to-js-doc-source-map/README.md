# TS To JS Doc Source Map

Defines source linkage between TypeScript documentation and emitted JavaScript documentation.

The P1 manifest references TypeScript ordinary source maps, records runtime JS artifact refs and marks type-only symbols with `TS_TYPE_ONLY_NO_JS_EMIT`.

The current writer emits `doc-source-map@1.1.0`. For source references produced by the local TSDoc fixture scanner, attached comment ranges are exclusive UTF-16 positions. Declaration fallbacks use UTF-16 columns but keep the end boundary `unknown` because complex syntax can exceed the scanner's proven coverage. References from other extraction producers mark both dimensions `unknown`. The ordinary TypeScript-to-JavaScript source map remains a separate source-map-v3 artifact.

The extraction artifact is single-source. The writer rejects a symbol whose source path differs from the artifact source path, since that symbol would otherwise refer to an unregistered source. Disabling `emitDocSourceMap` also removes the optional HIA document map reference.
