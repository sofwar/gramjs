const fs = require("fs");
const path = require("path");

const { generateApiTypes, OUTPUT_FILE } = require("./types-generator/generate");

const API_TL = path.resolve(__dirname, "./static/api.tl");
const SCHEMA_TL = path.resolve(__dirname, "./static/schema.tl");
const API_TL_JS = path.resolve(__dirname, "./apiTl.js");
const SCHEMA_TL_JS = path.resolve(__dirname, "./schemaTl.js");

/**
 * Turns the static TL schemas into the modules the runtime actually reads.
 * Returns `[{ file, content }]` instead of writing, so `scripts/codegen.js`
 * can either write them or diff them against what is committed.
 */
function generateTlModules() {
    return [
        {
            file: API_TL_JS,
            content: `module.exports = \`${stripTl(
                fs.readFileSync(API_TL, "utf-8")
            )}\`;`,
        },
        {
            file: SCHEMA_TL_JS,
            content: `module.exports = \`${stripTl(
                fs.readFileSync(SCHEMA_TL, "utf-8")
            )}\`;`,
        },
        { file: OUTPUT_FILE, content: generateApiTypes() },
    ];
}

function stripTl(tl) {
    return tl
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
        .replace(/\n\s*\n/g, "\n")
        .replace(/`/g, "\\`");
}

module.exports = { generateTlModules, API_TL, SCHEMA_TL };

if (require.main === module) {
    for (const { file, content } of generateTlModules()) {
        fs.writeFileSync(file, content);
    }
}
