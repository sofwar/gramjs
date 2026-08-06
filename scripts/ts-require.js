/**
 * Lets plain `node` require the TypeScript sources.
 *
 * The TL code generator lives in `gramjs/tl/` and pulls in `generationHelpers.ts`
 * and `Helpers.ts`, so it cannot run before the project is compiled — and it has
 * to run before the project is compiled. This hook breaks that cycle by
 * transpiling `.ts` on the fly with the TypeScript already in devDependencies
 * (no ts-node, no second toolchain to keep in sync with tsconfig.json).
 *
 * Type checking is intentionally skipped here; `tsc` does that in the next
 * build step.
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const configPath = path.join(ROOT, "tsconfig.json");
const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
const { options } = ts.convertCompilerOptionsFromJson(
    config.compilerOptions,
    ROOT,
    configPath
);

const compilerOptions = {
    ...options,
    module: ts.ModuleKind.CommonJS,
    declaration: false,
    sourceMap: false,
    inlineSourceMap: true,
    outDir: undefined,
    rootDir: undefined,
};

require.extensions[".ts"] = (module, filename) => {
    const { outputText } = ts.transpileModule(
        fs.readFileSync(filename, "utf8"),
        { compilerOptions, fileName: filename }
    );
    module._compile(outputText, filename);
};
