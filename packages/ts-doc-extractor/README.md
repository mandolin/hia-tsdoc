# TSDoc Extractor

Extracts TypeScript/TSDoc documentation artifacts from TypeScript source.

Current P1 extractor support:

- runtime function/class declarations
- type-only interface/type alias declarations
- TSDoc parser diagnostics
- fixture source ranges using a conservative declaration scanner
- distinct-name top-level exported declarations on the same physical line, with separate UTF-16 ranges and adjacent TSDoc ownership

The scanner is limited to the supported declaration kinds above. It does not resolve same-name overloads or declaration merging, and it is not a complete TypeScript syntax parser. A declaration-range fallback in the documentation source map retains an unknown end boundary even when its extracted range stops before the next declaration.

TypeScript 7 exposes its new programmatic APIs under `typescript/unstable/*`; direct compiler API integration is intentionally deferred beyond this P1 fixture.
