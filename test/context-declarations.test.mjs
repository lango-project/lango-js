import assert from "node:assert/strict";
import test from "node:test";
import { compile, diagnose } from "../src/compiler.mjs";

const reject = (source, line) => assert.throws(() => compile(source), error => {
    assert.equal(error.code, "LNG1276");
    assert.equal(error.span.start.line, line);
    return true;
});

test("unused context readers fail with a source location, including hidden SQL dependencies", () => {
    reject(`run()
    context log
    return 1
`, 2);
    reject(`run()
    context db
    row = SQL
        select 1
    row.execute()
`, 2);
    reject(`run()
    context tenant
    return ()
        capture tenant
        return read()

read()
    context tenant
    return tenant.id
`, 2);
    reject(`class Worker()

Worker()
    return null

Worker:run()
    context log
    return null
`, 7);
    reject(`test "unused"
    context log
    assert true
`, 2);
});

test("callbacks and duplicate declarations cannot redeclare a visible context reader", () => {
    reject(`run()
    context log
    return ()
        context log
        log.info("hello")
`, 4);
    reject(`run()
    context log
    context log
    log.info("hello")
`, 3);
});

test("context setters remain valid for indirect use and explicit overrides", () => {
    assert.doesNotThrow(() => compile(`run(logger)
    context log = logger
    return helper()

helper()
    return ()
        context log
        log.info("hello")
`));
    assert.doesNotThrow(() => compile(`run(logger, other)
    context log = logger
    return ()
        capture other
        context log = other
        log.info("hello")
`));
});

test("visible context reads in nested callbacks count, but shadowed names and literal text do not", () => {
    assert.doesNotThrow(() => compile(`run()
    context log
    return ()
        return ()
            log.info("hello")
`));
    reject(`run()
    context log
    return (log)
        return log
`, 2);
    reject(`run()
    context log
    return {
        log: "log"
    }
`, 2);
    assert.doesNotThrow(() => compile(`run()
    context log
    return "\${log.verbose?}"
`));
});

test("a redundant nested reader does not hide the enclosing binding's actual use", () => {
    const diagnostics = diagnose(`run()
    context log
    return ()
        context log
        log.info("hello")
`);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].span.start.line, 4);
});

test("diagnostics report every unused declaration", () => {
    const diagnostics = diagnose(`run()
    context log
    context db
    return null
`);
    assert.deepEqual(diagnostics.map(item => item.code), ["LNG1276", "LNG1276"]);
});
