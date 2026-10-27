import {
  TSDocConfiguration,
  TSDocParser,
  TSDocTagDefinition,
  TSDocTagSyntaxKind
} from "@microsoft/tsdoc";

import {
  TSDOC_CLASSIFICATIONS,
  TSDOC_EXTRACTION_CONTRACT,
  TSDOC_EXTRACTION_CONTRACT_VERSION,
  TSDOC_PROFILE_VERSION,
  TSDOC_SYMBOL_KINDS,
  isTSDocTag,
  normalizeTSDocTag
} from "@hia-doc/tsdoc-spec";

const tsdocConfiguration = new TSDocConfiguration();
const performanceTagDefinition = new TSDocTagDefinition({
  tagName: "@performance",
  syntaxKind: TSDocTagSyntaxKind.BlockTag,
  allowMultiple: true
});
const langTagDefinition = new TSDocTagDefinition({
  tagName: "@lang",
  syntaxKind: TSDocTagSyntaxKind.BlockTag,
  allowMultiple: true
});
tsdocConfiguration.addTagDefinition(performanceTagDefinition);
tsdocConfiguration.addTagDefinition(langTagDefinition);

const parser = new TSDocParser(tsdocConfiguration);
const DEFAULT_LOCALE = "en";
const HIA_TEXT_I18N_MODEL = "hia-text-i18n";
const HIA_TEXT_I18N_MODEL_VERSION = "0.2.0";

/**
 * @lang zh-CN 从单个 TypeScript 源文件提取 TSDoc 草案；保守扫描器识别不同名顶层导出函数、类、接口和类型别名，包括同行声明。复杂语法、同名重载及合并仍不保证，且本函数不写文件。
 * @lang en Extracts a draft TSDoc artifact from one TypeScript file. The conservative scanner recognizes distinct-name top-level exported functions, classes, interfaces, and aliases, including same-line declarations. Complex syntax, same-name overloads, and merging remain unsupported; this function writes no files.
 * @param {string} source <lang><zh-CN>TypeScript 源码正文，换行将标准化，列数按 UTF-16 计算。</zh-CN><en>TypeScript source text, with normalized line endings and UTF-16 columns.</en></lang>
 * @param {{ path?: string, generatedJsPath?: string, sourcesContentPolicy?: string }} [options] <lang><zh-CN>安全相对源路径、可选生成产物路径与源码正文策略。</zh-CN><en>Safe relative source path, optional generated artifact path, and source-content policy.</en></lang>
 * @returns {object} <lang><zh-CN>`hia-tsdoc-extraction` 草案工件；未写磁盘。</zh-CN><en>Draft `hia-tsdoc-extraction` artifact without writing to disk.</en></lang>
 * @throws {Error} <lang><zh-CN>源或生成产物路径不安全时抛错。</zh-CN><en>Throws when a source or generated artifact path is unsafe.</en></lang>
 */
