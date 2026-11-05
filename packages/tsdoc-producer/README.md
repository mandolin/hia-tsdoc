# @hia-doc/tsdoc-producer

Documentation producer adapter for HIA TSDoc.

This package exposes the standalone `@hia-doc/tsdoc-runner` through the HIA `documentation-producer` contract. It intentionally contains only a thin descriptor and `produce()` adapter so standalone behavior and HIA orchestration behavior stay aligned.

The unreleased named export `tsdocProjectProducer` exposes the same generic project runner through `documentation-producer@1.0.0`, with `typescript-project` inputs (`paths` locators) and extraction/bridge/HIA/direct-map outputs. `tsdocProjectProducerDescriptor` declares the exact capabilities. The original default `tsdocProducer` descriptor and single-file mode remain unchanged. A stable SDK envelope does not stabilize the domain `0.2.0-draft` formats, grant source authority or prove JavaScript emission. Load the producer explicitly and execute it only within the host's authorized workspace.
