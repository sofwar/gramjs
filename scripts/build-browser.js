#!/usr/bin/env node
/**
 * Browser build: produces `browser/` (commonjs modules) and the UMD bundle
 * `browser/telegram.js`.
 *
 * It works on a throwaway copy of `gramjs/` in `tempBrowser/`, where every
 * `*-BROWSER.ts` file replaces its node counterpart and `Buffer` is imported
 * from the `buffer` polyfill. Unlike the old script it never rewrites
 * tsconfig.json or package.json, so an interrupted run cannot corrupt the
 * repository — the worst case is a leftover tempBrowser/, which is gitignored
 * and wiped at the start of the next run.
 *
 * Usage:
 *   node scripts/build-browser.js            production bundle
 *   node scripts/build-browser.js --dev      development bundle
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "gramjs");
const TEMP = path.join(ROOT, "tempBrowser");
const OUT = path.join(ROOT, "browser");

let step = 0;
const log = (msg) => console.log(`\n[${++step}/5] ${msg}`);

function fail(msg) {
    console.error(`\nBrowser build failed: ${msg}\n`);
    process.exit(1);
}

function eachFile(dir, fn) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) eachFile(full, fn);
        else fn(full);
    }
}

/** The browser has no global Buffer — pull it from the polyfill everywhere. */
function addBufferImport(file) {
    const isTypings = file.endsWith(".d.ts");
    const keepTypings = file.endsWith("api.d.ts") || file.endsWith("define.d.ts");
    if (!/\.(ts|js)$/.test(file) || (isTypings && !keepTypings)) return;

    const source = fs.readFileSync(file, "utf8");
    if (!source.includes("Buffer")) return;
    fs.writeFileSync(file, `import { Buffer } from "buffer/";\n${source}`, "utf8");
}

/** `x-BROWSER.ts` takes the place of `x.ts`; quick-test files are dropped. */
function applyBrowserVariants(file) {
    if (path.basename(file).includes("example")) {
        fs.rmSync(file);
        return;
    }
    if (!file.includes("-BROWSER")) return;
    fs.renameSync(file, file.replace("-BROWSER", ""));
}

async function main() {
    log("preparing tempBrowser/");
    fs.rmSync(TEMP, { recursive: true, force: true });
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.cpSync(SRC, TEMP, { recursive: true });
    eachFile(TEMP, addBufferImport);
    eachFile(TEMP, applyBrowserVariants);

    try {
        log("compiling with tsc");
        const tsc = spawnSync(
            "npx",
            ["tsc", "--project", "tsconfig.browser.json"],
            { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" }
        );
        if (tsc.status !== 0) fail("tsc reported errors (see above)");

        log("copying typings");
        for (const [from, to] of [
            ["gramjs/tl/api.d.ts", "tl/api.d.ts"],
            ["gramjs/define.d.ts", "define.d.ts"],
        ]) {
            const target = path.join(OUT, to);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(path.join(ROOT, from), target);
        }

        log("bundling with webpack");
        const webpack = require("webpack");
        const config = require("../webpack.config");
        config.entry = path.join(OUT, "index.js");
        config.mode = process.argv.includes("--dev")
            ? "development"
            : "production";
        console.log(`  mode: ${config.mode}`);

        const stats = await new Promise((resolve, reject) =>
            webpack(config, (err, result) => (err ? reject(err) : resolve(result)))
        );
        console.log(
            stats.toString({ colors: true, modules: false, children: false })
        );
        if (stats.hasErrors()) fail("webpack reported errors (see above)");
    } finally {
        log("cleaning tempBrowser/");
        fs.rmSync(TEMP, { recursive: true, force: true });
    }

    console.log(`\nBrowser build OK: ${path.join(OUT, "telegram.js")}\n`);
}

main().catch((err) => fail(err.stack || String(err)));
