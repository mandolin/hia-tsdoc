import { TSDOC_CLASSIFICATIONS, TSDOC_EXTRACTION_CONTRACT } from "@hia-doc/tsdoc-spec";
import {tsDocProjectToJsDocBridgeArtifact} from "./project.mjs";

/** @lang zh-CN 两代精确桥接读取及新项目投影。 @lang en Exact two-generation bridge reading and new project projection. */
export {tsDocProjectToJsDocBridgeArtifact,readTsJsDocBridgeArtifact} from "./project.mjs";

/**
 * @lang zh-CN 按精确输入版本选择桥接；旧版保持历史JS定位，新项目明确无发射事实。
 * @lang en Select bridging by exact extraction version; legacy retains historical JS locators while project input explicitly has no emission facts.
 * @param {object} tsArtifact - 提取对象。 Extraction object.
 * @param {object} [options] - 旧版JS路径选项，新项目拒绝该选项。 Legacy JS path options, refused by project mode.
 * @returns {object} 对应版本桥接。 Corresponding bridge version.
 */
export function tsDocToJsDocBridgeArtifact(tsArtifact, options = {}) {
  // <lang><zh-CN>新版不经过旧默认JS路径分支；未知身份必须拒绝。</zh-CN><en>New artifacts bypass the legacy default JS path branch; unknown versions must be refused.</en></lang>
  if(["0.2.0-draft","0.3.0-draft"].includes(tsArtifact?.contractVersion)) return tsDocProjectToJsDocBridgeArtifact(tsArtifact,options);
  if(tsArtifact?.contractVersion!=="0.1.0-draft") throw new Error("Unsupported TypeScript extraction version.");
  assertTsDocArtifact(tsArtifact);
  const jsPath = normalizePath(options.jsPath ?? "dist/output.js");
  const runtimeSymbols = tsArtifact.symbols.filter((symbol) => symbol.classification === TSDOC_CLASSIFICATIONS.runtime);

  return {
    contract: "hia-ts-jsdoc-bridge",
    contractVersion: "0.1.0-draft",
    producer: {
      name: "@hia-doc/ts-jsdoc-bridge",
      version: "0.1.3"
    },
    source: tsArtifact.source,
    artifact: {
      kind: "generated-js",
      path: jsPath,
      language: "javascript"
    },
    runtimeSymbols: runtimeSymbols.map((symbol) => ({
      id: symbol.id,
      name: symbol.name,
      kind: symbol.kind,
      jsName: symbol.runtime?.jsName ?? symbol.name,
      summary: symbol.comment?.summary ?? null,
      source: symbol.source
    })),
    typeOnlySymbols: tsArtifact.symbols
      .filter((symbol) => symbol.classification === TSDOC_CLASSIFICATIONS.typeOnly)
      .map((symbol) => ({
        id: symbol.id,
        name: symbol.name,
        kind: symbol.kind,
        bridgeStatus: "ts-only"
      })),
    diagnostics: []
  };
}

function assertTsDocArtifact(artifact) {
  if (!artifact || artifact.contract !== TSDOC_EXTRACTION_CONTRACT) {
    throw new Error(`Expected ${TSDOC_EXTRACTION_CONTRACT} artifact.`);
  }
}

function normalizePath(value) {
  const normalized = String(value).replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe TS/JSDoc bridge path: ${value}`);
  }
  return normalized;
}
