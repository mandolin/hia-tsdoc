# @hia-doc/tsdoc-runner

Standalone TypeScript/TSDoc project runner for HIA TSDoc.

The runner compiles TypeScript to JavaScript, normalizes the ordinary source map, extracts TSDoc symbols, builds the TSDoc-to-JSDoc bridge artifact, emits a `doc-source-map` manifest and writes the HIA document adapter output. It returns a `documentation-producer-result` so the same API can be used by standalone projects and HIA-Documentation-Sys orchestration.

```sh
hia-tsdoc --config tsdoc.config.json
```

The package also keeps `tsdoc` as an early compatibility alias, but new project scripts should prefer `hia-tsdoc` to avoid collisions with other TSDoc-related tooling.

For read-only pilots, pass compiler options directly:

```sh
hia-tsdoc --workspace-root /path/to/project --out-dir /tmp/hia-tsdoc --module-resolution bundler --types node src/index.ts
```

For project scripts, prefer a documentation-only `tsdoc.config.json` and set `options.moduleResolution` to `bundler` when the target project relies on bundler-style TypeScript resolution.
