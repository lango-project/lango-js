import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile, LangoError } from "../src/compiler.mjs";
import { pathToFileURL } from "node:url";

test("Faz 100 permits a cycle containing only function declarations", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase100-"));
    const a = path.join(directory, "a.lango");
    const b = path.join(directory, "b.lango");
    await writeFile(a, `import "./b"
    get_b()

export get_a()

get_a()
    return get_b()
`);
    await writeFile(b, `import "./a"
    get_a()

export get_b()

get_b()
    return 1
`);
    await assert.doesNotReject(() => buildFile(a, path.join(directory, "a.mjs")));
});

test("Faz 100 module-cycle conformance fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase100-example-"));
    const output = path.join(directory, "a.mjs");
    await buildFile(path.resolve("examples/100-module-cycles/a.lango"), output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.get_a(), 1);
});

test("Faz 100 rejects a cyclic initializer reading an imported global", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase100-"));
    const a = path.join(directory, "a.lango");
    const b = path.join(directory, "b.lango");
    await writeFile(a, `import "./b"
    global b_value

export global a_value

global a_value = b_value
`);
    await writeFile(b, `import "./a"
    global a_value

export global b_value

global b_value = 2
`);
    await assert.rejects(
        () => buildFile(a, path.join(directory, "a.mjs")),
        (error) => error instanceof LangoError && error.code === "LNG1251",
    );
});

test("Faz 100 rejects a cyclic initializer reading an imported static value", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase100-"));
    const a = path.join(directory, "a.lango");
    const b = path.join(directory, "b.lango");
    await writeFile(a, `import "./b"
    class B
        static
            code

export class A
    static
        code = B.code
`);
    await writeFile(b, `import "./a"
    class A

export class B
    static
        code = "B"
`);
    await assert.rejects(
        () => buildFile(a, path.join(directory, "a.mjs")),
        (error) => error instanceof LangoError && error.code === "LNG1251",
    );
});
