import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 103 lowers ordinary multiline Promise method chains", () => {
    const output = compile(`main(client)
    client.fetch("/data").then((response)
        println(response)
    ).catch((error)
        println(error)
    )
`).javascript;
    assert.match(output, /client\.fetch\("\/data"\)\)\.then\(__withArity\(\(response\) =>/);
    assert.match(output, /\.catch\(__withArity\(\(error\) =>/);
});

test("Faz 103 accepts the host fetch callable used by Promise chains", () => {
    assert.doesNotThrow(() => compile(`main(args)
    fetch("/data").then((response)
        println(response)
    )
`));
});

test("Faz 103 requires explicit Decimal conversion for host fetch", () => {
    assert.throws(
        () => compile(`main(args)
    $url = 12.50
    fetch($url)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
});

test("Faz 103 applies ordinary capture rules to Promise callbacks", () => {
    assert.throws(
        () => compile(`main(client)
    prefix = "ok"
    client.fetch("/data").then((response)
        println(prefix)
    )
`),
        (error) => error instanceof LangoError && error.code === "LNG1210",
    );
    assert.doesNotThrow(() => compile(`main(client)
    prefix = "ok"
    client.fetch("/data").then((response)
        capture prefix
        println(prefix)
    )
`));
});

test("Faz 103 executes a detached Promise chain through ordinary methods", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase103-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(client)

main(client)
    client.fetch("/data").then((response)
        println(response.name)
    )
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    assert.equal(program.main({ fetch: () => Promise.resolve({ name: "ok" }) }), null);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(values, ["ok"]);
});

test("Faz 103 can return a Promise chain from main", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase103-return-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(client)

main(client)
    return client.fetch("/data").then((response)
        return response.name
    )
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(await program.main({ fetch: () => Promise.resolve({ name: "ok" }) }), "ok");
});

test("Faz 103 routes a rejected Promise through catch", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase103-catch-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(client)

main(client)
    return client.fetch("/data").catch((error)
        return error.message
    )
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(
        await program.main({ fetch: () => Promise.reject(new Error("offline")) }),
        "offline",
    );
});

test("Faz 103 preserves Promise values through finally", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase103-finally-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(client)

main(client)
    return client.fetch("/data").finally(()
        println("done")
    )
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    assert.equal(await program.main({ fetch: () => Promise.resolve("ok") }), "ok");
    assert.deepEqual(values, ["done"]);
});

test("Faz 103 conformance fixture builds", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase103-example-"));
    await buildFile(
        path.resolve("examples/103-promises/input.lango"),
        path.join(directory, "main.mjs"),
    );
});
