#!/usr/bin/env node
/**
 * Regenerates every source file that is derived from something else, so that
 * `gramjs/` is always internally consistent before `tsc` runs:
 *
 *   gramjs/tl/static/api.tl    ->  gramjs/tl/apiTl.js        (runtime schema)
 *   gramjs/tl/static/schema.tl ->  gramjs/tl/schemaTl.js     (runtime schema)
 *   both of the above          ->  gramjs/tl/api.d.ts        (typings)
 *   "// LAYER N" in api.tl     ->  LAYER in tl/AllTLObjects.ts
 *   package.json "version"     ->  gramjs/Version.ts
 *
 * Usage:
 *   node scripts/codegen.js            rewrite the derived files
 *   node scripts/codegen.js --check    fail if any of them is out of date
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

require("./ts-require"); // the generator imports .ts sources — load them on the fly
const { generateTlModules, API_TL } = require("../gramjs/tl/generateModule");

const ALL_TL_OBJECTS = path.join(ROOT, "gramjs/tl/AllTLObjects.ts");
const VERSION_TS = path.join(ROOT, "gramjs/Version.ts");

/** Derived files are always written with LF, whatever the checkout looks like. */
function toLf(text) {
    return text.replace(/\r\n/g, "\n");
}

function rel(file) {
    return path.relative(ROOT, file).split(path.sep).join("/");
}

/** The layer the schema declares, e.g. `// LAYER 228` at the end of api.tl. */
function readLayer() {
    const matches = fs.readFileSync(API_TL, "utf-8").match(/^\/\/\s*LAYER\s+(\d+)/gm);
    if (!matches || !matches.length) {
        throw new Error(`No "// LAYER <n>" marker found in ${rel(API_TL)}`);
    }
    return Number(matches[matches.length - 1].match(/(\d+)/)[1]);
}

function readVersion() {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"))
        .version;
}

/** Every derived file with the content it should have right now. */
function collect() {
    const layer = readLayer();
    const version = readVersion();

    const allTlObjects = fs
        .readFileSync(ALL_TL_OBJECTS, "utf-8")
        .replace(/export const LAYER = \d+;/, `export const LAYER = ${layer};`);

    const outputs = generateTlModules().map(({ file, content }) => ({
        file,
        content,
    }));
    outputs.push({ file: ALL_TL_OBJECTS, content: allTlObjects });
    outputs.push({
        file: VERSION_TS,
        content: `export const version = "${version}";\n`,
    });

    return { layer, version, outputs: outputs.map((o) => ({ ...o, content: toLf(o.content) })) };
}

function run({ check }) {
    const { layer, version, outputs } = collect();
    const stale = [];

    for (const { file, content } of outputs) {
        const current = fs.existsSync(file)
            ? toLf(fs.readFileSync(file, "utf-8"))
            : null;
        if (current === content) continue;

        stale.push(rel(file));
        if (!check) fs.writeFileSync(file, content, "utf-8");
    }

    console.log(`  layer ${layer}, version ${version}`);

    if (!stale.length) {
        console.log("  all generated sources are up to date");
        return 0;
    }

    if (check) {
        console.error(
            `\n  Generated sources are stale:\n${stale
                .map((f) => `    - ${f}`)
                .join("\n")}\n\n  Run: npm run codegen\n`
        );
        return 1;
    }

    console.log(`  regenerated:\n${stale.map((f) => `    - ${f}`).join("\n")}`);
    return 0;
}

module.exports = { run, readLayer, readVersion };

if (require.main === module) {
    process.exit(run({ check: process.argv.includes("--check") }));
}
