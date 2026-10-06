import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 59 raises ArityError for dynamic function and closure calls", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase59-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export greet(name)\nexport make_callback()\n\ngreet(name)\n    return name\n\nmake_callback()\n    callback = (value)\n        return value\n    return callback\n`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.throws(() => program.greet(), /ArityError.*greet.*argument 1/);
    assert.throws(() => program.make_callback()(), /ArityError.*closure.*argument 1/);
    assert.equal(program.greet("ok", "ignored"), "ok");
});
