export const TSDOC_CONFIG_SCHEMA_VERSION = "0.1.0-draft";
export const TSDOC_CONFIG_SCHEMA_ID = "https://mandolin.github.io/HIA-Documentation/schemas/tsdoc-config-0.1.0-draft.schema.json";

const relativePath = {
  type: "string",
  minLength: 1,
  not: {
    anyOf: [
      { pattern: "^(?:[A-Za-z]:|/|\\\\|[A-Za-z][A-Za-z0-9+.-]*:)" },
      { pattern: "(?:^|[\\\\/])\\.\\.(?:[\\\\/]|$)" }
    ]
  }
};

export const TSDOC_CONFIG_JSON_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: TSDOC_CONFIG_SCHEMA_ID,
  title: "TSDoc Config",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "workspaceRoot", "outputDirectory", "inputs"],
  properties: {
    $schema: { const: TSDOC_CONFIG_SCHEMA_ID },
    schemaVersion: { const: TSDOC_CONFIG_SCHEMA_VERSION },
    workspaceRoot: relativePath,
    outputDirectory: relativePath,
    inputs: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "path"],
        properties: {
          kind: { enum: ["typescript-entry"] },
          path: relativePath,
          artifactBasePath: relativePath
        }
      }
    },
    options: {
      type: "object",
      additionalProperties: false,
      properties: {
        emitDocSourceMap: { type: "boolean" },
        ignoreConfig: { type: "boolean" },
        lib: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 }
        },
        module: { type: "string" },
        moduleResolution: { type: "string" },
        sourcesContentPolicy: { enum: ["none", "reference", "embed"] },
        target: { type: "string" },
        types: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 }
        },
        writeResultManifest: { type: "boolean" }
      }
    },
    profileIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string", pattern: "^[a-z0-9][a-z0-9._-]*$" }
    }
  }
});
