# TSDoc Extractor

Extracts TypeScript/TSDoc documentation artifacts from TypeScript source.

Current P1 extractor support:

- runtime function/class declarations
- type-only interface/type alias declarations
- TSDoc parser diagnostics
- fixture source ranges using a conservative declaration scanner

TypeScript 7 exposes its new programmatic APIs under `typescript/unstable/*`; direct compiler API integration is intentionally deferred beyond this P1 fixture.
