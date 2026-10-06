import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 37 scopes context across synchronous Lango calls", async () => {
    const output = compile(`read_tenant()
    context tenant
    return tenant

main(args)
    context tenant = "Ada"
    println(read_tenant())
`).javascript;
    assert.match(output, /__contextSet\("tenant", "Ada"\)/);
    assert.match(output, /__contextGet\("tenant"\)/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase37-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/037-context/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["Ada"]);
});