export function extractTsDoc(source, options = {}) {
  const sourcePath = normalizeSourcePath(options.path ?? "input.ts");
  const defaultLocale = normalizeLocale(options.defaultLocale) || DEFAULT_LOCALE;
  // <lang><zh-CN>统一换行后保留 JavaScript UTF-16 偏移，供同一物理行的多个声明共享定位基准。</zh-CN><en>Normalize line endings while retaining JavaScript UTF-16 offsets for multiple declarations on one physical line.</en></lang>
  const sourceText = String(source).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = sourceText.split("\n");
  const lineStarts = sourceLineStarts(sourceText);
  // <lang><zh-CN>仅顶层代码里的 export 与真实 TSDoc 块参与提取；字符串、模板、注释及嵌套体不产生符号。</zh-CN><en>Only top-level code exports and real TSDoc blocks participate; strings, templates, comments, and nested bodies cannot create symbols.</en></lang>
  const { exportOffsets, docComments } = scanTopLevelExports(sourceText);
  const symbols = [];
  const comments = [];
  const diagnostics = [];

  for (const [position, offset] of exportOffsets.entries()) {
    // <lang><zh-CN>每个顶层 export 按其真实列偏移识别，下一项即使同行也会限制当前范围。</zh-CN><en>Recognize each top-level export at its actual column; the next item bounds the current range even on the same line.</en></lang>
    const start = sourceOffsetPosition(lineStarts, offset);
    const declaration = parseDeclaration(lines, start.lineIndex, start.columnIndex);
    if (!declaration) {
      continue;
    }
    const nextOffset = exportOffsets[position + 1];
    const nextStart = nextOffset === undefined ? null : sourceOffsetPosition(lineStarts, nextOffset);
    const sourceRange = declarationRange(lines, start.lineIndex, start.columnIndex, declaration, nextStart);
    const comment = extractAttachedComment(sourceText, lineStarts, docComments, offset, { defaultLocale });
    const symbol = createSymbol({
      declaration,
      sourcePath,
      sourceRange
    });

    if (comment) {
      symbol.comment = {
        range: comment.range,
        summary: comment.summary,
        tags: comment.tags,
        ...(comment.i18n ? { i18n: comment.i18n } : {}),
        parserDiagnostics: comment.parserDiagnostics
      };
      comments.push({
        symbolId: symbol.id,
        range: comment.range,
        summary: comment.summary,
        tags: comment.tags,
        ...(comment.i18n ? { i18n: comment.i18n } : {}),
        parserDiagnostics: comment.parserDiagnostics
      });
      diagnostics.push(...comment.parserDiagnostics.map((message) => ({
        code: "TSDOC_PARSER_MESSAGE",
        severity: "warning",
        message: message.text,
        path: sourcePath,
        data: {
          messageId: message.messageId,
          symbolId: symbol.id
        }
      })));
    }

    symbols.push(symbol);
  }

  return {
    contract: TSDOC_EXTRACTION_CONTRACT,
    contractVersion: TSDOC_EXTRACTION_CONTRACT_VERSION,
    producer: {
      name: "@hia-doc/ts-doc-extractor",
      version: "0.1.3"
    },
    profile: {
      name: "tsdoc",
      version: TSDOC_PROFILE_VERSION
    },
    defaultLocale,
    locales: collectLocales([defaultLocale, ...symbols.flatMap((symbol) => symbol.comment?.i18n?.locales ?? [])]),
    source: {
      kind: "typescript",
      path: sourcePath,
      language: "typescript",
      sourcesContentPolicy: options.sourcesContentPolicy ?? "none"
    },
    artifacts: options.generatedJsPath
      ? [
          {
            id: "artifact:js:generated",
            kind: "generated-js",
            path: normalizeSourcePath(options.generatedJsPath),
            language: "javascript"
          }
        ]
      : [],
    symbols,
    comments,
    diagnostics,
    metadata: {
      extractor: {
        name: "@hia-doc/ts-doc-extractor",
        mode: "ts7-cli-fixture-scanner"
      },
      tsdoc: {
        parser: "@microsoft/tsdoc"
      },
      typeOnlyBoundary: "type-only symbols remain in TS extraction artifact and adapter metadata in P1",
      compilerApiNote: "TypeScript 7 public package entry no longer exposes the legacy compiler API; P1 uses tsc output and a conservative declaration scanner."
    }
  };
}

/**
 * Parses one raw TSDoc/JSDoc-style block comment into summary, tags and parser diagnostics.
 *
 * @lang zh-CN 将一个原始块注释解析为摘要、标签与 TSDoc parser 诊断；该函数不读取源码上下文。
 * @param {string} rawComment Raw block comment text, including delimiters.
 * @returns {{ summary: string | null, tags: object[], parserDiagnostics: object[] }} Parsed comment metadata.
 */
export function parseTSDocComment(rawComment, options = {}) {
  const text = String(rawComment);
  const defaultLocale = normalizeLocale(options.defaultLocale) || DEFAULT_LOCALE;
  const parserContext = parser.parseString(text);
  const normalizedLines = stripComment(text);
  const summaryLines = [];
  const tags = [];

  for (const line of normalizedLines) {
    const tagMatch = /^@([A-Za-z][\w-]*)(?:\s+(.*))?$/.exec(line);
    if (tagMatch) {
      const tag = normalizeTSDocTag(tagMatch[1]);
      tags.push({
        tag,
        value: (tagMatch[2] ?? "").trim(),
        known: isTSDocTag(tag)
      });
      continue;
    }
    if (tags.length === 0 && line) {
      summaryLines.push(line);
    }
  }

  const summary = summaryLines.join(" ").trim() || null;
  const i18n = createDescriptionI18n(summary, tags, defaultLocale, "tsdoc.comment");

  return {
    summary: i18n?.fields.description?.defaultText ?? summary,
    tags,
    ...(i18n ? { i18n } : {}),
    parserDiagnostics: parserContext.log.messages
      .filter((message) => !isAllowedLangParserMessage(message.text))
      .map((message) => ({
      messageId: message.messageId,
      text: message.text
    }))
  };
}

