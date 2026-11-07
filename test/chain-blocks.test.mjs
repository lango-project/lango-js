import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile, diagnose, formatSource } from "../src/compiler.mjs";

async function program(t, source, target = "node") {
    const root = await mkdtemp(path.join(os.tmpdir(), "lango-chain-block-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const input = path.join(root, "input.lango");
    const output = path.join(root, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output, new Set(), false, { target });
    return import(pathToFileURL(output).href);
}

for (const target of ["node", "browser"])
test(`${target} chain assignments and returns preserve Promise values, recovery and cleanup`, async t => {
    const module = await program(t, `import js global Promise
export assigned(events)
export recovered(events)
export rejected(events)
export cleanupFailure()
export absentReturn()
export multiline(start)

assigned(events)
    pending = chain Promise/resolve(2)
      then(value)
        capture events
        events.add("first")
        return Promise/resolve(value + 3)
      then(value)
        capture events
        events.add("second")
        return value * 2
      finally
        capture events
        events.add("cleanup")
        return Promise/resolve(100)
    events.add("registered")
    return pending

recovered(events)
    return chain Promise/reject("failure")
      catch(error)
        capture events
        events.add(error)
        return 7
      then(value)
        return value + 1
      finally
        capture events
        events.add("recovered")

rejected(events)
    return chain Promise/resolve(1)
      then(value)
        throw "handler failure"
      finally
        capture events
        events.add("rejected")

cleanupFailure()
    return chain Promise/resolve(1)
      finally
        throw "cleanup failure"

absentReturn()
    return chain Promise/resolve(1)
      then(value)
        value = value + 1
      then(value)
        return value

multiline(start)
    return chain start({
        text: " then(not a clause)"
        values: [1, 2]
    })
      then(input)
        return input
`, target);
    const events = [];
    const pending = module.assigned(events);
    assert.deepEqual(events, ["registered"]);
    assert.equal(await pending, 10);
    assert.deepEqual(events, ["registered", "first", "second", "cleanup"]);
    assert.equal(await module.recovered(events), 8);
    assert.deepEqual(events.slice(-2), ["failure", "recovered"]);
    await assert.rejects(module.rejected(events), error => error === "handler failure");
    assert.equal(events.at(-1), "rejected");
    await assert.rejects(module.cleanupFailure(), error => error === "cleanup failure");
    assert.equal(await module.absentReturn(), null);
    assert.deepEqual(await module.multiline(input => Promise.resolve(input)), {
        text: " then(not a clause)", values: [1, 2],
    });
});

test("chain callbacks retain explicit contexts and automatic receivers, including nested chains", async t => {
    const module = await program(t, `import js global Promise
export class Counter(initial)
    properties
        pending
    methods
        run(logger, label)
        current()

Counter(initial)
    @value = initial

readLog(label)
    context log
    log.info(label)
    return null

Counter:run(logger, label)
    context log = logger
    @pending = chain Promise/resolve(1)
      then(amount)
        capture log
        capture label
        @value = @value + amount
        readLog(label)
        return chain Promise/resolve(2)
          then(amount)
            @value = @value + amount
            return current()
      finally
        capture log
        readLog("done")
    return @pending

Counter:current()
    return @value
`);
    const lines = [];
    const counter = new module.Counter(10);
    assert.equal(await counter.run({ info: value => lines.push(value) }, "step"), 13);
    assert.equal(counter.current(), 13);
    assert.deepEqual(lines, ["step", "done"]);
});

test("detached chains stop at a normal statement and base calls are evaluated once synchronously", async t => {
    const module = await program(t, `export detached(start, complete)
export initialFailure(start)

detached(start, complete)
    chain start(" then(not a clause)")
      then(value)
        capture complete
        complete(value)
    return "registered"

initialFailure(start)
    return chain start()
      catch(error)
        return "caught"
`);
    let starts = 0;
    let finish;
    const completed = new Promise(resolve => { finish = resolve; });
    assert.equal(module.detached(text => { starts++; assert.equal(text, " then(not a clause)"); return Promise.resolve(42); }, finish), "registered");
    assert.equal(starts, 1);
    assert.equal(await completed, 42);
    assert.throws(() => module.initialFailure(() => { throw new Error("sync failure"); }), /sync failure/);
});

test("chain captures are explicit, assigned promises remain available and callback locals do not escape", () => {
    assert.doesNotThrow(() => compile(`import js global Promise

run()
    try
        throw "earlier"
    catch error
        ignored = error
    return chain Promise/reject("later")
      catch(error)
        return error
`));
    assert.throws(() => compile(`import js global Promise

run(value)
    return chain Promise/resolve(1)
      then(result)
        return value + result
`), error => error.code === "LNG1210");
    assert.throws(() => compile(`import js global Promise

run(value)
    return chain Promise/resolve(1)
      then(result)
        capture value
        return result
`), error => error.code === "LNG1211");
    assert.throws(() => compile(`import js global Promise

run()
    if false
        pending = chain Promise/resolve(1)
          then(result)
            return result
    return pending
`), error => error.code === "LNG1246");
    assert.throws(() => compile(`import js global Promise

run()
    return chain Promise/resolve(1)
      then(result)
        temporary = result
        return temporary
      then(result)
        capture temporary
        return temporary
`), error => error.code === "LNG1212");
    assert.throws(() => compile(`run(start)
    return ()
        chain start()
          then(result)
            return result
`), error => error.code === "LNG1210");
});

test("malformed chain clauses have focused diagnostics and formatting preserves the new syntax", () => {
    for (const header of ["chain", "chain operation()", "chain operation() then", "chain operation() then(first, second)", "chain operation() finally(value)"])
        assert.equal(diagnose(`run()\n    ${header}\n        return null\n`, "chain.lango")[0].code, "LNG1273", header);
    const source = `import js global Promise

run()
    return chain Promise/resolve(1)
      then(value)
        return value
      finally
        return null
`;
    assert.equal(formatSource(source), source);
});


test("inline-first chain syntax remains compatible", async t => {
    const module = await program(t, `import js global Promise
export run()

run()
    pending = chain Promise/resolve(1) then(value)
        return value + 1
    then(value)
        return value + 1
    finally
        return null
    return pending
`);
    assert.equal(await module.run(), 3);
});

test("separate chain clauses reject incorrect indentation and malformed headers", () => {
    for (const clause of ["    then(value)", "       then(value)", "        then(value)", "      then", "      then(a, b)", "      finally(value)", "      unexpected()"])
        assert.equal(diagnose(`run(start)\n    return chain start()\n${clause}\n        return null\n`)[0].code, "LNG1273", clause);
    assert.equal(diagnose(`run(start, value)
    return chain start()
      then(result)
          capture value
          return value
`)[0].code, "LNG1273");
});
