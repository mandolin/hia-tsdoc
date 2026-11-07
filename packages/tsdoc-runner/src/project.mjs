/**
 * @lang zh-CN 通用TypeScript项目运行器：编排同一AST内核、完整桥接、HIA与直接地图，不执行目标或发射JS。
 * @lang en Generic TypeScript project runner orchestrating the same AST core, full bridge, HIA and direct maps without executing targets or emitting JS.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {extractTsDocProject} from "@hia-doc/ts-doc-extractor/project";
import {tsDocToHiaDocument} from "@hia-doc/ts-doc-adapter";
import {tsDocToJsDocBridgeArtifact,readTsJsDocBridgeArtifact} from "@hia-doc/ts-jsdoc-bridge";
import {createTsDocProjectSourceMap} from "@hia-doc/ts-to-js-doc-source-map";

/** @lang zh-CN 新生产器输入不改变旧typescript-entry含义。 @lang en New producer inputs leave the original typescript-entry meaning unchanged. */
export const TSDOC_PROJECT_INPUT_KINDS=Object.freeze(["typescript-project"]);
/** @lang zh-CN 项目链输出只列实际产生的四类，不含generated-js。 @lang en Project outputs name only the four actual kinds and exclude generated-js. */
export const TSDOC_PROJECT_OUTPUT_KINDS=Object.freeze(["tsdoc-extraction","ts-jsdoc-bridge","hia-document","doc-source-map"]);

/**
 * @lang zh-CN 拒绝非规范相对定位器，不静默解析点段/编码；数据仅来自显式请求。
 * @lang en Reject noncanonical relative locators without silently resolving dot segments/encodings; data comes only from explicit requests.
 * @param {unknown} value - 请求定位器。 Requested locator.
 * @returns {string} 原始已核定位器。 Original validated locator.
 * @throws {Error} 路径不符，不回显输入。 Invalid path without input reflection.
 */