/**
 * @lang zh-CN 记录源码每行的 UTF-16 起点；换行符不计入下一行列数。
 * @lang en Records each line's UTF-16 starting offset so newline characters do not count toward the next column.
 * @param {string} sourceText <lang><zh-CN>已统一为 LF 的源码。</zh-CN><en>Source text normalized to LF.</en></lang>
 * @returns {number[]} <lang><zh-CN>按行排序的零基偏移。</zh-CN><en>Ordered zero-based line offsets.</en></lang>
 */
function sourceLineStarts(sourceText) {
  const starts = [0];
  for (let offset = 0; offset < sourceText.length; offset += 1) {
    if (sourceText[offset] === "\n") starts.push(offset + 1);
  }
  return starts;
}

/**
 * @lang zh-CN 将 UTF-16 绝对偏移转换为零基行列，供范围与注释归属共用。
 * @lang en Converts an absolute UTF-16 offset to zero-based line and column for ranges and comment ownership.
 * @param {number[]} lineStarts <lang><zh-CN>各行起始偏移。</zh-CN><en>Line starting offsets.</en></lang>
 * @param {number} offset <lang><zh-CN>零基 UTF-16 绝对偏移。</zh-CN><en>Zero-based absolute UTF-16 offset.</en></lang>
 * @returns {{lineIndex:number,columnIndex:number}} <lang><zh-CN>零基行列位置。</zh-CN><en>Zero-based line-column position.</en></lang>
 */
function sourceOffsetPosition(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (lineStarts[middle] <= offset) low = middle;
    else high = middle - 1;
  }
  return { lineIndex: low, columnIndex: offset - lineStarts[low] };
}

/**
 * @lang zh-CN 在已支持的词法子集里收集顶层 export 与 TSDoc 块；复杂模板插值和正则语法不宣称完整解析。
 * @lang en Collects top-level exports and TSDoc blocks in the supported lexical subset without claiming full template-interpolation or regular-expression parsing.
 * @param {string} sourceText <lang><zh-CN>标准化源码，索引单位是 UTF-16。</zh-CN><en>Normalized source indexed in UTF-16 units.</en></lang>
 * @returns {{exportOffsets:number[],docComments:{start:number,end:number}[]}} <lang><zh-CN>候选顶层位置和真实文档注释位置。</zh-CN><en>Candidate top-level positions and actual documentation comment positions.</en></lang>
 */
