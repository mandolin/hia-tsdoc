import {
  TSDOC_INPUT_KINDS,
  TSDOC_OUTPUT_KINDS,
  TSDOC_RUNNER_VERSION,
  runTsDoc,
  runTsDocProject
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

/** @lang zh-CN 已确认SDK1.0描述，声明项目语义输出；旧描述身份保持不变。 @lang en Confirmed SDK 1.0 descriptor for project semantics, preserving the original descriptor identity. */
export const tsdocProjectProducerDescriptor=Object.freeze({
  contract:"documentation-producer",contractVersion:"1.0.0",id:"tsdoc-project",version:TSDOC_RUNNER_VERSION,displayName:"TypeScript Project Documentation",
  inputKinds:["typescript-project"],outputKinds:["tsdoc-extraction","ts-jsdoc-bridge","hia-document","doc-source-map"],capabilities:{sourceLinkage:true,incremental:false,watch:false}
});

/** @lang zh-CN 薄项目适配器，编排与独立CLI使用同一运行器，不维护第二套提取逻辑。 @lang en Thin project adapter using the same runner as the standalone CLI without maintaining another extractor. */
export const tsdocProjectProducer=Object.freeze({
  descriptor:tsdocProjectProducerDescriptor,
  /**
   * @lang zh-CN 在宿主明确授权的范围执行通用项目抽取。
   * @lang en Execute generic project extraction within the host's explicit authority.
   * @param {object} request - SDK标准请求。 Standard SDK request.
   * @param {object} [context] - 宿主进度和信号。 Host progress and signal.
   * @returns {Promise<object>} SDK1.0结果。 SDK 1.0 result.
   */
  produce(request,context={}) {return runTsDocProject(request,context);}
});
