# Changelog

## Unreleased

- Add explicit project runner/CLI mode and an SDK 1.0 project producer, using the same native extraction core and safe workspace-relative output rules.
- Add an independently versioned full-field project bridge with exact legacy reading and explicit absence of JavaScript emission; register its actual artifact in direct source maps.
- Add opt-in native TypeScript project extraction with real exports, aliases, constants, per-declaration overloads, types and public/protected members.
- Introduce independent `0.2.0-draft` extraction/schema/profile identities and exact legacy/project reading; migration requires actual re-extraction.
- Preserve full supported comment fields and direct multi-source UTF-16 exclusive ranges in HIA and `doc-source-map@1.1.0` output, without claiming JavaScript emission or ordinary-map evidence.
- Declare the extractor's existing pinned TypeScript 7.0.2 runtime dependency; keep the original scanner/CLI behavior.

## 0.1.3

- Add canonical `@lang` block support and inline `<lang>` / `<l>` locale segments for TypeScript/TSDoc descriptions.
- Emit `defaultLocale`, `locales` and field-level `i18n` data in TSDoc extraction and HIA adapter artifacts.
- Keep source content private by default while making the new language-marker metadata available to standalone consumers such as UnicodeArtJs.

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
