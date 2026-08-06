#!/usr/bin/env node
/**
 * Loads a freshly built dist/ the same way a consumer would and checks the
 * parts that silently rot: the TL schema the runtime parses, the declared
 * layer, the version, and the hand-written typings tsc does not emit.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const outDir = path.resolve(process.argv[2] || path.join(ROOT, "dist"));

const failures = [];
const expect = (ok, msg) => {
    if (!ok) failures.push(msg);
};

for (const file of ["index.js", "index.d.ts", "define.d.ts", "tl/api.d.ts"]) {
    expect(fs.existsSync(path.join(outDir, file)), `missing ${file}`);
}
if (failures.length) {
    console.error(failures.map((f) => `  ${f}`).join("\n"));
    process.exit(1);
}

const telegram = require(path.join(outDir, "index.js"));

expect(
    typeof telegram.TelegramClient === "function",
    "TelegramClient is not exported"
);
expect(typeof telegram.Api === "object", "Api is not exported");
expect(
    typeof telegram.Api.messages.SendMessage === "function",
    "Api.messages.SendMessage is missing — the TL schema did not load"
);
expect(
    typeof telegram.sessions.StringSession === "function",
    "sessions.StringSession is not exported"
);

const { LAYER } = require(path.join(outDir, "tl/AllTLObjects.js"));
const apiTl = fs.readFileSync(path.join(outDir, "tl/static/api.tl"), "utf-8");
const declared = Number(apiTl.match(/^\/\/\s*LAYER\s+(\d+)/gm).pop().match(/\d+/)[0]);
expect(
    LAYER === declared,
    `LAYER is ${LAYER} but api.tl declares layer ${declared}`
);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
expect(
    telegram.version === pkg.version,
    `exported version ${telegram.version} !== package.json ${pkg.version}`
);

/* The "./*" export pattern maps to dist/<name>.js and never falls back to a
   directory index, so every folder with one needs its own explicit entry —
   otherwise require("telegram/sessions") throws MODULE_NOT_FOUND. */
for (const dir of indexDirs(outDir)) {
    expect(
        Boolean(pkg.exports[`./${dir}`]),
        `package.json "exports" has no "./${dir}" entry — require("telegram/${dir}") would fail`
    );
}

function indexDirs(dir, prefix = "", found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sub = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (fs.existsSync(path.join(dir, entry.name, "index.js"))) found.push(sub);
        indexDirs(path.join(dir, entry.name), sub, found);
    }
    return found;
}

/* The runtime reads the embedded schema, not the .tl file — make sure a
   constructor added in the newest layer really made it into the bundle. */
const embedded = require(path.join(outDir, "tl/apiTl.js"));
const lastCtor = apiTl
    .split(/\r?\n/)
    .filter((l) => /^[a-zA-Z][\w.]*#[0-9a-f]+/.test(l))
    .pop();
if (lastCtor) {
    expect(
        embedded.includes(lastCtor.split(" ")[0]),
        `apiTl.js does not contain "${lastCtor.split(" ")[0]}" from api.tl`
    );
}

if (failures.length) {
    console.error(failures.map((f) => `  ${f}`).join("\n"));
    process.exit(1);
}

console.log(
    `  loaded ${path.basename(outDir)}/index.js — layer ${LAYER}, v${pkg.version}`
);
