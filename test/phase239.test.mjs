import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
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
    const emitted = await (await import("node:fs/promises")).readFile(output, "utf8");
    assert.match(emitted, /configure\(\{ output: \(value\) => console\.log\(value\) \}\)/);
    assert.match(emitted, /await main\(process\.argv\.slice\(2\)\)/);
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
