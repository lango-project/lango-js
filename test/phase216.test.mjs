import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("Faz 216 configures an opted-in SQLite adapter for CLI runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase216-"));
    const input = path.join(directory, "input.lango");
    const database = path.join(directory, "app.sqlite");
    await writeFile(input, `export main(args)

main(args)
    start_trans()
    rollback_trans()
`);
    const { stdout } = await execFileAsync(process.execPath, [
        "src/cli.mjs", "run", input, "--database", database,
    ], { cwd: path.resolve(".") });
    assert.equal(stdout, "");
});
