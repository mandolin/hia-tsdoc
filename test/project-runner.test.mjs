/**
 * @lang zh-CN 通用项目运行器/桥接的真实原生链回归，不执行目标模块。
 * @lang en Native-chain regressions for the generic project runner/bridge without executing target modules.
 */
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {test} from "node:test";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {extractTsDocProject} from "../packages/ts-doc-extractor/src/project.mjs";
import {tsDocToJsDocBridgeArtifact,readTsJsDocBridgeArtifact} from "../packages/ts-jsdoc-bridge/src/index.mjs";
import {runTsDocProject} from "../packages/tsdoc-runner/src/project.mjs";
import {runTsDoc} from "../packages/tsdoc-runner/src/index.mjs";
import {tsdocProjectProducer} from "../packages/tsdoc-producer/src/index.mjs";

/**
 * @lang zh-CN 在本仓忽略临时目录创建唯一合成项目，调用方只写自己拥有的文件。
 * @lang en Create a unique synthetic project in this repository's ignored temporary directory, writing only owned files.
 * @returns {Promise<object>} 根和标准SDK请求。 Root and standard SDK request.
 */
async function fixture() {
  // <lang><zh-CN>真实根避免Windows短名影响，输入含执行即抛错的模块和完整双语字段。</zh-CN><en>A real root avoids Windows short-name effects; input includes a module that throws if executed and complete bilingual fields.</en></lang>
  const parent=fileURLToPath(new URL("../temp/",import.meta.url));
  await fs.mkdir(parent,{recursive:true});
  const root=await fs.realpath(await fs.mkdtemp(path.join(parent,"project-runner-")));
  await fs.writeFile(path.join(root,"index.ts"),'export * from "./api.js";');
  await fs.writeFile(path.join(root,"api.ts"),'throw new Error("Do not execute");\n/** Value.\n * @param value - <lang><en>Input.</en><zh-CN>输入。</zh-CN></lang>\n * @returns <lang><en>Output.</en><zh-CN>输出。</zh-CN></lang>\n */ export function identity<T>(value:T):T {return value;}\nexport const COUNT=3; export interface Item { id:string; }');
  return {root,request:{workspaceRoot:root,outputDirectory:path.join(root,"out"),inputs:[{kind:"typescript-project",paths:["index.ts"],artifactBasePath:"api/project"}]}};
}

test("new bridge retains full symbols and fields without fabricated JS, legacy remains readable",async()=>{
  const {root}=await fixture();
  const extraction=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  const before=JSON.stringify(extraction);
  const bridge=tsDocToJsDocBridgeArtifact(extraction);
  assert.equal(bridge.contractVersion,"0.2.0-draft");
  assert.equal(bridge.artifact,null);
  const symbols=[...bridge.runtimeSymbols,...bridge.typeOnlySymbols];
  assert.equal(symbols.length,extraction.symbols.length);
  assert.deepEqual(bridge.metadata.symbolOrder,extraction.symbols.map(item=>item.id));
  assert.deepEqual(bridge.locales,extraction.locales);
  assert(symbols.some(item=>item.name==="id" && item.parentId));
  assert.deepEqual(symbols.find(item=>item.name==="identity").comment,extraction.symbols.find(item=>item.name==="identity").comment);
  assert.equal(symbols.find(item=>item.name==="identity").comment.i18n.fields["params.value.description"].localizedText["zh-CN"],"输入。");
  assert(bridge.runtimeSymbols.every(item=>item.bridgeStatus==="not-emitted"));
  assert.equal(JSON.stringify(extraction),before);
  assert.strictEqual(readTsJsDocBridgeArtifact(bridge),bridge);
  assert.throws(()=>tsDocToJsDocBridgeArtifact(extraction,{jsPath:"made-up.js"}));
  const legacy=JSON.parse(await fs.readFile(new URL("../fixtures/doc-source-map/ts-js/dist/calculator.jsdoc-bridge.json",import.meta.url),"utf8"));
  assert.strictEqual(readTsJsDocBridgeArtifact(legacy),legacy);
  assert.throws(()=>readTsJsDocBridgeArtifact({...legacy,contractVersion:"0.2.0-draft"}));
  assert.throws(()=>readTsJsDocBridgeArtifact({...bridge,contractVersion:"9.0.0"}));
});

test("runner and producer emit coherent project artifacts and real bridge/map references",async()=>{
  const {request}=await fixture();
  const result=await runTsDocProject(request);
  assert.equal(result.contractVersion,"1.0.0");
  assert.equal(result.status,"success",JSON.stringify(result.diagnostics));
  assert.equal(result.producer.id,"tsdoc-project");
  assert.equal(result.artifacts.length,4);
  assert(result.artifacts.every(item=>/^[a-z0-9][a-z0-9._-]*$/.test(item.id)));
  const read=async kind=>JSON.parse(await fs.readFile(path.join(request.outputDirectory,result.artifacts.find(item=>item.kind===kind).path),"utf8"));
  const document=await read("hia-document");
  const map=await read("doc-source-map");
  assert(document.symbols.some(item=>item.name==="COUNT"));
  assert(document.symbols.some(item=>item.name==="Item"));
  assert(map.sources.some(item=>item.path==="api.ts"));
  assert(map.artifacts.some(item=>item.contractRefs?.some(ref=>ref.contract==="hia-ts-jsdoc-bridge" && ref.contractVersion==="0.2.0-draft")));
  assert(!result.artifacts.some(item=>item.kind==="generated-js"));
  assert.equal(tsdocProjectProducer.descriptor.contractVersion,"1.0.0");
  assert.equal((await tsdocProjectProducer.produce(request)).status,"success");
  assert.equal((await runTsDoc(request)).producer.id,"tsdoc-project");
  const manifest=JSON.parse(await fs.readFile(path.join(request.outputDirectory,"tsdoc.project-producer-result.json"),"utf8"));
  assert.equal(manifest.status,"success");
});

