import {
  TSDOC_INPUT_KINDS,
  TSDOC_OUTPUT_KINDS,
  TSDOC_RUNNER_VERSION,
  runTsDoc
} from "@hia-doc/tsdoc-runner";

export const tsdocProducerDescriptor = Object.freeze({
  contract: "documentation-producer",
  contractVersion: "0.1.0-draft",
  id: "tsdoc",
  version: TSDOC_RUNNER_VERSION,
  displayName: "TSDoc",
  inputKinds: [...TSDOC_INPUT_KINDS],
  outputKinds: [...TSDOC_OUTPUT_KINDS],
  capabilities: {
    sourceLinkage: true,
    incremental: false,
    watch: false
  }
});

export const tsdocProducer = Object.freeze({
  descriptor: tsdocProducerDescriptor,
  produce(request, context = {}) {
    return runTsDoc(request, context);
  }
});

export default tsdocProducer;
