# @hia-doc/tsdoc-producer

Documentation producer adapter for HIA TSDoc.

This package exposes the standalone `@hia-doc/tsdoc-runner` through the HIA `documentation-producer` contract. It intentionally contains only a thin descriptor and `produce()` adapter so standalone behavior and HIA orchestration behavior stay aligned.

The unreleased named export `tsdocProjectProducer` exposes the same generic project runner through `documentation-producer@1.0.0`, with `typescript-project` inputs (`paths` locators) and extraction/bridge/HIA/direct-map outputs. `tsdocProjectProducerDescriptor` declares the exact capabilities. The original default `tsdocProducer` descriptor and single-file mode remain unchanged. A stable SDK envelope does not stabilize the domain `0.2.0-draft` formats, grant source authority or prove JavaScript emission. Load the producer explicitly and execute it only within the host's authorized workspace.

## Structured project selection

The existing named tsdocProjectProducer forwards options.extractionVersion: '0.3.0-draft' to the same project runner. Its SDK descriptor stays 1.0.0 and input kind stays typescript-project. Domain artifact versions are selected explicitly, with no change to the default producer or the old 0.2 project mode.

中文说明。同一生产器显式选择0.3领域模型，SDK身份和输入种类保持，源码授权仍由宿主提供。
