# TSDoc Spec

Defines draft annotation, tag registry, rule and diagnostic semantics for TypeScript/TSDoc documentation.

Current draft exports:

- `hia-tsdoc-extraction@0.1.0-draft` constants.
- TSDoc tag registry.
- runtime/type-only classification constants.
- TypeScript symbol kind mapping.

The current tag registry includes standard TSDoc tags used by HIA extraction plus the `@performance` block tag for project-level performance notes.

The unreleased project format has separate `TSDOC_PROJECT_EXTRACTION_CONTRACT_VERSION`, `TSDOC_PROJECT_PROFILE_VERSION` and schema exports for `0.2.0-draft`. `readTsDocExtraction()` reads the exact old or new identity without modifying or upgrading the object. New project artifacts require module export bindings, per-declaration identities, parent relationships and explicit UTF-16 exclusive ranges. The reader additionally checks path safety, unique bindings and cross-module references; the schema alone cannot prove these relationships or source-byte accuracy. Old constants and the old schema retain their values. Migrate by extracting actual project sources, never by relabeling an old artifact.

The independent project bridge uses `TSDOC_PROJECT_BRIDGE_CONTRACT_VERSION`, `TSDOC_PROJECT_BRIDGE_SCHEMA_ID` and `TSDOC_PROJECT_BRIDGE_JSON_SCHEMA`. It retains complete project declarations and explicit `artifact: null` instead of making a generated-JavaScript claim. Its versioned reader lives in `@hia-doc/ts-jsdoc-bridge`; no global profile catalog or legacy schema is silently replaced.
