import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile } from "../src/compiler.mjs";

const method = body => `class Counter\n\nCounter()\n    @count = 1\n    _offset = 2\n\nCounter:callback()\n${body}\n`;
const rejects = (source, code) => assert.throws(() => compile(source), error => error.code === code);

test("callbacks automatically retain live private, protected, static and nested receivers", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-auto-receiver-"));
    const output = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/262-automatic-receiver/input.lango"), output);
    const program = await import(pathToFileURL(output).href);
    program.main([]);
});

test("automatic property captures still validate member names and method scope", () => {
    rejects(method("    return ()\n        return @missing"), "LNG1214");
    rejects(method("    return ()\n        return _missing"), "LNG1214");
    rejects(method("    return ()\n        return @@missing"), "LNG1214");
    rejects(method("    return ()\n        return @count").replace("Counter:callback()", "Counter::callback()"), "LNG1231");
    rejects("callback()\n    return ()\n        return @this\n", "LNG1270");
});

test("outer locals and context bindings continue to require explicit capture", () => {
    rejects(method("    value = 3\n    return ()\n        return @count + value"), "LNG1210");
    rejects(method("    context tenant\n    return ()\n        return tenant.id"), "LNG1210");
    assert.doesNotThrow(() => compile(method("    context tenant\n    return ()\n        capture tenant\n        return @count + tenant.id")));
    rejects("callback()\n    _local = 3\n    return ()\n        return _local\n", "LNG1210");
});
