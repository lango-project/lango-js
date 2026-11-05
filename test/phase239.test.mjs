import assert from "node:assert/strict";
import test from "node:test";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { buildFile, LangoError } from "../src/compiler.mjs";

test("Phase 239 executable build emits a configured main invocation", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase239-"));
    const input = path.join(directory, "cli.lango");
    const output = path.join(directory, "cli.mjs");
    await writeFile(input, `export main(args)

main(args)
    println(args[0])
`);
    await buildFile(input, output, new Set(), false, { executable: true });
    const emitted = await readFile(output, "utf8");
    assert.ok(emitted.startsWith("#!/usr/bin/env node\n"));
    assert.match(emitted, /configure\(\{ output: \(value\) => console\.log\(value\) \}\)/);
    assert.match(emitted, /await main\(process\.argv\.slice\(2\)\)/);
    await chmod(output, 0o755);
    const result = spawnSync(output, ["from-bin"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "from-bin");
});

test("Phase 239 executable build requires an exported main", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase239-"));
    const input = path.join(directory, "library.lango");
    await writeFile(input, "export value()\n\nvalue()\n    return 1\n");
    await assert.rejects(
        () => buildFile(input, path.join(directory, "library.mjs"), new Set(), false, { executable: true }),
        (error) => error instanceof LangoError && error.code === "LNG1265",
    );
});
