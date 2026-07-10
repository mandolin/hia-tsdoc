import { TSDocParser } from "@microsoft/tsdoc";

import {
  TSDOC_CLASSIFICATIONS,
  TSDOC_EXTRACTION_CONTRACT,
  TSDOC_EXTRACTION_CONTRACT_VERSION,
  TSDOC_PROFILE_VERSION,
  TSDOC_SYMBOL_KINDS,
  isTSDocTag,
  normalizeTSDocTag
} from "@hia-doc/tsdoc-spec";

const parser = new TSDocParser();

export function extractTsDoc(source, options = {}) {
  const sourcePath = normalizeSourcePath(options.path ?? "input.ts");
  const lines = String(source).replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const symbols = [];
  const comments = [];
  const diagnostics = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const declaration = parseDeclaration(line);
    if (!declaration) {
      continue;
    }
    const sourceRange = declarationRange(lines, index);
    const comment = extractAttachedComment(lines, index);
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
        parserDiagnostics: comment.parserDiagnostics
      };
      comments.push({
        symbolId: symbol.id,
        range: comment.range,
        summary: comment.summary,
        tags: comment.tags,
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
      version: "0.0.0"
    },
    profile: {
      name: "tsdoc",
      version: TSDOC_PROFILE_VERSION
    },
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

export function parseTSDocComment(rawComment) {
  const text = String(rawComment);
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

  return {
    summary: summaryLines.join(" ").trim() || null,
    tags,
    parserDiagnostics: parserContext.log.messages.map((message) => ({
      messageId: message.messageId,
      text: message.text
    }))
  };
}

function parseDeclaration(line) {
  const functionMatch = /^\s*export\s+function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/.exec(line);
  if (functionMatch) {
    return {
      name: functionMatch[1],
      signature: functionMatch[2],
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

function declarationRange(lines, startIndex) {
  let endIndex = startIndex;
  let depth = 0;
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    depth += count(line, "{");
    depth -= count(line, "}");
    endIndex = index;
    if (index > startIndex && depth <= 0) {
      break;
    }
  }
  return {
    start: { line: startIndex + 1, column: firstNonWhitespaceColumn(lines[startIndex]) },
    end: { line: endIndex + 1, column: lines[endIndex].length + 1 }
  };
}

function extractAttachedComment(lines, declarationIndex) {
  let cursor = declarationIndex - 1;
  while (cursor >= 0 && !lines[cursor].trim()) {
    cursor -= 1;
  }
  if (cursor < 0 || !lines[cursor].includes("*/")) {
    return null;
  }

  const end = cursor;
  while (cursor >= 0 && !lines[cursor].includes("/**")) {
    cursor -= 1;
  }
  if (cursor < 0) {
    return null;
  }

  const raw = lines.slice(cursor, end + 1).join("\n");
  return {
    raw,
    range: {
      start: { line: cursor + 1, column: firstNonWhitespaceColumn(lines[cursor]) },
      end: { line: end + 1, column: lines[end].length + 1 }
    },
    ...parseTSDocComment(raw)
  };
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

function count(value, character) {
  return [...String(value)].filter((item) => item === character).length;
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
