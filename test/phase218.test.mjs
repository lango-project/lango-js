import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Faz 218 exposes package CLI and host integration entrypoints", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    assert.equal(packageJson.name, "@lango-project/lango-js");
    assert.equal(packageJson.version, "0.1.1");
    assert.equal(packageJson.bin.lango, "src/cli.mjs");
    assert.deepEqual(packageJson.exports, {
        ".": "./src/compiler.mjs",
        "./runtime": "./src/runtime.mjs",
        "./database": "./src/database.mjs",
    });
    const cli = await readFile("src/cli.mjs", "utf8");
    assert.match(cli, /^#!\/usr\/bin\/env node\n/);
});