function safeRelative(value) {
  if(typeof value!=="string" || !value || /[\\:%?#\u0000-\u001f\u007f]/.test(value) || value.split("/").some(part=>!part || part==="." || part==="..")) throw new Error("Invalid project relative path.");
  return value;
}

/**
 * @lang zh-CN 校验普通请求对象的闭集属性，防止不支持的编译/隐私选项被静默忽略。
 * @lang en Check closed keys on request records so unsupported compiler/privacy options cannot be silently ignored.
 * @param {object} value - 请求对象。 Request record.
 * @param {string[]} keys - 允许字段。 Allowed fields.
 * @returns {void} 有效返回。 Returns when valid.
 */
function record(value,keys) {
  if(!value || typeof value!=="object" || Array.isArray(value) || Object.keys(value).some(key=>!keys.includes(key))) throw new Error("Invalid TypeScript project runner request.");
}

/**
 * @lang zh-CN 标准SDK内存请求转成本轮拥有的项目组和输出定位；验证完成前不创建输出。
 * @lang en Convert a standard SDK in-memory request into owned project groups/output locators without creating output before validation.
 * @param {object} request - 标准SDK请求。 Standard SDK request.
 * @returns {Promise<object>} 真实授权根与已核相对输出。 Real authorized root and validated relative outputs.
 */
async function normalize(request) {
  record(request,["workspaceRoot","outputDirectory","inputs","options","profileIds"]);
  if(typeof request.workspaceRoot!=="string" || !path.isAbsolute(request.workspaceRoot) || typeof request.outputDirectory!=="string" || !path.isAbsolute(request.outputDirectory)) throw new Error("Invalid project runtime directories.");
  // <lang><zh-CN>授权根固定物理身份；输出先核词法包含关系，再沿物理根逐级检查链接。</zh-CN><en>Fix the authorized root's physical identity; check output lexical containment before inspecting links component by component.</en></lang>
  const workspaceRoot=await fs.realpath(request.workspaceRoot);
  const outputRelative=path.relative(path.resolve(request.workspaceRoot),path.resolve(request.outputDirectory)).split(path.sep).join("/");
  safeRelative(outputRelative);
  const outputDirectory=path.join(workspaceRoot,outputRelative);
  // <lang><zh-CN>输入组与选项均显式限界，默认语言不产生翻译；源码内容政策固定none。</zh-CN><en>Groups/options are explicitly bounded; the default locale creates no translations, and source-content policy stays none.</en></lang>
  if(!Array.isArray(request.inputs) || !request.inputs.length || request.inputs.length>1000) throw new Error("Invalid project input groups.");
  const options=request.options ?? {};
  record(options,["defaultLocale","emitDocSourceMap","writeResultManifest","extractionVersion"]);
  // <lang><zh-CN>新表达式模型必须精确选择，未声明仍使用0.2项目链。</zh-CN><en>The expression model requires exact selection; omission retains the 0.2 project chain.</en></lang>
  if(options.extractionVersion!==undefined && !["0.2.0-draft","0.3.0-draft"].includes(options.extractionVersion)) throw new Error("Unsupported project extraction version.");
  if(options.defaultLocale!==undefined && (typeof options.defaultLocale!=="string" || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(options.defaultLocale))) throw new Error("Invalid project locale.");
  for(const key of ["emitDocSourceMap","writeResultManifest"]) if(options[key]!==undefined && typeof options[key]!=="boolean") throw new Error("Invalid project boolean option.");
  const profileIds=request.profileIds ?? ["tsdoc"];
  if(!Array.isArray(profileIds) || !profileIds.length || new Set(profileIds).size!==profileIds.length || profileIds.some(id=>typeof id!=="string" || !/^[a-z0-9][a-z0-9._-]*$/.test(id))) throw new Error("Invalid project profiles.");
  // <lang><zh-CN>按SDK的paths定位器聚合一次项目语义，而不是把每个文件当孤立扫描输入。</zh-CN><en>Group the SDK paths locator into one project semantic extraction instead of scanning each file in isolation.</en></lang>
  const inputs=request.inputs.map((input,index)=>{
    record(input,["kind","paths","artifactBasePath","title"]);
    if(input.kind!=="typescript-project" || !Array.isArray(input.paths) || !input.paths.length || input.paths.length>1000 || new Set(input.paths).size!==input.paths.length) throw new Error("Invalid project input.");
    const entries=input.paths.map(safeRelative);
    const base=safeRelative(input.artifactBasePath ?? (request.inputs.length===1 ? "project" : `project-${index+1}`));
    if(input.title!==undefined && (typeof input.title!=="string" || !input.title.trim())) throw new Error("Invalid project title.");
    return {entries,base,title:input.title ?? "TypeScript Project"};
  });
  // <lang><zh-CN>所有工件名和结果清单在写入前统一查重，Windows按宿主大小写规则保守比较。</zh-CN><en>Check all artifact names and the result manifest for collisions before writing, conservatively using Windows case rules.</en></lang>
  const names=inputs.flatMap(input=>[`${input.base}.tsdoc.json`,`${input.base}.hia.json`,`${input.base}.jsdoc-bridge.json`,...(options.emitDocSourceMap!==false ? [`${input.base}.docmap.json`] : [])]);
  if(options.writeResultManifest!==false) names.push("tsdoc.project-producer-result.json");
  const comparison=names.map(name=>process.platform==="win32" ? name.toLowerCase() : name);
  comparison.sort();
  if(comparison.some((name,index)=>index>0 && (name===comparison[index-1] || name.startsWith(comparison[index-1]+"/")))) throw new Error("Project artifact paths collide.");
  return {workspaceRoot,outputDirectory,inputs,options,profileIds,names};
}

/**
 * @lang zh-CN 输出根内逐级建立真实目录并拒绝符号链接/junction；静态预检不保证对抗并发换向。
 * @lang en Create real directories component by component and refuse symlinks/junctions; static preflight does not defeat concurrent adversarial swaps.
 * @param {string} root - 已核物理根。 Validated physical root.
 * @param {string} directory - 词法包含的目标目录。 Lexically contained target directory.
 * @returns {Promise<void>} 可安全静态访问。 Statically safe access.
 */
async function safeDirectory(root,directory) {
  const relative=path.relative(root,directory);
  if(relative===".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Project output escapes its root.");
  // <lang><zh-CN>只在缺失时创建本路径分量，不用recursive跨过未知链接。</zh-CN><en>Create only a missing owned path component without recursively traversing unknown links.</en></lang>
  let current=root;
  for(const part of relative.split(path.sep).filter(Boolean)) {
    current=path.join(current,part);
    let state;
    try {state=await fs.lstat(current);} catch(error) {if(error?.code!=="ENOENT") throw error;await fs.mkdir(current);state=await fs.lstat(current);}
    if(state.isSymbolicLink() || !state.isDirectory()) throw new Error("Project output contains a linked directory.");
  }
}

/**
 * @lang zh-CN 写入前核验相对工件的父级和已存在文件，拒绝链接/硬链接/非普通文件。
 * @lang en Check artifact parents and any existing file before writing, refusing symbolic/hard links and nonregular files.
 * @param {object} request - 本轮已核请求。 Validated request.
 * @param {string} name - 相对输出定位器。 Relative output locator.
 * @returns {Promise<string>} 实际文件路径，仅在运行时使用。 Actual file path for runtime use only.
 */
async function safeFile(request,name) {
  const target=path.join(request.outputDirectory,safeRelative(name));
  await safeDirectory(request.workspaceRoot,path.dirname(target));
  try {const state=await fs.lstat(target);if(state.isSymbolicLink() || !state.isFile() || state.nlink!==1) throw new Error("Project output target is linked.");}
  catch(error) {if(error?.code!=="ENOENT") throw error;}
  return target;
}

/**
 * @lang zh-CN 写单个已核JSON工件，旧文件可覆盖但不执行全目录清理；不承诺多文件事务。
 * @lang en Write one validated JSON artifact, allowing replacement without directory cleanup or a multi-file transaction promise.
 * @param {object} request - 本轮请求。 Request.
 * @param {string} name - 相对输出。 Relative output.
 * @param {object} value - 可序列化工件。 Serializable artifact.
 * @returns {Promise<void>} 写入完成。 Write completion.
 */
async function writeJson(request,name,value) {
  const target=await safeFile(request,name);
  await fs.writeFile(target,JSON.stringify(value,null,2)+"\n","utf8");
}

/**
 * @lang zh-CN 以实际通用内核执行项目组并返回SDK1.0结果；无JS发射/普通地图/坐标证明，消费者必须遵循本轮清单。
 * @lang en Execute project groups through the generic core and return an SDK 1.0 result, without JS emission/ordinary maps/coordinate proof; consumers must honor this run's manifest.
 * @param {object} request - SDK标准请求，输入kind为typescript-project，paths为相对入口数组。 Standard SDK request with typescript-project inputs and relative entry paths.
 * @param {object} [context] - 可选进度/中止信号；同步编译期间不能强杀进程。 Optional progress/abort context; synchronous extraction cannot be forcibly interrupted.
 * @returns {Promise<object>} documentation-producer-result1.0.0。 documentation-producer-result 1.0.0.
 * @throws {Error} 请求或输出预检失败；旧磁盘文件不表示本轮成功。 Request/output preflight failure; old disk files do not imply success for this run.
 */
export async function runTsDocProject(request,context={}) {
  // <lang><zh-CN>先完成整轮请求及所有输出预检，任一链接/碰撞都不能先覆写部分工件。</zh-CN><en>Preflight the full request and all outputs so a link/collision cannot overwrite earlier artifacts first.</en></lang>
  const normalized=await normalize(request);
  for(const name of normalized.names) await safeFile(normalized,name);
  const artifacts=[];
  const diagnostics=[];
  let completed=0;
  for(const [index,input] of normalized.inputs.entries()) {
    if(context.signal?.aborted) {diagnostics.push({code:"TSDOC_PROJECT_ABORTED",severity:"error",message:"Project extraction was aborted."});break;}
    context.reportProgress?.({phase:"extract",current:index,total:normalized.inputs.length,message:input.entries[0]});
    try {
      // <lang><zh-CN>抽取只调用通用内核，错误组不登记成功工件；公开失败固定化，私有根不进入结果。</zh-CN><en>Extraction calls only the generic core; error groups register no successful artifacts, and fixed failure messages exclude private roots.</en></lang>
      const extraction=extractTsDocProject({workspaceRoot:normalized.workspaceRoot,entrypoints:input.entries,defaultLocale:normalized.options.defaultLocale ?? "en",contractVersion:normalized.options.extractionVersion ?? "0.2.0-draft"});
      diagnostics.push(...extraction.diagnostics);
      if(extraction.diagnostics.some(item=>item.severity==="error")) continue;
      if(context.signal?.aborted) {diagnostics.push({code:"TSDOC_PROJECT_ABORTED",severity:"error",message:"Project extraction was aborted."});break;}
      // <lang><zh-CN>同一基名派生并实际写出提取/桥接/HIA/地图，所有互引定位与契约版本一致。</zh-CN><en>Derive and write extraction/bridge/HIA/maps from one base, with matching locators and contract versions.</en></lang>
      const extractionPath=`${input.base}.tsdoc.json`;
      const hiaPath=`${input.base}.hia.json`;
      const bridgePath=`${input.base}.jsdoc-bridge.json`;
      const mapPath=`${input.base}.docmap.json`;
      const bridge=readTsJsDocBridgeArtifact(tsDocToJsDocBridgeArtifact(extraction));
      const document=tsDocToHiaDocument(extraction,{id:`tsdoc-project:${index+1}`,title:input.title,...(normalized.options.emitDocSourceMap!==false ? {docSourceMapPath:mapPath,docSourceMapContractVersion:"1.1.0"} : {})});
      const outputs=[{path:extractionPath,kind:"tsdoc-extraction",contract:extraction.contract,contractVersion:extraction.contractVersion,value:extraction},{path:bridgePath,kind:"ts-jsdoc-bridge",contract:bridge.contract,contractVersion:bridge.contractVersion,value:bridge},{path:hiaPath,kind:"hia-document",contract:"hia-core-document",contractVersion:document.schemaVersion,value:document}];
      if(normalized.options.emitDocSourceMap!==false) outputs.push({path:mapPath,kind:"doc-source-map",contract:"doc-source-map",contractVersion:"1.1.0",value:createTsDocProjectSourceMap(extraction,{extractionPath,hiaDocumentPath:hiaPath,jsDocBridgePath:bridgePath})});
      for(const output of outputs) await writeJson(normalized,output.path,output.value);
      // <lang><zh-CN>只在该组全部写完后公布定位器；部分IO失败留下的磁盘文件不会被清单登记为成功。</zh-CN><en>Publish locators only after every group output is written; files left by partial I/O failure are not registered as successful.</en></lang>
      artifacts.push(...outputs.map((output,number)=>({id:`tsdoc-project-${index+1}-${number+1}`,kind:output.kind,path:output.path,contract:output.contract,contractVersion:output.contractVersion,language:"json",mediaType:"application/json",profileIds:normalized.profileIds})));
      completed++;
    } catch {diagnostics.push({code:"TSDOC_PROJECT_INPUT_FAILED",severity:"error",message:"TypeScript project input could not be processed."});}
  }
  // <lang><zh-CN>状态遵循SDK成功/部分/失败规则；结果清单有独立名字，不覆盖旧编译模式的结果。
  // </zh-CN><en>Status follows SDK success/partial/failure rules; a separate manifest name preserves the legacy compilation result.</en></lang>
  const errors=diagnostics.some(item=>item.severity==="error");
  const result={contract:"documentation-producer-result",contractVersion:"1.0.0",producer:{id:"tsdoc-project",version:"0.1.3"},status:errors ? (artifacts.length ? "partial" : "failed") : "success",artifacts,diagnostics};
  if(normalized.options.writeResultManifest!==false) await writeJson(normalized,"tsdoc.project-producer-result.json",result);
  context.reportProgress?.({phase:"complete",current:completed,total:normalized.inputs.length});
  return result;
}