function scanTopLevelExports(sourceText) {
  const exportOffsets = [];
  const docComments = [];
  let braceDepth = 0;
  let parenthesisDepth = 0;
  let bracketDepth = 0;
  let quote = null;
  let escaped = false;
  let regularExpression = false;
  let regularExpressionClass = false;
  let lastCodeCharacter = null;
  let statementBoundary = true;
  let blockCommentStart = -1;
  let lineComment = false;

  // <lang><zh-CN>每个字符只进入一种词法状态；注释和字符串中的伪关键字不会生成符号。</zh-CN><en>Each character belongs to one lexical state; pseudo-keywords in comments and strings cannot create symbols.</en></lang>
  for (let offset = 0; offset < sourceText.length; offset += 1) {
    const character = sourceText[offset];
    const next = sourceText[offset + 1];
    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        if (braceDepth === 0 && parenthesisDepth === 0 && bracketDepth === 0) statementBoundary = true;
      }
      continue;
    }
    if (blockCommentStart >= 0) {
      if (character === "*" && next === "/") {
        if (sourceText[blockCommentStart + 2] === "*") {
          docComments.push({ start: blockCommentStart, end: offset + 2 });
        }
        blockCommentStart = -1;
        offset += 1;
      }
      continue;
    }
    // <lang><zh-CN>表达式起点的简单正则字面量也可能含 export 文本；转义与字符类中的斜线不关闭它。</zh-CN><en>A simple expression-position regular expression may also contain export text; escaped or class-contained slashes do not close it.</en></lang>
    if (regularExpression) {
      if (character === "\n") {
        regularExpression = false;
        regularExpressionClass = false;
      } else if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "[") regularExpressionClass = true;
      else if (character === "]") regularExpressionClass = false;
      else if (character === "/" && !regularExpressionClass) regularExpression = false;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      offset += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockCommentStart = offset;
      offset += 1;
      continue;
    }
    if (character === "/" && (lastCodeCharacter === null || "=(:,!&|?[".includes(lastCodeCharacter))) {
      regularExpression = true;
      regularExpressionClass = false;
      escaped = false;
      statementBoundary = false;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      statementBoundary = false;
      continue;
    }
    // <lang><zh-CN>仅语句起点识别顶层 export；表达式内即使出现关键字形状也不得伪造声明。</zh-CN><en>Recognize top-level export only at a statement boundary; keyword-shaped text inside an expression cannot fabricate a declaration.</en></lang>
    if (statementBoundary && braceDepth === 0 && parenthesisDepth === 0 && bracketDepth === 0
      && sourceText.startsWith("export", offset)
      && !/[\w$]/.test(sourceText[offset - 1] ?? "")
      && !/[\w$]/.test(sourceText[offset + 6] ?? "")) {
      exportOffsets.push(offset);
      statementBoundary = false;
      lastCodeCharacter = "t";
      offset += 5;
      continue;
    }
    if (!/\s/.test(character)) lastCodeCharacter = character;
    if (character === "{") braceDepth += 1;
    else if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (character === "(") parenthesisDepth += 1;
    else if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    else if (character === "[") bracketDepth += 1;
    else if (character === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    if (braceDepth === 0 && parenthesisDepth === 0 && bracketDepth === 0
      && (character === ";" || character === "}" || character === "\n")) statementBoundary = true;
    else if (!/\s/.test(character)) statementBoundary = false;
  }
  return { exportOffsets, docComments };
}

/**
 * @lang zh-CN 从一个已由顶层词法扫描器验证的位置识别当前支持的声明类别。
 * @lang en Recognizes supported declarations from a position already verified by the top-level lexical scanner.
 * @param {string[]} lines <lang><zh-CN>换行标准化后的源码行。</zh-CN><en>Source lines with normalized line endings.</en></lang>
 * @param {number} index <lang><zh-CN>零基起始行。</zh-CN><en>Zero-based starting line.</en></lang>
 * @param {number} columnIndex <lang><zh-CN>零基 UTF-16 起始列。</zh-CN><en>Zero-based UTF-16 starting column.</en></lang>
 * @returns {object | null} <lang><zh-CN>当前支持的声明，或未支持时为空。</zh-CN><en>Supported declaration, or null for unsupported syntax.</en></lang>
 */
function parseDeclaration(lines, index, columnIndex = 0) {
  const line = lines[index].slice(columnIndex);
  if (!/^\s*export\b/.test(line)) {
    return null;
  }
  const declarationHeader = collectDeclarationHeader(lines, index, columnIndex);
  const functionMatch = /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([\s\S]*?)\)/.exec(declarationHeader);
  if (functionMatch) {
    const parameters = normalizeSignatureText(functionMatch[2]);
    return {
      name: functionMatch[1],
      signature: `${functionMatch[1]}(${parameters})`,
      exported: true,
      kind: TSDOC_SYMBOL_KINDS.runtimeFunction,
      classification: TSDOC_CLASSIFICATIONS.runtime,
      idPrefix: "function"
    };
  }

  const classMatch = /^\s*export\s+class\s+([A-Za-z_$][\w$]*)/.exec(line);
  if (classMatch) {
    return {
      name: classMatch[1],
      exported: true,
      kind: TSDOC_SYMBOL_KINDS.runtimeClass,
      classification: TSDOC_CLASSIFICATIONS.runtime,
      idPrefix: "class"
    };
  }

  const interfaceMatch = /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)/.exec(line);
  if (interfaceMatch) {
    return {
      name: interfaceMatch[1],
      exported: true,
      kind: TSDOC_SYMBOL_KINDS.interface,
      classification: TSDOC_CLASSIFICATIONS.typeOnly,
      idPrefix: "interface"
    };
  }

  const typeMatch = /^\s*export\s+type\s+([A-Za-z_$][\w$]*)/.exec(line);
  if (typeMatch) {
    return {
      name: typeMatch[1],
      exported: true,
      kind: TSDOC_SYMBOL_KINDS.typeAlias,
      classification: TSDOC_CLASSIFICATIONS.typeOnly,
      idPrefix: "type"
    };
  }

  return null;
}

