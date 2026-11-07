# TSDoc Adapter

Converts TSDoc extraction artifacts to HIA core documents.

The P1 adapter emits runtime symbols into HIA core documents and keeps type-only symbols in document metadata.

## Project extraction compatibility

The unreleased `hia-tsdoc-extraction@0.2.0-draft` project format presents actual types and members as HIA symbols, retaining public entry metadata and declaration parent relationships. The original `0.1.0-draft` format keeps runtime symbols visible and type-only declarations in metadata. Input versions are checked explicitly; changing an old artifact's version does not migrate it. The adapter creates no source fetch permission or JavaScript emission proof.

## Structured type projection

The explicit 0.3 project format maps type-expression containers to existing HIA typedef symbols. metadata.tsdoc.typeExpression preserves the operator, syntax kind and optional branch index. Parents, signatures, supported comment fields and original sources survive unchanged. Existing core document 0.2.0 remains the output identity.

中文说明。新增结构树使用既有核心typedef及metadata承接，保留父项、原文、语言和源码范围，不为结构容器编造正文。

## Generic and array wrappers

Explicit project version 0.4.0-draft adds type applications, array elements and readonly operands to the existing structural tree. Generic target names are lexical source references, with source-ordered argument indices. The producer preserves syntax without evaluating utility types or inferring builtin identities. Select contractVersion in extractTsDocProject(), options.extractionVersion in the runner/producer, or --extraction-version in project CLI mode. Extraction and bridge use 0.4, HIA core stays 0.2.0, and direct maps stay 1.1.0. Earlier versions retain exact reading and their original default/rejection boundaries. Unsupported wrappers concealing members still fail.

中文说明。0.4保留泛型目标与实参、数组元素及readonly操作数，具名引用不按字符串认定内建含义。结构节点只有来源事实，物理成员保留双语。显式重新提取授权源码后迁移，旧0.3包装拒绝与0.2默认保持。
