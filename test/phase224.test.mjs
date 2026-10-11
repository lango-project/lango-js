import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("Faz 224 configures SQLite for Lango CLI test blocks", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase224-"));
    const input = path.join(directory, "input.lango");
    const database = path.join(directory, "test.sqlite");
    await writeFile(input, `test "transaction"
    start_trans()
    rollback_trans()
    assert true
`);
    await assert.doesNotReject(() => execFileAsync(process.execPath, [
        "src/cli.mjs", "test", input, "--database", database,
    ], { cwd: path.resolve(".") }));
});
