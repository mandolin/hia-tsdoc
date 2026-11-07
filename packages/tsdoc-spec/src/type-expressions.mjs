/**
 * @file
 * @lang zh-CN 0.3类型表达式身份与来源树校验，精确旧版本由原读取器处理。
 * @lang en Identities and provenance-tree validation for 0.3 type expressions; the original reader handles exact legacy versions.
 */

/**
 * @lang zh-CN 显式结构化提取、桥接及profile的草案身份。
 * @lang en Explicit draft identity for structured extraction, bridging and profiles.
 */
export const TSDOC_STRUCTURED_PROJECT_VERSION = "0.3.0-draft";

/**
 * @lang zh-CN 四种结构角色及其固定种类与名称，不能借角色产生运行时事实。
 * @lang en Four structural roles with fixed kinds and names, without runtime facts.
 */
export const TSDOC_TYPE_EXPRESSION_KINDS = Object.freeze({
  object: "ts-type-literal",
  union: "ts-union-type",
  intersection: "ts-intersection-type",
  opaque: "ts-type-expression"
});

/**
 * @lang zh-CN 显式泛型与数组包装版本，旧0.3身份和种类独立保留。
 * @lang en Explicit generic/array wrapper version, retaining independent 0.3 identities and kinds.
 */
export const TSDOC_WRAPPED_PROJECT_VERSION = "0.4.0-draft";
/**
 * @lang zh-CN 0.4扩展角色，目标名只记录语法，不认定内建类型或求值语义。
 * @lang en Extended 0.4 roles, with target names recording syntax without builtin identity or evaluated semantics.
 */
export const TSDOC_WRAPPED_TYPE_EXPRESSION_KINDS = Object.freeze({
  ...TSDOC_TYPE_EXPRESSION_KINDS,
  application:"ts-type-application",
  array:"ts-array-type",
  "type-operator":"ts-type-operator"
});

/**
 * @lang zh-CN 核0.3实际来源树、分支及显式模式，不读取源码或证明生产者身份。
 * @lang en Checks the 0.3 provenance tree, branches and explicit mode without reading sources or authenticating producers.
 * @param {object} artifact <lang><zh-CN>已通过项目公共结构检查的工件。</zh-CN><en>Artifact already checked for common project structure.</en></lang>
 * @returns {void} <lang><zh-CN>结构一致时返回。</zh-CN><en>Returns for a consistent structure.</en></lang>
 * @throws {Error} <lang><zh-CN>版本标记、树、范围或角色无效，固定文案不回显输入。</zh-CN><en>Invalid mode marker, tree, range or role, using fixed messages without input reflection.</en></lang>
 */
