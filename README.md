# HIA TSDoc

HIA TSDoc is the TypeScript and TSDoc documentation workspace for HIA.

This repository is an umbrella monorepo for TypeScript/TSDoc documentation specification, extraction, JavaScript documentation bridging, HIA adapter output and documentation source-map linkage.

## Packages

- `@hia-doc/tsdoc-spec`: TypeScript/TSDoc documentation annotation, tag registry and rule drafts.
- `@hia-doc/ts-doc-extractor`: TypeScript source to TSDoc extraction artifact.
- `@hia-doc/ts-doc-adapter`: TSDoc extraction artifact to HIA core document.
- `@hia-doc/ts-to-js-doc-source-map`: TypeScript to JavaScript documentation source-map linkage.
- `@hia-doc/ts-jsdoc-bridge`: TSDoc and JSDoc bridge.
- `@hia-doc/tsdoc-runner`: standalone TypeScript/TSDoc project runner and CLI.
- `@hia-doc/tsdoc-producer`: HIA documentation producer adapter backed by the runner.

## Status

This workspace now includes the first TypeScript -> JavaScript generated-source fixture. The P1 path uses TypeScript compiler APIs and the official TSDoc parser:

- TypeScript source is compiled to JavaScript and an ordinary source map.
- TSDoc comments are parsed from TypeScript declarations.
- Runtime symbols and type-only symbols are separated in the TS extraction artifact.
- Type-only symbols remain in TS artifact/HIA metadata for P1 and are not promoted to stable HIA core symbol kinds.
- `doc-source-map` records TS source ranges, generated JS artifact references, ordinary source map references and type-only diagnostics.
- `@hia-doc/tsdoc-runner` can run the same pipeline from JSON config or CLI inputs and emit a `documentation-producer-result`.
- `@hia-doc/tsdoc-producer` exposes the same runner through the producer contract for HIA-Documentation-Sys orchestration.

API Extractor and TypeDoc are not P1 runtime dependencies. They remain P2 bridge candidates.

## Fixture

The P1 fixture covers:

- runtime exported function
- type-only interface
- TSDoc `@public`, `@param` and `@returns`
- TypeScript generated JavaScript
- ordinary source map without `sourcesContent`
- HIA core document with runtime symbols and type-only metadata

## Development

```sh
npm install
npm run build:fixtures
npm run smoke:standalone
npm run check:fixtures
npm run check:target-consumer
npm run release:gate
```

## Target Project Usage

For a normal TypeScript project, install the runner package and create a `tsdoc.config.json`:

```json
{
  "$schema": "https://mandolin.github.io/HIA-Documentation/schemas/tsdoc-config-0.1.0-draft.schema.json",
  "schemaVersion": "0.1.0-draft",
  "workspaceRoot": ".",
  "outputDirectory": "dist/hia-tsdoc",
  "inputs": [
    {
      "kind": "typescript-entry",
      "path": "src/index.ts",
      "artifactBasePath": "api/index"
    }
  ],
  "options": {
    "emitDocSourceMap": true,
    "sourcesContentPolicy": "none",
    "target": "ES2022",
    "module": "ES2022",
    "writeResultManifest": true
  }
}
```

Then run:

```sh
hia-tsdoc --config tsdoc.config.json
```

`sourcesContentPolicy` defaults to `none`; embedding source text should remain an explicit opt-in and must be release-gated by the consuming project.

The current repository gate includes `npm run check:target-consumer`, which packs every local workspace package, installs those tarballs into a temporary consumer project and invokes the packaged `hia-tsdoc` binary. This keeps the target-project path separate from monorepo internals.
