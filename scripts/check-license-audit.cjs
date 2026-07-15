const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

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
    version: "0.1.2",
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/ts-doc-adapter": {
    version: "0.1.2",
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/ts-doc-extractor": {
    version: "0.1.2",
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/ts-jsdoc-bridge": {
    version: "0.1.2",
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/ts-to-js-doc-source-map": {
    version: "0.1.2",
    license: "MIT",
    purpose: "Internal workspace package."
  },
  "@hia-doc/tsdoc-runner": {
    version: "0.1.2",
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
      console.error(`Dependency ${name} in ${path.relative(root, packageJsonPath)} must stay pinned to ${approved.version}; found ${version}.`);
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
