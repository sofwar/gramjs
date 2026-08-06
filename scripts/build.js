#!/usr/bin/env node
/**
 * The one and only build entry point.
 *
 *   1. codegen   — regenerate everything derived from the TL schemas
 *   2. clean     — wipe dist/ so removed sources cannot linger there
 *   3. compile   — tsc, aborting on the first type error (no half-built dist)
 *   4. assets    — copy the files tsc does not emit (.tl schemas, hand-written .d.ts)
 *   5. smoke     — actually require() the build and check it works
 *
 * dist/ is committed, because the library is consumed straight from git.
 * Run `npm run build` before every commit; `npm run build:check` proves the
 * committed dist/ matches the sources without modifying anything.
 *
 * Usage:
 *   node scripts/build.js            build into dist/
 *   node scripts/build.js --check    build into a temp dir, diff against dist/
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const codegen = require("./codegen");

/** Files tsc does not emit but dist/ needs. Source -> path inside the out dir. */
const ASSETS = [
    ["gramjs/tl/static/api.tl", "tl/static/api.tl"],
    ["gramjs/tl/static/schema.tl", "tl/static/schema.tl"],
    ["gramjs/tl/api.d.ts", "tl/api.d.ts"],
    ["gramjs/define.d.ts", "define.d.ts"],
];

const check = process.argv.includes("--check");
let step = 0;
const log = (msg) => console.log(`\n[${++step}/5] ${msg}`);

function fail(msg) {
    console.error(`\nBuild failed: ${msg}\n`);
    process.exit(1);
}

function tsc(outDir) {
    const args = ["tsc", "--project", "tsconfig.json", "--outDir", outDir];
    const res = spawnSync("npx", args, {
        cwd: ROOT,
        stdio: "inherit",
        shell: process.platform === "win32",
    });
    if (res.status !== 0) fail("tsc reported errors (see above)");
}

function copyAssets(outDir) {
    for (const [from, to] of ASSETS) {
        const target = path.join(outDir, to);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(ROOT, from), target);
        console.log(`  ${from} -> ${path.posix.join(path.basename(outDir), to)}`);
    }
}

/** Every file in `dir`, as paths relative to it, sorted. */
function walk(dir, base = dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, base, out);
        else out.push(path.relative(base, full).split(path.sep).join("/"));
    }
    return out.sort();
}

/** Loads the freshly built library and asserts it is actually usable. */
function smokeTest(outDir) {
    const res = spawnSync(
        process.execPath,
        [path.join(__dirname, "smoke.js"), outDir],
        { cwd: ROOT, stdio: "inherit" }
    );
    if (res.status !== 0) fail("the built library did not load correctly");
}

function build() {
    log(check ? "codegen (check only)" : "codegen");
    if (codegen.run({ check }) !== 0) {
        fail("generated sources are out of date");
    }

    const outDir = check
        ? fs.mkdtempSync(path.join(os.tmpdir(), "gramjs-build-"))
        : DIST;

    try {
        log(check ? `compiling into ${outDir}` : "cleaning dist/");
        if (!check) fs.rmSync(DIST, { recursive: true, force: true });

        log("compiling with tsc");
        tsc(outDir);

        log("copying assets");
        copyAssets(outDir);

        log(check ? "comparing against committed dist/" : "smoke testing dist/");
        if (!check) {
            smokeTest(DIST);
            console.log("  dist/ loads, exports and TL layer look correct");
            console.log("\nBuild OK. Commit dist/ together with your changes.\n");
            return 0;
        }

        return compareWithDist(outDir);
    } finally {
        if (check) fs.rmSync(outDir, { recursive: true, force: true });
    }
}

function compareWithDist(outDir) {
    if (!fs.existsSync(DIST)) {
        console.error("\n  dist/ does not exist. Run: npm run build\n");
        return 1;
    }

    const fresh = walk(outDir);
    const committed = walk(DIST);
    const added = fresh.filter((f) => !committed.includes(f));
    const removed = committed.filter((f) => !fresh.includes(f));
    const changed = fresh
        .filter((f) => committed.includes(f))
        .filter(
            (f) =>
                fs.readFileSync(path.join(outDir, f), "utf-8").replace(/\r\n/g, "\n") !==
                fs.readFileSync(path.join(DIST, f), "utf-8").replace(/\r\n/g, "\n")
        );

    if (!added.length && !removed.length && !changed.length) {
        console.log("  dist/ is in sync with the sources");
        console.log("\nCheck OK.\n");
        return 0;
    }

    const list = (label, files) =>
        files.length
            ? `\n  ${label}:\n${files
                  .slice(0, 20)
                  .map((f) => `    - dist/${f}`)
                  .join("\n")}${
                  files.length > 20 ? `\n    ... and ${files.length - 20} more` : ""
              }`
            : "";

    console.error(
        `\n  dist/ is stale:${list("missing", added)}${list(
            "no longer produced",
            removed
        )}${list("outdated", changed)}\n\n  Run: npm run build\n`
    );
    return 1;
}

process.exit(build());
