import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile } from "../src/compiler.mjs";
import { runtimeSource } from "../src/runtime.mjs";

test("Phase 247 restores captured contexts while a callback runs", async () => {
    const source = `export makeLoggerCallback(logger)
export makeTenantCallback(value)
export makeDefaultLogCallback()

readTenant()
    context tenant
    return tenant

makeLoggerCallback(logger)
    context log = logger
    return ()
        capture log
        log.info("later")

makeTenantCallback(value)
    context tenant = value
    return ()
        capture tenant
        return readTenant()

makeDefaultLogCallback()
    return ()
        context log
        return log
`;
    const javascript = compile(source).javascript;
    assert.match(javascript, /__contextSet\("log", __capturedContext0\)/);
    assert.match(javascript, /__contextSet\("tenant", __capturedContext0\)/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase247-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);

    const entries = [];
    const callback = program.makeLoggerCallback({ info(value) { entries.push(value); } });
    assert.equal(callback(), null);
    assert.deepEqual(entries, ["later"]);
    assert.equal(program.makeTenantCallback("Ada")(), "Ada");
    assert.equal(typeof program.makeDefaultLogCallback()().info, "function");
});

test("Phase 247 shares contexts between separately generated Lango runtimes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase247-runtime-"));
    const first = path.join(directory, "first");
    const second = path.join(directory, "second");
    for (const target of [first, second]) {
        await mkdir(path.join(target, "xmldom"), { recursive: true });
        await writeFile(path.join(target, "runtime.mjs"), runtimeSource());
        await cp(path.resolve("src/vendor/bignumber.mjs"), path.join(target, "bignumber.mjs"));
        await cp(path.resolve("src/vendor/xmldom"), path.join(target, "xmldom"), { recursive: true });
    }

    const firstRuntime = await import(pathToFileURL(path.join(first, "runtime.mjs")).href);
    const secondRuntime = await import(pathToFileURL(path.join(second, "runtime.mjs")).href);
    firstRuntime.configure({ output() {} });
    const request = { id: "request-1" };
    firstRuntime.contextSet("request", request);
    assert.equal(secondRuntime.contextGet("request"), request);
    firstRuntime.contextRestore(["request"]);
});