/**
 * @lang zh-CN 从指定 UTF-16 列开始保守收集函数参数头，不把同行前一个声明并入签名。
 * @lang en Conservatively collects a function parameter header from the given UTF-16 column without including an earlier same-line declaration.
 * @param {string[]} lines <lang><zh-CN>标准化源码行。</zh-CN><en>Normalized source lines.</en></lang>
 * @param {number} startIndex <lang><zh-CN>零基起始行。</zh-CN><en>Zero-based starting line.</en></lang>
 * @param {number} startColumn <lang><zh-CN>零基起始列。</zh-CN><en>Zero-based starting column.</en></lang>
 * @returns {string} <lang><zh-CN>用于当前保守识别的签名头。</zh-CN><en>Signature header for the current conservative recognition.</en></lang>
 */
function collectDeclarationHeader(lines, startIndex, startColumn = 0) {
  const parts = [];
  // 中文：以括号/引号状态收集函数头，避免默认对象参数中的 `{}` 被误判为函数体开始。
  // English: Track parentheses and quotes so object-literal defaults are not mistaken for function bodies.
  let parenthesisDepth = 0;
  let foundParameterList = false;
  let quote = null;
  let escaped = false;

  for (let index = startIndex; index < Math.min(lines.length, startIndex + 40); index += 1) {
    const text = (index === startIndex ? lines[index].slice(startColumn) : lines[index]).trim();
    parts.push(text);

    for (const character of text) {
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = null;
        }
        continue;
      }

      if (character === "'" || character === '"' || character === "`") {
        quote = character;
        continue;
      }

      if (character === "(") {
        foundParameterList = true;
        parenthesisDepth += 1;
        continue;
      }

      if (character === ")" && foundParameterList) {
        parenthesisDepth -= 1;
        if (parenthesisDepth === 0) {
          return parts.join(" ");
        }
      }
    }

    if (text.endsWith(";")) {
      break;
    }
  }
  return parts.join(" ");
}

