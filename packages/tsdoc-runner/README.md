# @hia-doc/tsdoc-runner

Standalone TypeScript/TSDoc project runner for HIA TSDoc.

The runner compiles TypeScript to JavaScript, normalizes the ordinary source map, extracts TSDoc symbols, builds the TSDoc-to-JSDoc bridge artifact, emits a `doc-source-map` manifest and writes the HIA document adapter output. It returns a `documentation-producer-result` so the same API can be used by standalone projects and HIA-Documentation-Sys orchestration.

```sh
tsdoc --config tsdoc.config.json
```
