/**
 * @lang zh-CN 项目提取的完整语义桥接与两代读取；不运行JSDoc或虚构JavaScript产物。
 * @lang en Full semantic bridging and two-generation reading for project extraction, without running JSDoc or fabricating JavaScript artifacts.
 */
import {readTsDocExtraction,TSDOC_PROJECT_BRIDGE_CONTRACT_VERSION} from "@hia-doc/tsdoc-spec";

/**
 * @lang zh-CN 保留每条声明的签名/注释/来源/父项，明确没有发射证明；输入对象不变。
 * @lang en Retain each declaration's signature/comments/source/parentage, explicitly without emission proof; input objects stay unchanged.
 * @param {object} extraction - 新项目提取对象。 New project extraction.
 * @param {object} [options] - 当前仅接受空对象，不接受猜测的JS定位器。 Empty object only; guessed JS locators are refused.
 * @returns {object} 0.2.0-draft桥接，非原生JSDoc执行结果。 0.2.0-draft bridge, not a native JSDoc execution result.
 * @throws {Error} 版本、结构或选项不符合。 Invalid version, structure or options.
 */
export function tsDocProjectToJsDocBridgeArtifact(extraction,options={}) {
  readTsDocExtraction(extraction);
  if(extraction.contractVersion!=="0.2.0-draft" || !options || typeof options!=="object" || Array.isArray(options) || Object.keys(options).length) throw new Error("Invalid project bridge request.");
  // <lang><zh-CN>分类投影不丢字段，运行时分类不意味着已经发射；类型也保留全部文档。</zh-CN><en>Classification projection loses no fields; runtime classification does not imply emission, and types retain their full documentation too.</en></lang>
  const project=(classification,status)=>extraction.symbols.filter(symbol=>symbol.classification===classification).map(symbol=>({...symbol,bridgeStatus:status}));
  return {
    contract:"hia-ts-jsdoc-bridge",contractVersion:TSDOC_PROJECT_BRIDGE_CONTRACT_VERSION,
    producer:{name:"@hia-doc/ts-jsdoc-bridge",version:"0.1.3"},profile:extraction.profile,source:extraction.source,modules:extraction.modules,
    defaultLocale:extraction.defaultLocale ?? "en",locales:extraction.locales ?? [extraction.defaultLocale ?? "en"],
    artifact:null,runtimeSymbols:project("runtime","not-emitted"),typeOnlySymbols:project("type-only","ts-only"),diagnostics:extraction.diagnostics,
    metadata:{sourceContract:extraction.contract,sourceContractVersion:extraction.contractVersion,sourceProducer:extraction.producer,symbolOrder:extraction.symbols.map(symbol=>symbol.id),ordinarySourceMapStatus:"not-produced",sourcesContentPolicy:"none"}
  };
}

/**
 * @lang zh-CN 精确读取原桥接或新无发射桥接；不改对象、版本或生成JS，拒绝仅改版本号。
 * @lang en Read the exact legacy or new non-emitting bridge without modifying objects/versions or generating JS; relabeled artifacts are refused.
 * @param {object} artifact - 已解析桥接JSON。 Parsed bridge JSON.
 * @returns {object} 原始有效对象。 Original valid object.
 * @throws {Error} 身份/版本/结构或逐声明引用不符合。 Invalid identity/version/shape or declaration references.
 */
export function readTsJsDocBridgeArtifact(artifact) {
  if(!artifact || artifact.contract!=="hia-ts-jsdoc-bridge" || !Array.isArray(artifact.runtimeSymbols) || !Array.isArray(artifact.typeOnlySymbols)) throw new Error("Invalid TypeScript bridge.");
  if(artifact.contractVersion==="0.1.0-draft") return artifact;
  if(artifact.contractVersion!==TSDOC_PROJECT_BRIDGE_CONTRACT_VERSION) throw new Error("Unsupported TypeScript bridge version.");
  if(artifact.artifact!==null || !Array.isArray(artifact.diagnostics)
    || artifact.runtimeSymbols.some(symbol=>symbol.classification!=="runtime" || symbol.bridgeStatus!=="not-emitted")
    || artifact.typeOnlySymbols.some(symbol=>symbol.classification!=="type-only" || symbol.bridgeStatus!=="ts-only")) throw new Error("Invalid TypeScript project bridge.");
  // <lang><zh-CN>以同一提取读取器校验跨分类模块/父项引用，禁止桥接另建较宽松的声明语义。</zh-CN><en>Use the same extraction reader for cross-classification module/parent references rather than defining looser bridge declaration semantics.</en></lang>
  const symbols=[...artifact.runtimeSymbols,...artifact.typeOnlySymbols];
  // <lang><zh-CN>分类数组不改变原声明顺序事实；顺序表必须恰好覆盖所有唯一符号。</zh-CN><en>Classification arrays preserve original declaration order facts through an order table that must cover every unique symbol exactly once.</en></lang>
  const order=artifact.metadata?.symbolOrder;
  const symbolIds=new Set(symbols.map(symbol=>symbol.id));
  if(!Array.isArray(order) || order.length!==symbols.length || new Set(order).size!==order.length || order.some(id=>!symbolIds.has(id))) throw new Error("Invalid TypeScript bridge symbol order.");
  readTsDocExtraction({contract:"hia-tsdoc-extraction",contractVersion:"0.2.0-draft",producer:artifact.producer,profile:artifact.profile,source:artifact.source,modules:artifact.modules,symbols,artifacts:[],comments:symbols.filter(symbol=>symbol.comment).map(symbol=>({symbolId:symbol.id,...symbol.comment})),diagnostics:artifact.diagnostics});
  return artifact;
}