function normalizeSignatureText(value) {
  return String(value).replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

function createSymbol({ declaration, sourcePath, sourceRange }) {
  return removeUndefined({
    id: `${declaration.idPrefix}:${declaration.name}`,
    name: declaration.name,
    kind: declaration.kind,
    classification: declaration.classification,
    exported: declaration.exported,
    signature: declaration.signature,
    source: {
      path: sourcePath,
      range: sourceRange,
      rangeSource: "fixture-scanner",
      confidence: "medium"
    },
    runtime: declaration.classification === TSDOC_CLASSIFICATIONS.runtime
      ? {
          emitted: true,
          jsName: declaration.name
        }
      : {
          emitted: false,
          reason: "type-only"
        }
  });
}

/**
 * @lang zh-CN 在当前保守导出声明扫描范围内定位排除式终点；顶层类型分号或函数/类/接口体的闭合为终止条件。
 * @lang en Locates an exclusive end within the current conservative exported-declaration scan; a top-level type semicolon or a closed function/class/interface body terminates it.
 * @param {string[]} lines <lang><zh-CN>已标准化换行的 UTF-16 源码行。</zh-CN><en>UTF-16 source lines with normalized line endings.</en></lang>
 * @param {number} startIndex <lang><zh-CN>导出声明起始的零基行索引。</zh-CN><en>Zero-based line index where the exported declaration starts.</en></lang>
 * @param {number} startColumn <lang><zh-CN>导出声明起始的零基 UTF-16 列。</zh-CN><en>Zero-based UTF-16 column where the exported declaration starts.</en></lang>
 * @param {{kind:string}} declaration <lang><zh-CN>已识别的保守声明类别。</zh-CN><en>Recognized conservative declaration kind.</en></lang>
 * @param {{lineIndex:number,columnIndex:number} | null} nextStart <lang><zh-CN>下一个顶层导出的零基位置，即当前扫描上界。</zh-CN><en>Zero-based position of the next top-level export, bounding this scan.</en></lang>
 * @returns {{start:{line:number,column:number},end:{line:number,column:number}}} <lang><zh-CN>一基行列范围，终点排除；复杂模板字面量和未闭合声明仍仅是扫描器估计。</zh-CN><en>One-based line-column range with an exclusive end; complex template literals and unclosed declarations remain scanner estimates.</en></lang>
 */
function declarationRange(lines, startIndex, startColumn, declaration, nextStart) {
  let endIndex = startIndex;
  let endColumn = startColumn + 1;
  // <lang><zh-CN>分别跟踪签名括号与类型/函数体大括号，以免参数默认对象过早结束声明。</zh-CN><en>Track signature parentheses separately from type/body braces so parameter defaults cannot end a declaration early.</en></lang>
  let parenthesisDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let quote = null;
  let escaped = false;
  let blockComment = false;
  for (let index = startIndex; index < lines.length; index += 1) {
    if (nextStart && index > nextStart.lineIndex) break;
    const line = lines[index];
    // <lang><zh-CN>同一行的下一个导出也会截断本次扫描，绝不按整行填充第一个声明。</zh-CN><en>The next export truncates scanning even on the same line, so the first declaration never fills the whole line.</en></lang>
    const limit = nextStart?.lineIndex === index ? nextStart.columnIndex : line.length;
    const firstColumn = index === startIndex ? startColumn : 0;
    if (limit <= firstColumn) break;
    for (let column = firstColumn; column < limit; column += 1) {
      const character = line[column];
      const next = line[column + 1];
      // <lang><zh-CN>字符串和注释中的标点没有声明边界语义。</zh-CN><en>Punctuation inside strings and comments has no declaration-boundary meaning.</en></lang>
      if (blockComment) {
        if (character === "*" && next === "/") {
          blockComment = false;
          column += 1;
        }
        continue;
      }
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = null;
        }
        continue;
      }
      if (character === "/" && next === "/") break;
      if (character === "/" && next === "*") {
        blockComment = true;
        column += 1;
        continue;
      }
      if (character === "'" || character === '"' || character === "`") {
        quote = character;
        continue;
      }
      if (character === "(") parenthesisDepth += 1;
      if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      if (character === "[") bracketDepth += 1;
      if (character === "]") bracketDepth = Math.max(0, bracketDepth - 1);
      if (character === "{") braceDepth += 1;
      if (character === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
        if (declaration.kind !== TSDOC_SYMBOL_KINDS.typeAlias
          && braceDepth === 0 && parenthesisDepth === 0 && bracketDepth === 0) {
          // <lang><zh-CN>函数返回对象类型后的第二个大括号仍可能是函数体；仅在无后续体时结束。</zh-CN><en>A second brace after an object return type may still start the function body; end only when no following body begins.</en></lang>
          const following = line.slice(column + 1, limit).trimStart()
            || lines.slice(index + 1).find((item) => item.trim())?.trimStart()
            || "";
          if (!following.startsWith("{")) {
            return {
              start: { line: startIndex + 1, column: startColumn + 1 },
              end: { line: index + 1, column: column + 2 }
            };
          }
        }
      }
      if (character === ";" && braceDepth === 0 && parenthesisDepth === 0 && bracketDepth === 0) {
        return {
          start: { line: startIndex + 1, column: startColumn + 1 },
          end: { line: index + 1, column: column + 2 }
        };
      }
    }
    // <lang><zh-CN>无终止符的类型别名保留最后一行内容，不把下一个导出的行或列纳入范围。</zh-CN><en>An unterminated alias keeps its last content line without including the next export line or column.</en></lang>
    if (line.slice(firstColumn, limit).trim()) {
      endIndex = index;
      endColumn = limit + 1;
    }
  }
  return {
    start: { line: startIndex + 1, column: startColumn + 1 },
    end: { line: endIndex + 1, column: endColumn }
  };
}

