import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

async function built(t, target) {
    const root = await mkdtemp(path.join(os.tmpdir(), "lango-auto-contexts-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await writeFile(path.join(root, "reader.lango"), `export read()
export secret()

read()
    context tenant
    context log
    row = SQL
        select 1 as value
    row.execute()
    row.next()
    log.info(tenant.id)
    return {
        tenant: tenant
        value: row.value
        transaction: trans_state()
    }

secret()
    context callerOnly
    return callerOnly
`);
    await writeFile(path.join(root, "main.lango"), `import "./reader"
    read()
    secret()
import js global Promise
import js global setTimeout

export make(value, logger, adapter)
export override(value)
export asynchronous(pending)
export shadow()
export hidden()
export throwing()
export legacy()

make(value, logger, adapter)
    context tenant = value
    context log = logger
    context db = adapter
    return ()
        return read()

override(value)
    context tenant = value
    return ()
        context tenant = {
            id: "inner"
        }
        return ()
            return tenant.id

asynchronous(pending)
    return chain pending
      then(ignored)
        waiting = new Promise((resolve)
            done = ()
                capture resolve
                resolve(read())
            setTimeout(done, 0)
        )
        return waiting
      then(result)
        context tenant
        assert result.tenant == tenant
        return result

shadow()
    return (tenant)
        return tenant.id

hidden()
    return ()
        return secret()

throwing()
    return ()
        context tenant
        throw tenant.id

legacy()
    context tenant
    return ()
        capture tenant
        return tenant.id
`);
    const output = path.join(root, "main.mjs");
    await buildFile(path.join(root, "main.lango"), output, new Set(), false, { target });
    return {
        program: await import(pathToFileURL(output).href),
        runtime: await import(pathToFileURL(path.join(root, ".lango/runtime.mjs")).href),
    };
}

for (const target of ["node", "browser"]) {
    test(`${target} callbacks inherit hidden SQL/log contexts by reference and restore their caller`, async t => {
        const { program, runtime } = await built(t, target);
        const messages = [];
        let closed = false;
        const adapter = {
            execute() {
                if (closed) throw new Error("DatabaseScopeClosed");
                return { rows: [{ value: 7 }] };
            },
            transactionState() { return null; },
        };
        const tenant = { id: "created" };
        const callback = program.make(tenant, { info: value => messages.push(value) }, adapter);
        tenant.id = "updated";
        const scope = [runtime.contextSet("tenant", { id: "caller" }), runtime.contextSet("callerOnly", "private")];
        try {
            const result = callback();
            assert.equal(result.tenant, tenant);
            assert.equal(result.value, 7);
            assert.deepEqual(messages, ["updated"]);
            assert.equal(runtime.contextGet("tenant").id, "caller");
            const hidden = program.hidden();
            runtime.contextSet("callerOnly", "changed");
            try { assert.equal(hidden(), "private"); }
            finally { runtime.contextRestore(["callerOnly"]); }
            assert.equal(program.shadow()({ id: "parameter" }), "parameter");
            assert.equal(program.legacy()(), "caller");
        } finally { runtime.contextRestore(scope); }
        const absent = program.hidden();
        runtime.contextSet("callerOnly", "provided by caller");
        try { assert.equal(absent(), "provided by caller"); }
        finally { runtime.contextRestore(["callerOnly"]); }
        const disabled = program.make(tenant, { info() {} }, null);
        runtime.contextSet("db", adapter);
        try { assert.throws(disabled, /DatabaseNotConfigured/); }
        finally { runtime.contextRestore(["db"]); }
        closed = true;
        assert.throws(callback, /DatabaseScopeClosed/);
        assert.throws(() => runtime.contextGet("tenant"), /unavailable/);
        assert.equal(program.override({ id: "outer" })()(), "inner");
        assert.throws(() => runtime.contextGet("tenant"), /unavailable/);
    });

    test(`${target} Promise and timer callbacks preserve distinct environments across runtime copies`, async t => {
        const first = await built(t, target), second = await built(t, target);
        const results = [];
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        for (const id of ["one", "two"]) {
            const scope = [first.runtime.contextSet("tenant", { id }), first.runtime.contextSet("log", { info() {} }),
                first.runtime.contextSet("db", { execute: () => ({ rows: [{ value: id }] }), transactionState: () => null })];
            try { results.push(second.program.asynchronous(pending)); }
            finally { first.runtime.contextRestore(scope); }
        }
        release(null);
        const values = await Promise.all(results);
        assert.deepEqual(values.map(value => value.tenant.id), ["one", "two"]);
        assert.deepEqual(values.map(value => value.value), ["one", "two"]);
        assert.throws(() => first.runtime.contextGet("db"), /unavailable/);
        first.runtime.contextSet("tenant", { id: "failure" });
        const failing = second.program.throwing();
        first.runtime.contextRestore(["tenant"]);
        first.runtime.contextSet("tenant", { id: "caller" });
        try {
            assert.throws(failing, error => error === "failure");
            assert.equal(first.runtime.contextGet("tenant").id, "caller");
        } finally { first.runtime.contextRestore(["tenant"]); }
    });
}

test("ordinary local bindings still require capture", () => {
    assert.throws(() => compile(`make()
    value = 3
    return ()
        return value
`), error => error.code === "LNG1210");
});
