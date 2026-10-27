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

This workspace now includes the first TypeScript -> JavaScript generated-source fixture. The P1 path uses the TypeScript compiler CLI, the official TSDoc parser and a conservative scanner for exported declaration locations:

- TypeScript source is compiled to JavaScript and an ordinary source map.
- TSDoc comments are parsed from TypeScript declarations.
- Runtime symbols and type-only symbols are separated in the TS extraction artifact.
- Type-only symbols remain in TS artifact/HIA metadata for P1 and are not promoted to stable HIA core symbol kinds.
- `doc-source-map@1.1.0` records TS source ranges, generated JS artifact references, ordinary source map references and type-only diagnostics. Each ranged source reference declares its end boundary and column unit: measured attached comments use an exclusive UTF-16 boundary, while declaration scanner fallbacks retain an unknown end boundary. Foreign extraction artifacts retain unknown precision.
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
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "writeResultManifest": true
  }
}
```

Then run:

```sh
hia-tsdoc --config tsdoc.config.json
```

`sourcesContentPolicy` defaults to `none`; embedding source text should remain an explicit opt-in and must be release-gated by the consuming project.

### Verified ordinary source-map coordinates (opt-in)

Set `options.emitCoordinateProfile` to `true`, or pass `--coordinate-profile` to the CLI, to emit one `ordinary-source-map-coordinate-profile@0.1.0-draft` sidecar per TypeScript input. The sidecar binds the actual bytes of the final ordinary `.js.map`, `doc-source-map@1.1.0`, and the authorized primary TypeScript source. It declares a UTF-16 original-source slot only when the compiler map contains a segment for that slot. A consumer must still check the actual bytes and query each documentation reference; the sidecar alone does not make every symbol an exact anchor.

This mode requires `emitDocSourceMap: true`, `sourcesContentPolicy: "none"`, compiler config isolation (`ignoreConfig` enabled), a single valid UTF-8 source of at most 16 MiB, and an output directory inside the workspace. The runner compiles a private immutable copy of those source bytes, verifies the compiler's sole source slot, then replaces its temporary map source with the original workspace-relative source before writing and hashing the final map. Unsupported imports, multiple source slots, linked output paths, oversized artifacts, or missing evidence fail without a new sidecar. For each input that reaches safe path preflight, an old sidecar is revoked before processing. An abort or request failure before that point may leave an earlier file on disk, so consumers must always recheck actual source and map bytes rather than trusting file presence. Source text and temporary paths are never stored in the sidecar. Existing builds remain opt-out by default.

TypeScript 7.0 exposes its native `tsc` command while its stable programmatic API is pending; the runner therefore uses the native CLI for this isolated compile. See the [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) and [TypeScript 7.1 beta announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/) for the API boundary. Static output-path checks reject existing redirects; a concurrent adversary changing filesystem components during a build requires host-level directory isolation.

For bundler-oriented TypeScript projects, prefer a documentation-specific `tsdoc.config.json` instead of changing the production `tsconfig.json`. Set `options.moduleResolution` to `bundler` when the source entry depends on package exports, extensionless ESM imports or other bundler-style resolution behavior.

HIA TSDoc accepts `@performance` as a project-level block tag for complexity, caching, memory or rendering-performance notes. Use standard TSDoc `@throws` text without JSDoc-style type braces:

```ts
/**
 * Renders a value.
 *
 * @performance Uses a cache-backed fast path for repeated glyph lookups.
 * @throws Throws when the input cannot be normalized.
 */
export function renderValue(input: unknown): string;
```

Avoid old JSDoc-style `@throws {Error}` in TSDoc comments; the official TSDoc parser treats `{Error}` as malformed inline-tag syntax.

For quick read-only pilots against an existing project, the CLI can receive the same compiler boundary without writing a config file into that project:

```sh
hia-tsdoc --workspace-root /path/to/project --out-dir /tmp/hia-tsdoc --types node src/index.ts
```

The current repository gate includes `npm run check:target-consumer`, which packs every local workspace package, installs those tarballs into a temporary consumer project and invokes the packaged `hia-tsdoc` binary. This keeps the target-project path separate from monorepo internals.
