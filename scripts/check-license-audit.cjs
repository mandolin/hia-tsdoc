const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const workspaceReleaseVersion = rootPackage.version;
const internalWorkspaceDependencies = new Set([
  "@hia-doc/tsdoc-spec",
  "@hia-doc/ts-doc-adapter",
  "@hia-doc/ts-doc-extractor",
  "@hia-doc/ts-jsdoc-bridge",
  "@hia-doc/ts-to-js-doc-source-map",
  "@hia-doc/tsdoc-runner"
]);

const approvedDependencies = {
  "@microsoft/tsdoc": {
    version: "0.16.0",
    license: "MIT",
    purpose: "Parse TSDoc comment syntax for TypeScript documentation extraction."
  },
  typescript: {
    version: "7.0.2",
    license: "Apache-2.0",
    purpose: "Compile TypeScript fixtures and inspect TypeScript AST/source ranges."
  },
  "@hia-doc/tsdoc-spec": {
    version: workspaceReleaseVersion,
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/ts-doc-adapter": {
    version: workspaceReleaseVersion,
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/ts-doc-extractor": {
    version: workspaceReleaseVersion,
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/ts-jsdoc-bridge": {
    version: workspaceReleaseVersion,
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/ts-to-js-doc-source-map": {
    version: workspaceReleaseVersion,
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/tsdoc-runner": {
    version: workspaceReleaseVersion,
    license: "MIT",
    purpose: "Internal workspace package."
  }
};

let failed = false;

for (const packageJsonPath of listPackageJsonFiles(root)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
    const approved = approvedDependencies[name];
    if (!approved) {
      console.error(`Unapproved dependency in ${path.relative(root, packageJsonPath)}: ${name}`);
      failed = true;
      continue;
    }
    if (version !== approved.version) {
      const expectation = internalWorkspaceDependencies.has(name)
        ? `follow workspace release version ${approved.version}`
        : `stay pinned to ${approved.version}`;
      console.error(`Dependency ${name} in ${path.relative(root, packageJsonPath)} must ${expectation}; found ${version}.`);
      failed = true;
    }
  }
  for (const field of ["devDependencies", "peerDependencies", "optionalDependencies"]) {
    const declared = Object.keys(packageJson[field] || {});
    if (declared.length > 0) {
      console.error(`TSDoc P1 dependency audit does not allow ${field} in ${path.relative(root, packageJsonPath)}: ${declared.join(", ")}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("TSDoc license audit passed: approved TypeScript and TSDoc dependencies.");

function listPackageJsonFiles(directory) {
  const result = [path.join(directory, "package.json")];
  const packagesRoot = path.join(directory, "packages");
  for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      result.push(path.join(packagesRoot, entry.name, "package.json"));
    }
  }
  return result;
}
