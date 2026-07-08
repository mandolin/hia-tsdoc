# HIA TSDoc

HIA TSDoc is the TypeScript and TSDoc documentation workspace for HIA.

This repository is planned as an umbrella monorepo for TypeScript/TSDoc documentation specification, extraction, JavaScript documentation bridging, HIA adapter output and documentation source-map linkage.

## Packages

- `@hia-doc/tsdoc-spec`: TypeScript/TSDoc documentation annotation, tag registry and rule drafts.
- `@hia-doc/ts-doc-extractor`: TypeScript source to TSDoc extraction artifact.
- `@hia-doc/ts-doc-adapter`: TSDoc extraction artifact to HIA core document.
- `@hia-doc/ts-to-js-doc-source-map`: TypeScript to JavaScript documentation source-map linkage.
- `@hia-doc/ts-jsdoc-bridge`: TSDoc and JSDoc bridge.

## Status

This workspace is currently a bootstrap skeleton. Runtime parser dependencies and public package publishing remain intentionally disabled until the foundation ADRs are accepted.

## Development

```sh
npm run release:gate
```
