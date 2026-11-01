import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("test --build-dir resolves npm dependencies from the project", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-test-build-dir-"));
    const dependency = path.join(directory, "node_modules/local-policy");
    await mkdir(dependency, { recursive: true });
    await writeFile(path.join(dependency, "package.json"), JSON.stringify({ name: "local-policy", type: "module", exports: "./index.mjs" }));
    await writeFile(path.join(dependency, "index.mjs"), "export const allowed = true;\n");
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "generated");
    await writeFile(input, 'import js "local-policy" as policy\n\ntest "project dependency"\n    assert policy.allowed\n');
    const { stdout } = await execFileAsync(process.execPath, ["src/cli.mjs", "test", input, "--build-dir", output]);
    assert.match(stdout, /PASS project dependency/);
    assert.match(await readFile(path.join(output, "main.mjs"), "utf8"), /local-policy/);
    await assert.rejects(execFileAsync(process.execPath, ["src/cli.mjs", "test", input, "--build-dir"]), error => error.code === 2);
});