/**
 * @lang zh-CN 只把紧邻当前导出的真实 TSDoc 块归属于它，防止同行后项复制前项注释。
 * @lang en Attaches only the real TSDoc block immediately preceding this export, so a later same-line item cannot inherit the first comment.
 * @param {string} sourceText <lang><zh-CN>标准化源码。</zh-CN><en>Normalized source.</en></lang>
 * @param {number[]} lineStarts <lang><zh-CN>UTF-16 行起点。</zh-CN><en>UTF-16 line starts.</en></lang>
 * @param {{start:number,end:number}[]} docComments <lang><zh-CN>词法扫描器确认的文档块。</zh-CN><en>Document blocks verified by the lexical scanner.</en></lang>
 * @param {number} declarationOffset <lang><zh-CN>当前导出起始绝对偏移。</zh-CN><en>Absolute offset of the current export.</en></lang>
 * @param {object} options <lang><zh-CN>本地化解析选项。</zh-CN><en>Localization parse options.</en></lang>
 * @returns {object | null} <lang><zh-CN>真实附着注释或空值。</zh-CN><en>Actually attached comment or null.</en></lang>
 */
function extractAttachedComment(sourceText, lineStarts, docComments, declarationOffset, options) {
  // <lang><zh-CN>只考察最近的已闭合 TSDoc；中间若有代码或其它注释，则不沿用旧块。</zh-CN><en>Inspect only the nearest closed TSDoc; intervening code or another comment prevents reuse.</en></lang>
  const candidate = docComments.findLast((item) => item.end <= declarationOffset);
  if (!candidate || sourceText.slice(candidate.end, declarationOffset).trim()) return null;
  const raw = sourceText.slice(candidate.start, candidate.end);
  const start = sourceOffsetPosition(lineStarts, candidate.start);
  const end = sourceOffsetPosition(lineStarts, candidate.end);
  return {
    raw,
    range: {
      start: { line: start.lineIndex + 1, column: start.columnIndex + 1 },
      end: { line: end.lineIndex + 1, column: end.columnIndex + 1 }
    },
    ...parseTSDocComment(raw, options)
  };
}

// 中文：把 `@lang` 与 inline `<lang>/<l>` 规整成 HIA field-level i18n，保持与 JSDoc/DotNetDoc 同一 source-document truth。
// English: Normalizes `@lang` and inline `<lang>/<l>` into HIA field-level i18n, matching the JSDoc/DotNetDoc source-document truth.
function createDescriptionI18n(defaultText, tags, defaultLocale, source) {
  const blocks = collectLangBlocks(tags, "description", source);
  const segments = parseInlineSegments(defaultText, "description");
  if (blocks.length === 0 && segments.length === 0) {
    return null;
  }

  const field = createTextField({
    fieldPath: "description",
    kind: "text",
    defaultLocale,
    defaultText,
    blocks,
    segments,
    source
  });

  return {
    enabled: true,
    model: HIA_TEXT_I18N_MODEL,
    modelVersion: HIA_TEXT_I18N_MODEL_VERSION,
    defaultLocale,
    locales: collectLocales([defaultLocale, ...Object.keys(field.localizedText)]),
    fields: {
      description: field
    }
  };
}

function collectLangBlocks(tags, fieldPath, source) {
  return tags
    .filter((tag) => tag.tag === "lang")
    .map((tag) => parseLangBlock(tag.value, fieldPath, source))
    .filter(Boolean);
}

function parseLangBlock(value, fieldPath, source) {
  const match = /^(\S+)(?:\s+([\s\S]+))?$/.exec(String(value ?? "").trim());
  const locale = normalizeLocale(match?.[1]);
  const text = compactWhitespace(match?.[2] ?? "");
  if (!locale || !text) {
    return null;
  }
  return {
    kind: "lang-block",
    locale,
    fieldPath,
    text,
    source,
    rangeInComment: null
  };
}

