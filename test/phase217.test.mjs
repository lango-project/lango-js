import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("Faz 217 configures a JSON catalog for CLI runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase217-"));
    const input = path.join(directory, "input.lango");
    const catalog = path.join(directory, "tr.json");
    await writeFile(input, `export main(args)

main(args)
    println(_("Hello"))
`);
    await writeFile(catalog, JSON.stringify({ Hello: "Merhaba" }));
    await assert.doesNotReject(() => execFileAsync(process.execPath, [
        "src/cli.mjs", "run", input, "--catalog", catalog,
    ], { cwd: path.resolve(".") }));
});
