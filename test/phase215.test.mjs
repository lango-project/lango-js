import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("Faz 215 passes Decimal profile options through the build CLI", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase215-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `main(args)\n    return null\n`);
    await execFileAsync(process.execPath, [
        "src/cli.mjs", "build", input, "--out", output,
        "--decimal-division-scale", "2",
        "--decimal-division-rounding", "HalfUp",
    ], { cwd: path.resolve(".") });
    const runtime = await readFile(path.join(directory, ".lango/runtime.mjs"), "utf8");
    assert.match(runtime, /DECIMAL_PLACES: 2/);
    assert.match(runtime, /ROUNDING_MODE: BigNumber\.ROUND_HALF_UP/);
});
