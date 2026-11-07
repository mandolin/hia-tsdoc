# @hia-doc/tsdoc-producer

Documentation producer adapter for HIA TSDoc.

This package exposes the standalone `@hia-doc/tsdoc-runner` through the HIA `documentation-producer` contract. It intentionally contains only a thin descriptor and `produce()` adapter so standalone behavior and HIA orchestration behavior stay aligned.

The unreleased named export `tsdocProjectProducer` exposes the same generic project runner through `documentation-producer@1.0.0`, with `typescript-project` inputs (`paths` locators) and extraction/bridge/HIA/direct-map outputs. `tsdocProjectProducerDescriptor` declares the exact capabilities. The original default `tsdocProducer` descriptor and single-file mode remain unchanged. A stable SDK envelope does not stabilize the domain `0.2.0-draft` formats, grant source authority or prove JavaScript emission. Load the producer explicitly and execute it only within the host's authorized workspace.

## Structured project selection

The existing named tsdocProjectProducer forwards options.extractionVersion: '0.3.0-draft' to the same project runner. Its SDK descriptor stays 1.0.0 and input kind stays typescript-project. Domain artifact versions are selected explicitly, with no change to the default producer or the old 0.2 project mode.

中文说明。同一生产器显式选择0.3领域模型，SDK身份和输入种类保持，源码授权仍由宿主提供。

## Generic and array wrappers

Explicit project version 0.4.0-draft adds type applications, array elements and readonly operands to the existing structural tree. Generic target names are lexical source references, with source-ordered argument indices. The producer preserves syntax without evaluating utility types or inferring builtin identities. Select contractVersion in extractTsDocProject(), options.extractionVersion in the runner/producer, or --extraction-version in project CLI mode. Extraction and bridge use 0.4, HIA core stays 0.2.0, and direct maps stay 1.1.0. Earlier versions retain exact reading and their original default/rejection boundaries. Unsupported wrappers concealing members still fail.

中文说明。0.4保留泛型目标与实参、数组元素及readonly操作数，具名引用不按字符串认定内建含义。结构节点只有来源事实，物理成员保留双语。显式重新提取授权源码后迁移，旧0.3包装拒绝与0.2默认保持。
