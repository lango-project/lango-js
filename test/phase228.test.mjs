import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 228 validates and resets the generated runtime host configuration", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase228-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    println(_("Hello"))
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    for (const options of [null, [], { catalog: [] }, { output: "console" }, { database_adapter: 1 }])
        assert.throws(
            () => runtime.configure(options),
            (error) => error?.name === "RuntimeConfigurationError",
        );
    const outputValues = [];
    assert.equal(runtime.configure({
        catalog: { Hello: "Merhaba" },
        output: (value) => outputValues.push(value),
    }), null);
    await program.main([]);
    assert.deepEqual(outputValues, ["Merhaba"]);
    runtime.configure();
    assert.throws(() => program.main([]), /output is not configured/);
});