test("project CLI is explicit and refuses unsupported legacy compiler/config flags",async()=>{
  const {root}=await fixture();
  const cli=fileURLToPath(new URL("../packages/tsdoc-runner/src/cli.mjs",import.meta.url));
  const run=args=>spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:"utf8"});
  const result=run(["--project","--out-dir","cli-out","index.ts"]);
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(await fs.readFile(path.join(root,"cli-out/project.tsdoc.json"),"utf8")).contractVersion,"0.2.0-draft");
  for(const args of [["--project","--coordinate-profile","index.ts"],["--project","--target","ES2020","index.ts"],["--project","--config","missing.json","index.ts"]]) assert.notEqual(run(args).status,0);
});

test("extraction errors, cancellation and mixed inputs never claim project success",async()=>{
  const {root,request}=await fixture();
  await fs.writeFile(path.join(root,"broken.ts"),'export {missing} from "./absent.js";');
  const result=await runTsDocProject({...request,inputs:[{kind:"typescript-project",paths:["broken.ts"]}]});
  assert.equal(result.status,"failed");
  assert.deepEqual(result.artifacts,[]);
  assert(result.diagnostics.some(item=>item.severity==="error"));
  assert(!JSON.stringify(result).includes(root));
  const aborted=await runTsDocProject(request,{signal:AbortSignal.abort()});
  assert.equal(aborted.status,"failed");
  assert(aborted.diagnostics.some(item=>item.code==="TSDOC_PROJECT_ABORTED"));
  await assert.rejects(runTsDocProject({...request,inputs:[...request.inputs,{kind:"typescript-entry",path:"index.ts"}]}));
});

test("project path and output boundaries reject traversal, aliases and collisions before output",async()=>{
  const {root,request}=await fixture();
  for(const change of [
    item=>{item.inputs[0].paths=["../outside.ts"];},
    item=>{item.outputDirectory=path.dirname(root);},
    item=>{item.inputs=[...item.inputs,structuredClone(item.inputs[0])];},
    item=>{item.options={sourcesContentPolicy:"embed"};},
    item=>{item.options={unknown:true};}
  ]) {const value=structuredClone(request);change(value);await assert.rejects(runTsDocProject(value));}
  await assert.rejects(fs.access(request.outputDirectory),{code:"ENOENT"});
  const external=path.join(root,"outside");
  await fs.mkdir(external);
  await fs.symlink(external,request.outputDirectory,process.platform==="win32" ? "junction" : "dir");
  await assert.rejects(runTsDocProject(request));
  assert.deepEqual(await fs.readdir(external),[]);
});

test("partial groups keep only written outputs, disabled mapping leaves no phantom reference",async()=>{
  const {root,request}=await fixture();
  await fs.writeFile(path.join(root,"broken.ts"),'export {missing} from "./absent.js";');
  const partial=await runTsDocProject({...request,inputs:[...request.inputs,{kind:"typescript-project",paths:["broken.ts"],artifactBasePath:"broken"}]});
  assert.equal(partial.status,"partial");
  assert.equal(partial.artifacts.length,4);
  assert(partial.artifacts.every(item=>item.path.startsWith("api/project.")));
  const result=await runTsDocProject({...request,options:{emitDocSourceMap:false,writeResultManifest:false}});
  assert.equal(result.status,"success");
  assert.equal(result.artifacts.length,3);
  const document=JSON.parse(await fs.readFile(path.join(request.outputDirectory,"api/project.hia.json"),"utf8"));
  assert.deepEqual(document.metadata.docSourceMaps,[]);
});

test("linked existing files and file/directory collisions fail before replacing any artifact",async()=>{
  const {root,request}=await fixture();
  const collision={...request,inputs:[{kind:"typescript-project",paths:["index.ts"],artifactBasePath:"first"},{kind:"typescript-project",paths:["index.ts"],artifactBasePath:"first.tsdoc.json/nested"}]};
  await assert.rejects(runTsDocProject(collision),/collide/);
  await assert.rejects(fs.access(request.outputDirectory),{code:"ENOENT"});
  await fs.mkdir(path.join(request.outputDirectory,"api"),{recursive:true});
  const retained=path.join(root,"retained.json");
  await fs.writeFile(retained,"retained");
  await fs.link(retained,path.join(request.outputDirectory,"api/project.hia.json"));
  await assert.rejects(runTsDocProject(request),/linked/);
  assert.equal(await fs.readFile(retained,"utf8"),"retained");
  await assert.rejects(fs.access(path.join(request.outputDirectory,"api/project.tsdoc.json")),{code:"ENOENT"});
});

test("project bridge rejects corrupt binding relations and never mutates the extraction",async()=>{
  const {root}=await fixture();
  const extraction=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  const bridge=tsDocToJsDocBridgeArtifact(extraction);
  for(const change of [value=>{value.artifact={path:"invented.js"};},value=>{value.modules[0].exports[0].symbolIds=["absent"];},value=>{value.runtimeSymbols[0].bridgeStatus="emitted";}]) {
    const copy=structuredClone(bridge);change(copy);assert.throws(()=>readTsJsDocBridgeArtifact(copy));
  }
  assert.throws(()=>tsDocToJsDocBridgeArtifact(extraction,[]));
  assert.deepEqual(readTsJsDocBridgeArtifact(JSON.parse(JSON.stringify(bridge))),bridge);
});
