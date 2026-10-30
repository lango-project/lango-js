import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile } from "../src/compiler.mjs";

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