export function validateTypeExpressions(artifact) {
  const wrapped=artifact.contractVersion===TSDOC_WRAPPED_PROJECT_VERSION;
  const kinds=wrapped ? TSDOC_WRAPPED_TYPE_EXPRESSION_KINDS : TSDOC_TYPE_EXPRESSION_KINDS;
  if (artifact.metadata?.typeExpressions !== artifact.contractVersion) {
    throw new Error("Invalid structured TypeScript project mode.");
  }
  // <lang><zh-CN>唯一ID已由公共读取器验证，这里建立父项和顺序索引以核完整分支。</zh-CN><en>The common reader verified unique IDs; index parents and source order to check complete branches.</en></lang>
  const byId = new Map(artifact.symbols.map(symbol => [symbol.id, symbol]));
  const children = new Map();
  for (const symbol of artifact.symbols) {
    if (symbol.parentId) {
      const members = children.get(symbol.parentId) ?? [];
      members.push(symbol);
      children.set(symbol.parentId, members);
    }
  }
  // <lang><zh-CN>逐父链核无环，完成集合使宽树校验保持线性，不能把环当作可折叠类型引用。</zh-CN><en>Check parent chains for cycles with a completed set for linear wide-tree validation; cycles are not folded type references.</en></lang>
  const completed = new Set();
  for (const symbol of artifact.symbols) {
    const active = new Set();
    let current = symbol;
    while (current && !completed.has(current.id)) {
      if (active.has(current.id)) throw new Error("Cyclic structured TypeScript tree.");
      active.add(current.id);
      current = byId.get(current.parentId);
    }
    for (const id of active) completed.add(id);
  }
  for (const symbol of artifact.symbols) {
    // <lang><zh-CN>物理子范围必须属于同一源和父范围；注释范围另由原读取器校验。</zh-CN><en>A physical child range belongs to the same source and its parent range; the common reader checks comment ranges separately.</en></lang>
    const parent = byId.get(symbol.parentId);
    const expression = symbol.metadata.typeExpression;
    if (parent && (expression || parent.metadata.typeExpression) && (symbol.source.path !== parent.source.path || compare(symbol.source.range.start, parent.source.range.start) < 0 || compare(symbol.source.range.end, parent.source.range.end) > 0)) {
      throw new Error("Invalid structured TypeScript containment.");
    }
    const structural = Object.values(kinds).includes(symbol.kind);
    if (structural !== Boolean(expression)) throw new Error("Invalid TypeScript expression role.");
    if (expression) {
      const names = {object: "object", union: "union", intersection: "intersection", opaque: "type",application:"application",array:"array","type-operator":"readonly"};
      const syntax = {object: "TypeLiteral", union: "UnionType", intersection: "IntersectionType",application:"TypeReference",array:"ArrayType","type-operator":"TypeOperator"};
      const keys=wrapped ? ["operator","syntaxKind","branchIndex","argumentIndex","targetName","typeOperator"] : ["operator","syntaxKind","branchIndex"];
      if (symbol.kind !== kinds[expression.operator] || symbol.name !== names[expression.operator]
          || symbol.classification !== "type-only" || !parent || symbol.exported !== false || Object.hasOwn(symbol,"comment")
          || typeof symbol.signature !== "string" || !symbol.signature.trim()
          || expression.syntaxKind !== symbol.metadata.syntaxKind
          || typeof expression.syntaxKind !== "string" || !expression.syntaxKind
          || syntax[expression.operator] && expression.syntaxKind !== syntax[expression.operator]
          || expression.operator === "opaque" && ["TypeLiteral","UnionType","IntersectionType","ParenthesizedType"].includes(expression.syntaxKind)
          || wrapped && expression.operator==="opaque" && expression.syntaxKind==="ArrayType"
          || Object.keys(expression).some(key => !keys.includes(key))) {
        throw new Error("Invalid TypeScript expression metadata.");
      }
      const parentOperator = parent.metadata.typeExpression?.operator;
      const branching = parentOperator === "union" || parentOperator === "intersection";
      if(!parentOperator && parent.metadata.typeExpressionRoot!==true) throw new Error("Missing TypeScript expression owner.");
      if (branching !== Object.hasOwn(expression, "branchIndex") || branching && (!Number.isSafeInteger(expression.branchIndex) || expression.branchIndex < 0)) {
        throw new Error("Invalid TypeScript branch index.");
      }
      // <lang><zh-CN>泛型实参和包装属性必须只出现在对应角色，避免丢序或伪造内建readonly语义。</zh-CN><en>Arguments and wrapper attributes belong only to their roles, preventing lost order or fabricated builtin readonly semantics.</en></lang>
      if(wrapped) {
        const argument=parentOperator==="application";
        if(argument!==Object.hasOwn(expression,"argumentIndex") || argument && (!Number.isSafeInteger(expression.argumentIndex)||expression.argumentIndex<0)) throw new Error("Invalid TypeScript argument index.");
        if((expression.operator==="application")!==Object.hasOwn(expression,"targetName") || expression.operator==="application" && (typeof expression.targetName!=="string"||!expression.targetName.trim())) throw new Error("Invalid TypeScript application target.");
        if((expression.operator==="type-operator")!==Object.hasOwn(expression,"typeOperator") || expression.operator==="type-operator" && expression.typeOperator!=="readonly") throw new Error("Invalid TypeScript type operator.");
      }
      const members = children.get(symbol.id) ?? [];
      if (expression.operator === "union" || expression.operator === "intersection") {
        if (members.length < 2 || members.some((member, index) => member.metadata.typeExpression?.branchIndex !== index
            || index > 0 && compare(member.source.range.start, members[index - 1].source.range.end) < 0)) {
          throw new Error("Invalid TypeScript branch coverage.");
        }
      } else if (expression.operator === "opaque" && members.length) {
        throw new Error("Opaque TypeScript expressions cannot contain members.");
      } else if (expression.operator === "object" && members.some(member => member.metadata.typeExpression || !["PropertySignature","MethodSignature","IndexSignature","CallSignature","ConstructSignature"].includes(member.metadata.syntaxKind))) {
        throw new Error("Invalid TypeScript object membership.");
      } else if(expression.operator==="application") {
        if(!members.length || members.some((member,index)=>member.metadata.typeExpression?.argumentIndex!==index || index>0&&compare(member.source.range.start,members[index-1].source.range.end)<0)) throw new Error("Invalid TypeScript application arguments.");
      } else if(expression.operator==="array" || expression.operator==="type-operator") {
        if(members.length!==1 || !members[0].metadata.typeExpression) throw new Error("Invalid TypeScript wrapper operand.");
      }
    }
    // <lang><zh-CN>别名及显式标记的属性必须恰好拥有一个类型根，拒绝仅换版本或重复投影。</zh-CN><en>Aliases and explicitly marked properties must own exactly one type root, rejecting relabeling and duplicate projections.</en></lang>
    if(Object.hasOwn(symbol.metadata,"typeExpressionRoot") && (symbol.metadata.typeExpressionRoot!==true || !["TypeAliasDeclaration","PropertySignature","PropertyDeclaration","IndexSignature"].includes(symbol.metadata.syntaxKind))) throw new Error("Invalid TypeScript expression owner role.");
    if (symbol.metadata.syntaxKind === "TypeAliasDeclaration" || symbol.metadata.typeExpressionRoot) {
      const members = children.get(symbol.id) ?? [];
      if (symbol.metadata.typeExpressionRoot !== true || members.length !== 1 || !members[0].metadata.typeExpression || Object.hasOwn(members[0].metadata.typeExpression, "branchIndex") || wrapped && Object.hasOwn(members[0].metadata.typeExpression,"argumentIndex")) {
        throw new Error("Invalid TypeScript expression root.");
      }
    }
  }
}

/**
 * @lang zh-CN 比较同源一基位置，保持原UTF-16列单位。
 * @lang en Compares same-source one-based positions in their original UTF-16 column units.
 * @param {object} left <lang><zh-CN>左位置。</zh-CN><en>Left position.</en></lang>
 * @param {object} right <lang><zh-CN>右位置。</zh-CN><en>Right position.</en></lang>
 * @returns {number} <lang><zh-CN>负、零、正的顺序。</zh-CN><en>Negative, zero or positive ordering.</en></lang>
 */
function compare(left, right) {
  return left.line - right.line || left.column - right.column;
}
