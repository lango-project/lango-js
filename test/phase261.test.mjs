import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile, formatSource } from "../src/compiler.mjs";

const method = body => `class Worker\n\nWorker:run()\n${body}\n\nWorker:helper()\n    return 1\n`;
const rejects = (source, code) => assert.throws(() => compile(source), error => error.code === code);

test("implicit receivers retain private methods, virtual dispatch, static calls and detached captures", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-receiver-"));
    const output = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/261-implicit-receiver/input.lango"), output);
    const program = await import(pathToFileURL(output).href);
    program.main([]);
});

test("callbacks automatically retain the receiver while explicit captures remain compatible", () => {
    assert.doesNotThrow(() => compile(method("    return ()\n        return helper()")));
    assert.doesNotThrow(() => compile(method("    return ()\n        capture @this\n        return helper()")));
    rejects(method("    return ()\n        capture @this\n        return 1"), "LNG1211");
    assert.doesNotThrow(() => compile(method("    return ()\n        return @this")));
});

test("methods cannot silently shadow local, module, imported or standard callables", () => {
    rejects(method("    helper = ()\n        return 2\n    return helper()"), "LNG1269");
    rejects(`${method("    return helper()")}\nhelper()\n    return 2\n`, "LNG1269");
    assert.throws(() => compile(method("    return helper()"), "input.lango", [{ names: ["helper"], selections: [] }]), error => error.code === "LNG1269");
    rejects(`class Worker\n\nWorker:run()\n    return is_string(1)\n\nWorker:is_string(value)\n    return true\n`, "LNG1269");
    rejects(method("    context helper\n    return helper()"), "LNG1269");
    rejects(method("    try\n        throw 1\n    catch helper\n        return helper()"), "LNG1269");
    rejects(method("    return source.then((helper)\n        return helper()\n    )"), "LNG1269");
    assert.doesNotThrow(() => compile(method("    callback = ()\n        helper = 1\n        return helper\n    return helper()")));
});

test("implicit resolution retains visibility and required argument checks", () => {
    rejects(`class Base\n\nclass Child : Base\n\nBase:hidden()\n    return 1\n\nChild:run()\n    return hidden()\n`, "LNG1242");
    rejects(method("    return helper()").replace("Worker:helper()", "Worker:helper(value)"), "LNG1203");
    rejects(method("    return helper()").replace("Worker:helper()", "Worker::helper()"), "LNG1202");
    rejects(method("    return helper()").replace("Worker:run()", "Worker::run()"), "LNG1202");
});

test("the explicit receiver is scoped and readonly and obsolete this syntax is diagnosed", () => {
    rejects("run()\n    return @this\n", "LNG1270");
    rejects("run()\n    return @this.helper()\n", "LNG1270");
    rejects("global receiver = @this\n", "LNG1270");
    rejects("class Worker\n    static\n        receiver = @this\n", "LNG1270");
    rejects("class Worker\n    properties\n        this\n", "LNG1270");
    rejects(method("    @this = null"), "LNG1270");
    rejects(method("    return this"), "LNG1270");
    rejects(method("    return this.helper()"), "LNG1270");
});

test("formatting preserves bare calls in callbacks", () => {
    const source = method("    return ()\n        return helper()");
    assert.equal(formatSource(source), source);
});
