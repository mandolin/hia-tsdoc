/**
 * @lang zh-CN 通用TypeScript项目抽取：使用已固定原生编译器语义，保留公开绑定的逐声明事实，不执行输入代码或输出JS。
 * @lang en Generic TypeScript project extraction using the pinned native compiler semantics, retaining each declaration of public bindings without executing input code or emitting JS.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { API, SymbolFlags } from "typescript/unstable/sync";
import { SyntaxKind } from "typescript/unstable/ast";
import { parseTSDocComment } from "./index.mjs";
import {TSDOC_STRUCTURED_PROJECT_VERSION,TSDOC_TYPE_EXPRESSION_KINDS} from "@hia-doc/tsdoc-spec";

/**
 * @lang zh-CN 核验并标准化显式工作区内的相对路径，绝不展开点段或编码。
 * @lang en Validate explicit workspace-relative paths without expanding dot segments or encodings.
 * @param {string} value - 输入相对路径。 Input relative path.
 * @returns {string} 已核相对路径。 Validated relative path.
 */
function relativePath(value) {
  if(typeof value!=="string" || !value || /[\\:%?#\u0000-\u001f\u007f]/.test(value) || path.posix.normalize(value)!==value || value.split("/").some(part=>!part || part===".." || part===".") || path.isAbsolute(value)) throw new Error("Invalid TypeScript project path.");
  return value;
}

/**
 * @lang zh-CN 核验物理目录包含关系，符号链接不得扩大源码许可。
 * @lang en Check physical directory containment so symlinks cannot expand source authority.
 * @param {string} root - 已真实解析根。 Realpath root.
 * @param {string} target - 真实目标。 Physical target.
 * @returns {boolean} 是否属于允许目录。 Whether the target is contained.
 */
function inside(root,target) { const value=path.relative(root,target); return value==="" || !value.startsWith(".."+path.sep) && value!==".." && !path.isAbsolute(value); }

/**
 * @lang zh-CN 将实际原生节点位置保留为一基UTF-16、终点排除范围；不标准化原始换行。
 * @lang en Preserve native node coordinates as one-based UTF-16 exclusive-end ranges without normalizing source line endings.
 * @param {object} node - 当前快照AST节点。 AST node from this snapshot.
 * @returns {object} 实际声明范围。 Actual declaration range.
 */
function nodeRange(node) {
  // <lang><zh-CN>位置来自同一原始SourceFile，编译器的零基偏移只转换一次为一基坐标。</zh-CN><en>Positions come from the same original SourceFile, converting compiler zero-based coordinates to one-based exactly once.</en></lang>
  const source=node.getSourceFile();
  const start=source.getLineAndCharacterOfPosition(node.getStart(source));
  const end=source.getLineAndCharacterOfPosition(node.end);
  return {start:{line:start.line+1,column:start.character+1},end:{line:end.line+1,column:end.character+1}};
}

/**
 * @lang zh-CN 保留当前声明自己的文档块，变量共享所在变量语句的实际文档，不按上一物理行猜测。
 * @lang en Retain the current declaration's own documentation blocks; variables use their real variable-statement documentation rather than guessing from the previous line.
 * @param {object} node - 当前声明。 Current declaration.
 * @param {string} locale - 默认正文语言。 Default content locale.
 * @returns {object | undefined} 已解析注释与实际范围。 Parsed comment and actual range.
 */
function commentFor(node,locale) {
  // <lang><zh-CN>变量文档附着在变量语句，其余节点只认自身jsDoc；最后附着块提供摘要。</zh-CN><en>Variable docs attach to the variable statement; other nodes use their own jsDoc, with the last attached block supplying the summary.</en></lang>
  const owner=node.kind===SyntaxKind.VariableDeclaration ? node.parent.parent : node;
  const comments=owner.jsDoc ?? [];
  const doc=comments.at(-1);
  if(!doc) return undefined;
  const parsed=parseTSDocComment(doc.getText(),{defaultLocale:locale});
  // <lang lang="zh-CN">每个块字段调用同一既有双语解析器，避免把remarks/参数等压成摘要。</lang><lang lang="en">Each block field uses the existing bilingual parser so remarks/parameters cannot collapse into the summary.</lang>
  const fields={...(parsed.i18n?.fields ?? {})};
  for(const tag of owner.jsDoc?.flatMap(item=>item.tags ?? []) ?? []) {
    const name=tag.tagName?.text;
    // <lang lang="zh-CN">TSDoc自定义typeParam没有JSDoc专用name节点，取实际tag文本中的参数名。</lang><lang lang="en">Custom TSDoc typeParam tags lack a JSDoc name node, so read the parameter name from the actual tag text.</lang>
    const raw=tag.getText().replace(/^@\S+\s*/,"").replace(/\n\s*\*\s?/g,"\n");
    const parameter=tag.name?.getText() ?? raw.match(/^\S+/)?.[0];
    const base=name==="param" ? `params.${parameter}.description` : name==="typeParam" || name==="template" ? `typeParams.${parameter}.description` : name==="returns" || name==="return" ? "returns" : name==="remarks" ? "remarks" : name==="throws" || name==="exception" ? "throws" : name==="example" ? "examples" : undefined;
    if(!base) continue;
    // <lang><zh-CN>重复块按字段序号保留，不能覆盖先前的throws或example；参数名来自当前标签。</zh-CN><en>Retain repeated blocks under indexed fields instead of overwriting earlier throws/examples; parameter names come from the current tag.</en></lang>
    const count=Object.keys(fields).filter(key=>key===base || key.startsWith(base+".")).length;
    const key=["throws","examples"].includes(base) || count>0 ? `${base}.${count}` : base;
    const text=["param","typeParam","template"].includes(name) ? raw.replace(/^(?:\S+)\s*(?:-\s*)?/,"") : raw;
    const value=parseTSDocComment("/** "+text.replaceAll("*/","* /")+" */",{defaultLocale:locale});
    // <lang lang="zh-CN">无多语言标记时保留原字段换行，代码示例不能因摘要解析而变成一行。</lang><lang lang="en">Preserve original field line breaks without locale markers; summary parsing must not flatten code examples.</lang>
    const field=value.i18n?.fields.description ?? {fieldPath:key,kind:"text",defaultLocale:locale,defaultText:text.trim(),localizedText:{[locale]:text.trim()},source:"tsdoc.comment"};
    fields[key]={...field,fieldPath:key};
  }
  if(!fields.description) fields.description={fieldPath:"description",kind:"text",defaultLocale:locale,defaultText:parsed.summary ?? "",localizedText:{[locale]:parsed.summary ?? ""},source:"tsdoc.comment"};
  // <lang lang="zh-CN">重定位复用解析器的字段与分段身份；可省略的空key/path不写入新版核心数据。</lang><lang lang="en">Relocate reused parser field/segment identities and omit empty optional key/path values from new core data.</lang>
  for(const [fieldPath,field] of Object.entries(fields)) {
    for(const block of field.blocks ?? []) block.fieldPath=fieldPath;
    for(const [index,segment] of (field.segments ?? []).entries()) {
      segment.fieldPath=fieldPath;
      segment.id=`${fieldPath}.${index}`;
      if(!segment.key) delete segment.key;
      if(!segment.path) delete segment.path;
    }
  }
  return {...parsed,range:nodeRange(doc),rangeConvention:{endBoundary:"exclusive",columnUnit:"utf16-code-unit"},i18n:{enabled:true,model:"hia-text-i18n",modelVersion:"0.2.0",defaultLocale:locale,locales:[...new Set(Object.values(fields).flatMap(field=>Object.keys(field.localizedText)))],fields}};
}

/**
 * @lang zh-CN 从节点构造无函数实现正文的声明签名；类型由实际语法或编译器类型查询提供。
 * @lang en Build declaration signatures without function bodies, using actual syntax or compiler type queries.
 * @param {object} node - AST声明。 AST declaration.
 * @param {object} checker - 同快照类型查询器。 Checker from the same snapshot.
 * @returns {string} 可读声明签名。 Readable declaration signature.
 */
function signatureFor(node,checker) {
  // <lang><zh-CN>变量不输出初始化器；函数只取body起点前的真实声明，类型别名保留右侧类型。</zh-CN><en>Variables exclude initializers; functions retain the actual declaration before the body, while aliases retain their right-hand type.</en></lang>
  const source=node.getSourceFile();
  if(node.kind===SyntaxKind.VariableDeclaration) return `${node.parent.getText().split(/\s/)[0]} ${node.name.getText()}: ${node.type?.getText() ?? checker.typeToString(checker.getTypeAtLocation(node))}`;
  const end=node.body?.getStart(source) ?? (node.members ? node.members.pos : node.end);
  return source.text.slice(node.getStart(source),end).trim().replace(/[;{]\s*$/,"").trim();
}

/**
 * @lang zh-CN 通过原生TypeScript7读取显式项目的公开导出，逐声明保留重载/合并；不会运行源码或发出产物代码。
 * @lang en Read explicit project exports through native TypeScript 7, retaining overloads/merges per declaration without executing sources or emitting code.
 * @param {object} request - 显式抽取请求。 Explicit extraction request.
 * @param {string} request.workspaceRoot - 允许读取源码的目录。 Authorized source root.
 * @param {string[]} request.entrypoints - 相对模块入口，最多1000个。 Relative module entries, at most 1000.
 * @param {string} [request.defaultLocale="en"] - 原注释默认语言，不产生翻译。 Original comment locale, without translation generation.
 * @param {string} [request.contractVersion="0.2.0-draft"] <lang><zh-CN>精确项目身份，0.3显式生成类型表达式。</zh-CN><en>Exact project identity, explicitly selecting type expressions with 0.3.</en></lang>
 * @returns {object} 独立0.2.0-draft提取工件；未解析绑定保留error诊断。 Independent 0.2.0-draft extraction, retaining errors for unresolved bindings.
 * @throws {Error} 路径、输入数量、文件或编译器处理失败；固定诊断不回显本机路径。 Invalid paths, counts, files, or compiler processing, without machine-path disclosure.
 */
export function extractTsDocProject(request) {
  // <lang><zh-CN>调用方必须精确选择新模式，省略保留原项目工件及树形。</zh-CN><en>Callers select the new mode exactly; omission retains original project artifacts and trees.</en></lang>
  const version=request?.contractVersion===undefined ? "0.2.0-draft" : request.contractVersion;
  if(!["0.2.0-draft",TSDOC_STRUCTURED_PROJECT_VERSION].includes(version)) throw new Error("Unsupported TypeScript project version.");
  const structured=version===TSDOC_STRUCTURED_PROJECT_VERSION;
  // <lang lang="zh-CN">错误只返回固定公开说明；真实根仅供本次编译器读取边界使用。</lang><lang lang="en">Return fixed public errors; the real root serves only this compiler read boundary.</lang>
  let root;
  try {root=fs.realpathSync(request?.workspaceRoot);} catch {throw new Error("Invalid TypeScript project root.");}
  if(!Array.isArray(request.entrypoints) || request.entrypoints.length===0 || request.entrypoints.length>1000 || new Set(request.entrypoints).size!==request.entrypoints.length) throw new Error("Invalid TypeScript project entries.");
  // <lang><zh-CN>入口必须显式且物理位于授权根；不通过glob扩大范围或接受符号链接逃逸。</zh-CN><en>Entries must be explicit and physically inside the authorized root, without glob expansion or symlink escape.</en></lang>
  const entries=request.entrypoints.map(relativePath);
  for(const entry of entries) {try {if(!inside(root,fs.realpathSync(path.join(root,entry)))) throw new Error();} catch {throw new Error("Invalid TypeScript project path.");}}
  // <lang><zh-CN>语言仅描述原注释，格式校验不会生成译文或读取系统语言。</zh-CN><en>The locale describes original comments only; validation neither translates nor reads system language settings.</en></lang>
  const locale=request.defaultLocale ?? "en";
  if(typeof locale!=="string" || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) throw new Error("Invalid TypeScript project locale.");
  // <lang lang="zh-CN">虚拟项目配置避免扫描磁盘tsconfig；仅工作区源码及编译器自带库可读。</lang><lang lang="en">A virtual project config avoids ambient tsconfig discovery; only workspace sources and compiler libraries are readable.</lang>
  const compilerRoot=fs.realpathSync(path.dirname(createRequire(import.meta.url).resolve("typescript/package.json")));
  const config=path.join(root,".hia-tsdoc-project.virtual.json");
  const configText=JSON.stringify({compilerOptions:{target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",noEmit:true,skipLibCheck:true},files:entries});
  // <lang lang="zh-CN">原生客户端跨平台使用正斜杠，先按本机路径语义比较虚拟配置身份。</lang><lang lang="en">The native client uses forward slashes across platforms; compare virtual-config identity using host path semantics.</lang>
  const isConfig=file=>path.relative(config,path.resolve(file))==="";
  // <lang><zh-CN>每次读前解析真实路径，同时允许固定编译器自带lib；其它外部声明不可读取。</zh-CN><en>Resolve physical paths before reads, allowing the pinned compiler's own lib files but no other external declarations.</en></lang>
  const allowed=file=>{
    try {const physical=fs.realpathSync(file);return inside(root,physical) || inside(compilerRoot,physical);} catch {return false;}
  };
  // <lang><zh-CN>只读文件系统限制单文件大小并严格解码UTF-8；虚拟配置仅存在内存中。</zh-CN><en>The read-only filesystem bounds individual files and strictly decodes UTF-8; virtual configuration exists only in memory.</en></lang>
  const filesystem={
    fileExists:file=>isConfig(file) || allowed(file) && fs.statSync(file).isFile(),
    directoryExists:file=>allowed(file) && fs.statSync(file).isDirectory(),
    readFile:file=>isConfig(file) ? configText : allowed(file) && fs.statSync(file).isFile() && fs.statSync(file).size<=4*1024*1024 ? new TextDecoder("utf-8",{fatal:true}).decode(fs.readFileSync(file)) : null,
    getAccessibleEntries:directory=>allowed(directory) && fs.statSync(directory).isDirectory() ? {files:fs.readdirSync(directory,{withFileTypes:true}).filter(item=>item.isFile()).map(item=>item.name),directories:fs.readdirSync(directory,{withFileTypes:true}).filter(item=>item.isDirectory()).map(item=>item.name)} : {files:[],directories:[]},
    realpath:file=>allowed(file) ? fs.realpathSync(file) : file
  };
  // <lang><zh-CN>API与快照只属于本次调用，finally在成功和失败时都释放原生进程资源。</zh-CN><en>The API and snapshot belong to this invocation; finally releases native process resources on both success and failure.</en></lang>
  const api=new API({cwd:root,fs:filesystem});
  let snapshot;
  try {
    snapshot=api.updateSnapshot({openProjects:[config]});
    const project=snapshot.getProject(config);
    if(!project) throw new Error();
    // <lang><zh-CN>所有符号/模块积累在单一编译器快照；checker不跨项目缓存。</zh-CN><en>Accumulate all symbols/modules in one compiler snapshot without caching its checker across projects.</en></lang>
    const checker=project.checker;
    const symbols=[];
    const modules=[];
    const diagnostics=[];
    // <lang lang="zh-CN">正在遍历的真实声明防止命名空间别名环；正常独立公开别名仍分别生成。</lang><lang lang="en">Track active physical declarations to stop namespace-alias cycles while retaining independent public aliases.</lang>
    const activeDeclarations=new Set();
    /**
     * @lang zh-CN 每条声明独立生成身份；成员保留父声明关系，私有成员不进入公开文档。
     * @lang en Give every declaration its own identity; members retain parentage and private members stay out of public documentation.
     * @param {object} node - 声明节点。 Declaration node.
     * @param {string} name - 公开名。 Public name.
     * @param {string} modulePath - 公开入口。 Public entry.
     * @param {string} [parentId] - 父声明身份。 Parent declaration identity.
     * @param {boolean} [bindingTypeOnly=false] - 入口是否显式仅导出类型。 Whether the entry explicitly exports only the type.
     * @returns {string | undefined} 实际生成身份；不支持时为undefined并诊断。 Emitted identity, or undefined with a diagnostic for unsupported syntax.
     */
    function addDeclaration(node,name,modulePath,parentId,bindingTypeOnly=false) {
      // <lang><zh-CN>将物理声明转为公开相对来源，依赖包声明不能伪装为项目源码。</zh-CN><en>Convert physical declarations into public relative sources; dependency declarations cannot masquerade as project source.</en></lang>
      const source=node.getSourceFile();
      const sourcePath=path.relative(root,source.fileName).split(path.sep).join("/");
      if(sourcePath.startsWith("../") || sourcePath.startsWith("node_modules/")) {diagnostics.push({code:"TSDOC_AST_DECLARATION_OUTSIDE_SOURCE",severity:"error",message:"Declaration is outside authorized project sources."});return undefined;}
      // <lang><zh-CN>递归保护仅按物理声明判断环，最终身份另含入口/别名/父项以保留多路公开绑定。</zh-CN><en>Detect recursion by physical declaration, while final identities also include entry/alias/parent to retain multiple public bindings.</en></lang>
      const declarationKey=JSON.stringify([sourcePath,node.getStart(source),node.end]);
      if(activeDeclarations.has(declarationKey)){diagnostics.push({code:"TSDOC_AST_DECLARATION_CYCLE",severity:"error",message:"Declaration expansion contains a cycle.",path:sourcePath});return undefined;}
      activeDeclarations.add(declarationKey);
      // <lang><zh-CN>语法白名单显式拒绝未实现节点，不能以默认函数种类吞掉未知声明。</zh-CN><en>An explicit syntax allowlist rejects unimplemented nodes instead of silently treating unknown declarations as functions.</en></lang>
      const syntax=SyntaxKind[node.kind];
      const kinds={VariableDeclaration:node.parent.getText().startsWith("const ") ? "ts-runtime-constant" : "ts-runtime-variable",FunctionDeclaration:"ts-runtime-function",ClassDeclaration:"ts-runtime-class",InterfaceDeclaration:"ts-interface",TypeAliasDeclaration:"ts-type-alias",EnumDeclaration:"ts-runtime-enum",ModuleDeclaration:"ts-namespace",PropertySignature:"ts-property",PropertyDeclaration:"ts-property",MethodSignature:"ts-method",MethodDeclaration:"ts-method",Constructor:"ts-constructor",GetAccessor:"ts-accessor",SetAccessor:"ts-accessor",CallSignature:"ts-call-signature",ConstructSignature:"ts-construct-signature",IndexSignature:"ts-index-signature",EnumMember:"ts-enum-member"};
      if(!kinds[syntax]){activeDeclarations.delete(declarationKey);diagnostics.push({code:"TSDOC_AST_DECLARATION_UNSUPPORTED",severity:"error",message:"Declaration syntax is not supported.",path:sourcePath,data:{syntaxKind:syntax}});return undefined;}
      // <lang><zh-CN>分类包含入口type-only事实；声明ID是确定性摘要，不嵌入本机根或源码正文。</zh-CN><en>Classification includes type-only export facts; deterministic declaration IDs embed neither machine roots nor source bodies.</en></lang>
      const typeOnly=bindingTypeOnly || source.isDeclarationFile || ["InterfaceDeclaration","TypeAliasDeclaration","PropertySignature","MethodSignature","CallSignature","ConstructSignature","IndexSignature"].includes(syntax);
      const id="ast:"+createHash("sha256").update(JSON.stringify([modulePath,name,sourcePath,node.getStart(source),node.end,parentId ?? null])).digest("hex");
      const comment=commentFor(node,locale);
      symbols.push({id,name,kind:kinds[syntax],classification:typeOnly ? "type-only" : "runtime",exported:!parentId,...(parentId ? {parentId} : {}),signature:signatureFor(node,checker),source:{path:sourcePath,range:nodeRange(node),rangeSource:"typescript-ast",rangeConvention:{endBoundary:"exclusive",columnUnit:"utf16-code-unit"},confidence:"high"},...(comment ? {comment} : {}),metadata:{syntaxKind:syntax,modulePath},runtime:{emitted:false,emitStatus:"unverified",jsName:name}});
      // <lang><zh-CN>0.3类型别名和属性经独立表达式根保留分支；旧版仍走原直接成员投影。</zh-CN><en>0.3 aliases and properties retain branches through an expression root; legacy mode keeps its direct-member projection.</en></lang>
      const typed=structured && node.type && ["TypeAliasDeclaration","PropertySignature","PropertyDeclaration","IndexSignature"].includes(syntax);
      const expandType=typed && (syntax==="TypeAliasDeclaration" || isStructuredType(node.type));
      if(expandType) {
        symbols.at(-1).metadata.typeExpressionRoot=true;
        addTypeExpression(node.type,modulePath,id);
      } else if(typed && hasTypeMembers(node.type)) {
        diagnostics.push({code:"TSDOC_TYPE_EXPRESSION_UNSUPPORTED",severity:"error",message:"Type expression contains unsupported anonymous members.",path:sourcePath});
      }
      // <lang><zh-CN>表达式已拥有匿名成员时不再重复添加；其它声明仍复用原直接成员列表。</zh-CN><en>Do not duplicate anonymous members already owned by an expression; other declarations reuse the original direct-member list.</en></lang>
      const members=expandType ? [] : node.members ?? node.type?.members ?? [];
      for(const member of members) {
        // <lang lang="zh-CN">仅按实际访问修饰符隐藏private；保护成员保留其修饰符与声明，不执行初始化器。</lang><lang lang="en">Hide explicit private members; protected members retain modifiers and declarations without evaluating initializers.</lang>
        if(member.modifiers?.some(modifier=>modifier.kind===SyntaxKind.PrivateKeyword) || member.name?.kind===SyntaxKind.PrivateIdentifier) continue;
        addDeclaration(member,member.name?.getText() ?? SyntaxKind[member.kind],modulePath,id,typeOnly);
      }
      if(node.kind===SyntaxKind.ModuleDeclaration) {
        // <lang lang="zh-CN">命名空间成员由同快照的公开导出表裁决，未导出局部值不会被当成公开成员。</lang><lang lang="en">Namespace members use the same snapshot's export table, excluding unexported local values.</lang>
        const namespace=checker.getSymbolAtLocation(node.name);
        for(const exposed of namespace ? checker.getExportsOfModule(namespace) : []) {
          const actual=exposed.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(exposed) : exposed;
          for(const handle of actual.declarations ?? []) {const declaration=handle.resolve(project);if(declaration)addDeclaration(declaration,exposed.name,modulePath,id,typeOnly);}
        }
      }
      if(symbols.length>20000) throw new Error();
      activeDeclarations.delete(declarationKey);
      return id;
    }
    /**
     * @lang zh-CN 括号透明识别对象、联合和交叉，不按源码文本猜语义。
     * @lang en Recognizes objects, unions and intersections through transparent parentheses without textual guesses.
     * @param {object} node <lang><zh-CN>原生类型节点。</zh-CN><en>Native type node.</en></lang>
     * @returns {boolean} <lang><zh-CN>是否需结构化展开。</zh-CN><en>Whether structural expansion is needed.</en></lang>
     */
    function isStructuredType(node) {
      while(node.kind===SyntaxKind.ParenthesizedType) node=node.type;
      return [SyntaxKind.TypeLiteral,SyntaxKind.UnionType,SyntaxKind.IntersectionType].includes(node.kind);
    }
    /**
     * @lang zh-CN 不透明类型下若有可文档化成员便拒绝，避免数组或函数包装隐藏源码节点。
     * @lang en Refuses opaque types containing documentable members, preventing arrays or functions from hiding source nodes.
     * @param {object} node <lang><zh-CN>待检查类型。</zh-CN><en>Type to inspect.</en></lang>
     * @returns {boolean} <lang><zh-CN>是否含实际成员。</zh-CN><en>Whether physical members occur.</en></lang>
     */
    function hasTypeMembers(node) {
      if(node.members?.length) return true;
      return Boolean(node.forEachChild(child=>hasTypeMembers(child) || undefined));
    }
    /**
     * @lang zh-CN 生成有限类型树，分支按原顺序编号，结构节点只有源码签名和范围。
     * @lang en Builds a bounded type tree with source-ordered branch indices and source-only signatures/ranges for structural nodes.
     * @param {object} node <lang><zh-CN>实际类型节点。</zh-CN><en>Actual type node.</en></lang>
     * @param {string} modulePath <lang><zh-CN>公开入口。</zh-CN><en>Public entry.</en></lang>
     * @param {string} parentId <lang><zh-CN>已生成父项。</zh-CN><en>Emitted parent.</en></lang>
     * @param {number} [branchIndex] <lang><zh-CN>联合或交叉的零基分支。</zh-CN><en>Zero-based union/intersection branch.</en></lang>
     * @returns {void} <lang><zh-CN>追加实际结构节点及成员。</zh-CN><en>Appends actual structure and member nodes.</en></lang>
     */
    function addTypeExpression(node,modulePath,parentId,branchIndex) {
      // <lang><zh-CN>括号保留在父签名内，表达式自身使用内层节点的精确范围。</zh-CN><en>Parent signatures retain parentheses while expressions use precise inner-node ranges.</en></lang>
      while(node.kind===SyntaxKind.ParenthesizedType) node=node.type;
      const source=node.getSourceFile();
      const sourcePath=path.relative(root,source.fileName).split(path.sep).join("/");
      const syntax=SyntaxKind[node.kind];
      const operator=({TypeLiteral:"object",UnionType:"union",IntersectionType:"intersection"})[syntax] ?? "opaque";
      if(operator==="opaque" && hasTypeMembers(node)) {
        diagnostics.push({code:"TSDOC_TYPE_EXPRESSION_UNSUPPORTED",severity:"error",message:"Type expression contains unsupported anonymous members.",path:sourcePath});
        return;
      }
      // <lang><zh-CN>身份区分结构角色及父项，重复分支名和多公开别名不会覆盖；派生节点计入原总预算。</zh-CN><en>Identities distinguish roles and parents so repeated names and public aliases cannot collide; derived nodes count against the original total budget.</en></lang>
      const id="ast:"+createHash("sha256").update(JSON.stringify(["type-expression",modulePath,sourcePath,node.getStart(source),node.end,parentId])).digest("hex");
      symbols.push({
        id,name:operator==="opaque" ? "type" : operator,kind:TSDOC_TYPE_EXPRESSION_KINDS[operator],classification:"type-only",exported:false,parentId,
        signature:node.getText(),source:{path:sourcePath,range:nodeRange(node),rangeSource:"typescript-ast",rangeConvention:{endBoundary:"exclusive",columnUnit:"utf16-code-unit"},confidence:"high"},
        metadata:{syntaxKind:syntax,modulePath,typeExpression:{operator,syntaxKind:syntax,...(branchIndex!==undefined ? {branchIndex} : {})}},
        runtime:{emitted:false,emitStatus:"unverified"}
      });
      if(symbols.length>20000) throw new Error();
      if(operator==="object") {
        for(const member of node.members) addDeclaration(member,member.name?.getText() ?? SyntaxKind[member.kind],modulePath,id,true);
      } else if(operator==="union" || operator==="intersection") {
        for(const [index,branch] of node.types.entries()) addTypeExpression(branch,modulePath,id,index);
      }
    }
    for(const entry of entries) {
      // <lang><zh-CN>入口语法错误固定化为公开诊断；导出表由checker裁决，不靠文本匹配入口文件。</zh-CN><en>Entry syntax errors become fixed public diagnostics; the checker resolves exports instead of text matching entry files.</en></lang>
      const source=project.program.getSourceFile(path.join(root,entry));
      if(!source) throw new Error();
      for(const error of project.program.getSyntacticDiagnostics(path.join(root,entry))) diagnostics.push({code:"TSDOC_AST_SYNTAX_ERROR",severity:"error",message:"Source contains a syntax error.",path:entry,data:{compilerCode:error.code}});
      const module=checker.getSymbolAtLocation(source);
      const exports=[];
      for(const exposed of module ? checker.getExportsOfModule(module) : []) {
        // <lang lang="zh-CN">公开别名只追踪静态声明，不导入或执行目标模块；缺失声明不得生成虚假符号。</lang><lang lang="en">Follow static declarations for aliases without importing/evaluating targets; absent declarations cannot create fake symbols.</lang>
        const actual=exposed.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(exposed) : exposed;
        // <lang lang="zh-CN">值声明经export type公开时仍属类型绑定；不能因追到类原声明就声称运行时导出。</lang><lang lang="en">A value declaration exposed through export type remains a type-only binding; resolving its class declaration cannot imply a runtime export.</lang>
        const bindingTypeOnly=(exposed.declarations ?? []).some(handle=>{const declaration=handle.resolve(project);return declaration?.isTypeOnly || declaration?.parent?.parent?.isTypeOnly;});
        const symbolIds=[];
        for(const handle of actual.declarations ?? []) {const node=handle.resolve(project);if(node){const id=addDeclaration(node,exposed.name,entry,undefined,bindingTypeOnly);if(id)symbolIds.push(id);}}
        if(!symbolIds.length) diagnostics.push({code:"TSDOC_AST_EXPORT_UNRESOLVED",severity:"error",message:"Export has no supported authorized declaration.",path:entry,data:{exportName:exposed.name}});
        exports.push({name:exposed.name,declarationName:actual.name,symbolIds});
      }
      modules.push({path:entry,exports:exports.sort((a,b)=>a.name.localeCompare(b.name,"en"))});
    }
    return {contract:"hia-tsdoc-extraction",contractVersion:version,producer:{name:"@hia-doc/ts-doc-extractor",version:"0.1.3",backend:"typescript-native-7.0.2"},profile:{id:"ts-jsdoc-bridge",version},source:{path:entries[0],language:"typescript",sourcesContentPolicy:"none"},artifacts:[],defaultLocale:locale,locales:[...new Set([locale,...symbols.flatMap(symbol=>symbol.comment?.i18n?.locales ?? [])])],modules,symbols,comments:symbols.filter(symbol=>symbol.comment).map(symbol=>({symbolId:symbol.id,...symbol.comment})),diagnostics,metadata:{extractor:{name:"@hia-doc/ts-doc-extractor",mode:"typescript-native-project"},...(structured ? {typeExpressions:version} : {}),ordinarySourceMapStatus:"not-produced",sourcesContentPolicy:"none"}};
  } catch {throw new Error("TypeScript project extraction failed.");}
  finally {snapshot?.dispose();api.close();}
}
