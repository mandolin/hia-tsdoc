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

## Structured type expressions

Explicit project version 0.3.0-draft exports TSDOC_STRUCTURED_PROJECT_VERSION, TSDOC_TYPE_EXPRESSION_KINDS and independent extraction/bridge schema IDs and objects. Readers validate source containment, parent cycles, branch order and type-only expression roles. The existing 0.1 and 0.2 constants, schemas and exact readers retain their behavior. The new version requires a structured-mode marker and actual expression roots, so migration re-extracts source.

中文说明。0.3新增对象、联合、交叉及不透明类型结构与来源树校验。旧schema和默认版本保留，迁移必须重新读取授权源码。结构检查不认证生产者或授予源码权限。