function createTextField(options) {
  const localizedText = {};
  const locales = collectLocales([
    options.defaultLocale,
    ...options.blocks.map((block) => block.locale),
    ...options.segments.flatMap((segment) => Object.keys(segment.localized))
  ]);

  for (const locale of locales) {
    const block = options.blocks.find((item) => item.locale === locale);
    localizedText[locale] = block?.text ?? renderInlineText(options.defaultText, options.segments, locale, options.defaultLocale);
  }

  const defaultText = localizedText[options.defaultLocale] || firstLocalizedText(localizedText) || compactWhitespace(options.defaultText);

  return {
    fieldPath: options.fieldPath,
    kind: options.kind,
    defaultLocale: options.defaultLocale,
    defaultText,
    source: options.source,
    localizedText,
    ...(options.blocks.length > 0 ? { blocks: options.blocks } : {}),
    ...(options.segments.length > 0 ? { segments: options.segments } : {}),
    resolutions: Object.fromEntries(Object.keys(localizedText).map((locale) => [
      locale,
      {
        requestedLocale: locale,
        resolvedLocale: locale,
        fallbackChain: fallbackChain(locale, options.defaultLocale),
        usedFallback: false,
        missing: false,
        sourceKind: options.blocks.some((block) => block.locale === locale) ? "lang-block" : "default-text",
        sourceLocale: locale,
        source: options.source
      }
    ])),
    missingLocales: []
  };
}

function parseInlineSegments(text, fieldPath) {
  const sourceText = String(text ?? "");
  const segments = [];
  const pattern = /<(lang|l)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = pattern.exec(sourceText))) {
    const localized = parseInlineLocalizedValues(match[3]);
    if (Object.keys(localized).length === 0) {
      continue;
    }
    const attributes = parseAttributes(match[2]);
    segments.push({
      kind: "lang-inline",
      id: `${fieldPath}.${segments.length}`,
      key: attributes.key ?? "",
      path: attributes.path ?? "",
      fieldPath,
      raw: match[0],
      localized,
      rangeInField: {
        start: match.index,
        end: match.index + match[0].length
      }
    });
  }
  return segments;
}

function parseInlineLocalizedValues(innerText) {
  const localized = {};
  const pattern = /<([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = pattern.exec(innerText || ""))) {
    const locale = normalizeLocale(match[1]);
    const text = compactWhitespace(match[2]);
    if (locale && text) {
      localized[locale] = text;
    }
  }
  return localized;
}

function renderInlineText(text, segments, locale, defaultLocale) {
  let rendered = compactWhitespace(text);
  for (const segment of segments) {
    rendered = rendered.replace(segment.raw, resolveInlineLocalizedText(segment.localized, locale, defaultLocale));
  }
  return rendered;
}

function resolveInlineLocalizedText(localized, locale, defaultLocale) {
  return localized[locale]
    ?? localized[getParentLocale(locale)]
    ?? localized[defaultLocale]
    ?? firstLocalizedText(localized)
    ?? "";
}

function parseAttributes(rawAttributes) {
  const attributes = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(rawAttributes || ""))) {
    attributes[match[1]] = match[2] || match[3] || "";
  }
  return attributes;
}

function collectLocales(values) {
  return [...new Set(values.map((value) => normalizeLocale(value)).filter(Boolean))];
}

function normalizeLocale(value) {
  const locale = String(value ?? "").trim().replace(/_/g, "-");
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale) ? locale : "";
}

function getParentLocale(locale) {
  return String(locale).split("-")[0] || locale;
}

function fallbackChain(locale, defaultLocale) {
  const chain = collectLocales([locale, getParentLocale(locale), defaultLocale]);
  return chain.length > 0 ? chain : [DEFAULT_LOCALE];
}

function firstLocalizedText(localizedText) {
  return Object.values(localizedText).find((text) => typeof text === "string" && text.length > 0) ?? "";
}

function compactWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isAllowedLangParserMessage(text) {
  return /\b@lang\b/u.test(String(text ?? "")) && /not defined|undefined tag|Unsupported tag/i.test(String(text ?? ""));
}

function stripComment(rawComment) {
  return String(rawComment)
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, "").trim())
    .filter(Boolean);
}

function firstNonWhitespaceColumn(line) {
  const match = /\S/.exec(line);
  return match ? match.index + 1 : 1;
}

function normalizeSourcePath(sourcePath) {
  const normalized = String(sourcePath).replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe TSDoc source path: ${sourcePath}`);
  }
  return normalized;
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
