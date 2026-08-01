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

## Unicode-compatible host handoff

`hia-tsdoc-handoff` evaluates an explicit, metadata-only handoff evidence JSON for a Unicode-compatible
host. It is intended for a TypeScript producer and compatible desktop/web hosts that have different
package layouts, such as a core project plus Tauri or Electron companions.

```sh
hia-tsdoc-handoff --evidence handoff-evidence.json --out handoff-report.json
```

The input must declare `unicode-compatible-tsdoc-handoff-request@0.1.0-draft`, a successful
`documentation-producer-result@0.1.0-draft`, stable documentation entries, the six normal TSDoc
artifact kinds, metadata-only ordinary/doc-source-map evidence, and `npm-tarball` release isolation.
The report is `unicode-compatible-tsdoc-handoff@0.1.0-draft` with `accepted` or `refused` status.

This command reads only the explicitly named JSON evidence file. It does not discover a target
repository, read TypeScript/source-map/artifact bodies, run target commands, write a target repository,
use local links, access the network, or publish a package. `sourcesContentPolicy` must be `none`; an
embedded/fetched source body, an absolute-like artifact path, a duplicate stable entry, or a non-tarball
consumer boundary is refused.
