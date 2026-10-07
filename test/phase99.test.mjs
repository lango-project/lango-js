import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile, LangoError } from "../src/compiler.mjs";

test("Faz 99 imports an explicitly exported global through its interface", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase99-"));
    const library = path.join(directory, "state.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, `export global answer

global answer = 42
`);
    await writeFile(input, `import "./state"
    alias value = global answer

export main(args)

main(args)
    return value
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 42);
});

test("Faz 99 rejects an unexported or assigned imported global", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase99-"));
    const library = path.join(directory, "state.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, "global answer = 42\n");
    await writeFile(input, `import "./state"
    global answer

main(args)
    return answer
`);
    await assert.rejects(
        () => buildFile(input, output),
        (error) => error instanceof LangoError && error.code === "LNG1227",
    );

    await writeFile(library, `export global answer

global answer = 42
`);
    await writeFile(input, `import "./state"
    global answer

main(args)
    answer = 0
`);
    await assert.rejects(
        () => buildFile(input, output),
        (error) => error instanceof LangoError && error.code === "LNG1250",
    );
});
