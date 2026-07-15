# Changelog

## 0.1.2

- Fix the conservative extractor so exported functions with object-literal default parameters, such as `options = {}`, are not omitted from TSDoc output.

## 0.1.1

- Accept `@performance` as an HIA TSDoc project-level block tag without parser warnings.
- Add standard `@throws` to the known tag registry and document migration away from JSDoc-style `@throws {Type}` syntax.
- Document docs-only `moduleResolution: "bundler"` configuration for target projects that use package exports or bundler-style resolution.

## 0.1.0

- Initialize HIA TSDoc bootstrap workspace.
- Add the first TypeScript -> JavaScript -> TSDoc/doc-source-map/HIA fixture baseline.
- Add the standalone TSDoc runner, CLI, producer adapter and standalone example.
- Add the target-project consumer smoke, `hia-tsdoc` CLI binary and packaged install validation.
- Add readonly target-project pilot support and prepare the first public `@hia-doc/tsdoc-*` package release.
