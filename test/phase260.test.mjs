import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

async function program(source, target = "node") {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-host-import-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output, new Set(), false, { target });
    return { module: await import(pathToFileURL(output).href), output: await readFile(output, "utf8") };
}

for (const target of ["node", "browser"])
test(`${target} host imports support Promise constructors, namespaces and uncaptured callbacks`, async () => {
    const { module, output } = await program(`import js global Promise
export resolve(value)
export callback()

resolve(value)
    pending = new Promise((done, fail)
        capture value
        done(value)
    )
    return Promise/all([pending, Promise/resolve(2)])

callback()
    return ()
        return Promise/resolve("ready")
`, target);
    assert.deepEqual(await module.resolve(1), [1, 2]);
    assert.equal(await module.callback()(), "ready");
    assert.doesNotMatch(output, /from "undefined"/);
});

test("aliased host imports resolve live values and retain nested function owners", async () => {
    const name = "__langoHostImports260";
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    try {
        const { module } = await program(`import js global ${name}/read as read
import js global ${name}/Factory as Factory
import js global ${name} as host
export render()
export rename(value)

render()
    item = new Factory(3)
    return "\${host.prefix}:\${read(item.value)}"

rename(value)
    host.prefix = value
    return host.prefix
`);
        let calls = 0;
        const fixture = prefix => ({
            prefix,
            Factory: class { constructor(value) { this.value = value; } },
            read(value) { calls += 1; return `${this.prefix}${value}`; },
        });
        globalThis[name] = fixture("first");
        assert.equal(module.render(), "first:first3");
        globalThis[name] = fixture("second");
        assert.equal(module.render(), "second:second3");
        assert.equal(module.rename("changed"), "changed");
        assert.equal(globalThis[name].prefix, "changed");
        assert.equal(calls, 2);
    } finally {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else delete globalThis[name];
    }
});

test("missing host imports fail on use and may become available after module loading", async () => {
    const name = "__langoMissingHost260";
    const { module } = await program(`import js global ${name}/value as value
export read()

read()
    return value
`);
    assert.throws(() => module.read(), error => error.name === "HostGlobalUnavailable" && error.message.includes(`${name}/value`));
    try {
        globalThis[name] = { value: "available" };
        assert.equal(module.read(), "available");
        delete globalThis[name].value;
        assert.throws(() => module.read(), /HostGlobalUnavailable/);
    } finally {
        delete globalThis[name];
    }
});

test("host import getters run at use time and preserve their native errors", async () => {
    const name = "__langoHostGetter260";
    let reads = 0;
    Object.defineProperty(globalThis, name, { configurable: true, get() { reads += 1; throw new Error("DeniedByHost"); } });
    try {
        const { module } = await program(`import js global ${name} as storage
export read()

read()
    return storage
`);
        assert.equal(reads, 0);
        assert.throws(() => module.read(), /DeniedByHost/);
        assert.equal(reads, 1);
    } finally {
        delete globalThis[name];
    }
});

test("host imports work in module initializers and nested paths have a default local name", async () => {
    const { module } = await program(`import js global Intl/DateTimeFormat
import js global Promise as promises
global ready = promises/resolve("ready")
export read()

read()
    global ready
    formatter = new DateTimeFormat("en", {
        timeZone: "UTC"
    })
    return ready
`);
    assert.equal(await module.read(), "ready");
});

test("host import bindings reject assignment, shadowing and duplicate aliases", () => {
    for (const body of [
        "    Promise = 1\n    return Promise",
        "    Promise += 1\n    return Promise",
        "    context Promise = 1\n    return 1",
        "    for [1] as Promise\n        println(Promise)",
        "    try\n        throw 1\n    catch Promise\n        return 1",
    ]) {
        assert.throws(() => compile(`import js global Promise\nexport read()\n\nread()\n${body}\n`), error => error instanceof LangoError && error.code === "LNG1268");
    }
    assert.throws(() => compile("import js global Promise\nexport read(Promise)\n\nread(Promise)\n    return Promise\n"), error => error instanceof LangoError && error.code === "LNG1268");
    assert.throws(() => compile('import js global Promise as host\nimport js "node:fs" as host\n'), error => error instanceof LangoError && error.code === "LNG1122");
    assert.throws(() => compile('import js global Intl\nexport read()\n\nread()\n    return new Intl.DateTimeFormat("en")\n'), error => error instanceof LangoError && error.code === "LNG1232");
});

test("host function, namespace, object method and constructor calls enforce JavaScript numeric boundaries", () => {
    for (const [binding, expression] of [
        ["Math/max as max", "max($1)"],
        ["Promise", "Promise/resolve($1)"],
        ["console", "console.log($1)"],
        ["Uint8Array", "new Uint8Array($1)"],
    ]) {
        assert.throws(() => compile(`import js global ${binding}\nexport read()\n\nread()\n    return ${expression}\n`), error => error instanceof LangoError && error.code === "LNG1252");
    }
});
