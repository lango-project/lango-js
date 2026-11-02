import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

async function program(source) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-interpolation-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    return { module: await import(pathToFileURL(output).href), runtime };
}

test("interpolation evaluates function, method, namespace and indexed calls in order", async () => {
    const { module } = await program(`import js "node:path" as path
export render(service, callback)

decorate(value)
    return "\${value}!"

render(service, callback)
    return "\${decorate(service.label(1))}|\${path/basename('/tmp/demo.txt')}|\${service['label'](2)}|\${callback(3)}"
`);
    const calls = [];
    const service = { prefix: "item", label(index) { calls.push(index); return this.prefix + index; } };
    assert.equal(module.render(service, index => { calls.push(index); return "callback"; }), "item1!|demo.txt|item2|callback");
    assert.deepEqual(calls, [1, 2, 3]);
});

test("interpolation parses nested strings, maps, braces, comments and arithmetic", async () => {
    const { module } = await program(`export render()

identity(value)
    return value

field(value)
    return value.label

render()
    return "\${identity("\${field({ label: "a},#b", nested: { value: 2 } })}")}|\${1 + 2}|\${identity(true)}" # trailing comment
`);
    assert.equal(module.render(), "a},#b|3|true");
});

test("interpolation supports super calls and private instance fields", async () => {
    const { module } = await program(`export render()

class Parent
    methods
        describe()

Parent:describe()
    return "parent"

class Child : Parent
    methods
        describe()

Child(id)
    super()
    @id = id

Child:describe()
    return "\${super.describe()}: \${@id}"

render()
    child = new Child(7)
    return "\${child.describe()}"
`);
    assert.equal(module.render(), "parent: 7");
});

test("interpolated calls preserve context and capture their argument dependencies", async () => {
    const { module } = await program(`export callback(value)

format(value)
    context request
    return "\${request.prefix}:\${value}"

callback(value)
    context request = value
    return ()
        capture request
        return "\${format(request.items[0])}"
`);
    assert.equal(module.callback({ prefix: "captured", items: ["item"] })(), "captured:item");
    assert.throws(() => compile(`export callback(value)

callback(value)
    return ()
        return "\${value.trim()}"
`), error => error instanceof LangoError && error.code === "LNG1210");
});

test("localized interpolation evaluates call expressions before translation", async () => {
    const { module, runtime } = await program(`export render(value)

upper(value)
    return value.toUpperCase()

render(value)
    return _("Hello \${upper(value)}")
`);
    runtime.configure({ catalog: { "Hello {0}": "Welcome {0}" } });
    assert.equal(module.render("ada"), "Welcome ADA");
});

test("interpolation keeps literal backslashes, backticks and escaped interpolation", async () => {
    const { module } = await program('export render(value)\n\nrender(value)\n    return "tick ` slash \\\\ literal \\${ignored} actual ${value}"\n');
    assert.equal(module.render("ok"), 'tick ` slash \\ literal ${ignored} actual ok');
});

test("interpolated calls receive normal diagnostics and malformed interpolation is rejected", () => {
    const invalid = [
        ['"${}"', "LNG1267"],
        ['"${missing()}"', "LNG1202"],
        ['"${is_string()}"', "LNG1219"],
        ['"${1 + 2"', "LNG1267"],
    ];
    for (const [expression, code] of invalid) {
        assert.throws(() => compile(`export render()\n\nrender()\n    return ${expression}\n`), error => error instanceof LangoError && error.code === code && error.span.start.line === 4);
    }
});
