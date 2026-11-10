import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { buildFile, compile, diagnose, formatSource } from "../src/compiler.mjs";
import { createI18n } from "../src/localization.mjs";

const execute = promisify(execFile);
async function built(source, target, run) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lango-localization-"));
    try {
        const input = path.join(dir, "input.lango");
        const output = path.join(dir, "output.mjs");
        await writeFile(input, source);
        await buildFile(input, output, new Set(), false, { target });
        const runtime = await import(pathToFileURL(path.join(dir, ".lango/runtime.mjs")).href);
        const program = await import(pathToFileURL(output).href);
        await run(program, runtime, dir);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

for (const target of ["node", "browser"]) {
    test(`${target} translations retain raw values, reorder/repeat parameters and format exact Decimal values`, async () => {
        const source = `export greet(name, count)
export amount()
export date()
export local()

greet(name, count)
    return _("Hello \${name}, \${count} orders")

amount()
    return _("Total: \${$12345678901234567890.125}")

date()
    return _("Created: \${\"2026-11-10T22:30:00Z\"}")

local()
    context i18n = createI18n({
        locale: "tr-TR"
    })
    return formatNumber($1234.5)
`;
        assert.equal(formatSource(source), source);
        await built(source, target, async (program, runtime, dir) => {
            runtime.configure({ locale: "tr-TR", timeZone: "Europe/Istanbul", currency: "TRY", catalogs: {
                tr: {
                    "Hello {0}, {1} orders": "{0}, merhaba! {1} sipariş, {0}.",
                    "Total: {0}": "Toplam: {0, number}",
                    "Created: {0}": "Oluşturulma: {0, datetime}",
                },
            } });
            assert.equal(program.greet("Ada", 2), "Ada, merhaba! 2 sipariş, Ada.");
            assert.equal(program.amount(), "Toplam: 12.345.678.901.234.567.890,125");
            assert.equal(program.date(), "Oluşturulma: 11.11.2026");
            assert.equal(program.local(), "1.234,5");
            assert.equal(runtime.contextGet("i18n").timeZone, "Europe/Istanbul");
            assert.match(await readFile(path.join(dir, ".lango/vendor/i18next.LICENSE"), "utf8"), /2011-present i18next/);
            assert.equal(runtime.formatNumber(runtime.decimal("0.125"), { style: "percent", maximumFractionDigits: 1 }), "%12,5");
            assert.equal(runtime.formatNumber(runtime.decimal("1.25"), { style: "currency" }), new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format("1.25"));
        });
    });
}

test("plural/context lookup and fallback are resolved by i18next without interpreting data as templates", () => {
    const translator = createI18n({ locale: "en-GB", catalogs: { en: {
        "{0} files_one": "One file: {0}",
        "{0} files_other": "Many files: {0, number}",
        "Welcome_admin": "Administrator {0}",
        "Hi {0}": "Hi {0}",
        "": "",
    } } });
    assert.equal(translator.translate("{0} files", [1], { count: 1 }), "One file: 1");
    assert.equal(translator.translate("{0} files", [2000], { count: 2000 }), "Many files: 2,000");
    assert.equal(translator.translate("Welcome", ["Ada"], { context: "admin" }), "Administrator Ada");
    assert.equal(translator.translate("Missing {0}", ["Ada"]), "Missing Ada");
    assert.equal(translator.translate("Hi {0}", ["<b>{1}</b> $t(other)"]), "Hi <b>{1}</b> $t(other)");
    assert.equal(translator.translate(""), "");
    const fallback = createI18n({ locale: "tr-TR", fallbackLocale: "en", catalogs: { en: { Hello: "Welcome" } } });
    assert.equal(fallback.translate("Hello"), "Welcome");
});

test("literal braces are escaped, calls evaluate once left to right, and translation options support plurals", async () => {
    const source = `export read()
export plural(count)

global calls = []

value(text)
    global calls
    calls.add(text)
    return text

read()
    global calls
    result = _("{literal} \${value(\"first\")} \${value(\"second\")}")
    return {
        text: result
        calls: calls
    }

plural(count)
    return _("\${count} files", {
        count: count
    })
`;
    await built(source, "node", async (program, runtime) => {
        runtime.configure({ catalog: { "{{literal}} {0} {1}": "{{done}} {1} {0}", "{0} files_one": "One file", "{0} files_other": "{0} files" } });
        assert.deepEqual(program.read(), { text: "{done} second first", calls: ["first", "second"] });
        assert.equal(program.plural(1), "One file");
        assert.equal(program.plural(4), "4 files");
    });
});

test("captured localization contexts survive later callbacks and restore caller state on success and failure", async () => {
    const source = `export callback(translator)
export failing(translator)
export plain()

callback(translator)
    context i18n = translator
    return (name)
        capture i18n
        return _("Hello \${name}")

failing(translator)
    context i18n = translator
    return ()
        capture i18n
        throw _("Failure")

plain()
    return _("Hello \${\"World\"}")
`;
    await built(source, "node", async (program, runtime) => {
        runtime.configure({ catalog: { "Hello {0}": "Default {0}" } });
        const tr = createI18n({ locale: "tr", catalog: { "Hello {0}": "Merhaba {0}", Failure: "Hata" } });
        const de = createI18n({ locale: "de", catalog: { "Hello {0}": "Hallo {0}" } });
        const first = program.callback(tr), second = program.callback(de);
        const results = await Promise.all([Promise.resolve().then(() => first("Ada")), Promise.resolve().then(() => second("Bob"))]);
        assert.deepEqual(results, ["Merhaba Ada", "Hallo Bob"]);
        assert.throws(program.failing(tr), error => error === "Hata");
        assert.equal(program.plain(), "Default World");
        runtime.configure({ i18n: tr });
        assert.equal(program.plain(), "Merhaba World");
        assert.throws(() => runtime.configure({ locale: "bad_tag" }), { name: "RuntimeConfigurationError" });
        assert.equal(program.plain(), "Merhaba World");
        runtime.configure();
        assert.equal(program.plain(), "Hello World");
    });
});

test("independently generated runtimes share only an explicit i18n context and preserve foreign Decimals", async () => {
    await built("export read()\n\nread()\n    return _(\"Hello\")\n", "node", async (first, a) => {
        await built("export read()\n\nread()\n    return _(\"Hello\")\n", "browser", async (second, b) => {
            a.configure({ catalog: { Hello: "A" } });
            b.configure({ catalog: { Hello: "B" } });
            const scope = [a.contextSet("i18n", createI18n({ locale: "tr", catalog: { Hello: "Merhaba" } }))];
            try {
                assert.equal(first.read(), "Merhaba");
                assert.equal(second.read(), "Merhaba");
                assert.equal(b.formatNumber(a.decimal("12345678901234567890.125")), "12.345.678.901.234.567.890,125");
            } finally { a.contextRestore(scope); }
            assert.equal(first.read(), "A");
            assert.equal(second.read(), "B");
        });
    });
});

test("format preferences are independent and catalogs are snapshots", () => {
    const catalog = { Hello: "Before" };
    const translator = createI18n({ locale: "en-US", timeZone: "Asia/Tokyo", currency: "EUR", catalog });
    catalog.Hello = "After";
    assert.equal(translator.translate("Hello"), "Before");
    assert.ok(Object.isFrozen(translator));
    assert.equal(translator.formatDate("2026-11-10T22:00:00Z"), "11/11/2026");
    assert.equal(translator.formatDate("2026-11-10T22:00:00Z", { timeZone: "UTC" }), "11/10/2026");
    assert.equal(translator.formatNumber(12, { style: "currency" }), "€12.00");
    assert.equal(translator.formatNumber(12, { style: "currency", currency: "USD" }), "$12.00");
    assert.equal(translator.translate("{0, number}", [12.5], { formatParams: { 0: { minimumFractionDigits: 3 } } }), "12.500");
});

test("invalid localization settings and data fail clearly without coercion", () => {
    for (const options of [null, [], { locale: "bad_tag" }, { timeZone: "Mars/Olympus" }, { currency: "bad-currency" }, { catalog: { Hi: {} } }, { catalogs: { en: [] } }])
        assert.throws(() => createI18n(options));
    const translator = createI18n();
    for (const value of [null, true, "1.5", Infinity, NaN]) assert.throws(() => translator.formatNumber(value));
    for (const value of [null, true, "tomorrow", "2026-02-30", "2026-11-10T10:30", new Date(NaN), Infinity]) assert.throws(() => translator.formatDate(value));
    assert.throws(() => translator.translate("{1}", ["Ada"]), /missing translation parameter/);
    assert.throws(() => translator.translate("Hi", [], { count: "2" }), /count/);
    assert.throws(() => translator.translate("Hi", [], { formatParams: [] }), /formatParams/);
});

test("localization builtins validate arity and captures inside optional translation settings", () => {
    for (const expression of ["createI18n({}, {})", "formatNumber()", "formatDate()"])
        assert.equal(diagnose(`export read()\n\nread()\n    return ${expression}\n`)[0]?.code, "LNG1219");
    assert.equal(diagnose('export read()\n\nread()\n    return _()\n')[0]?.code, "LNG1275");
    const source = 'export read(options)\n\nread(options)\n    return ()\n        return _("Hello", options)\n';
    assert.match(diagnose(source)[0].message, /MissingCapture: options/);
    assert.doesNotThrow(() => compile(source.replace('    return ()\n', '    return ()\n        capture options\n')));
});

test("CLI run and test accept locale, time zone, currency and legacy flat catalogs", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lango-locale-cli-"));
    try {
        const input = path.join(dir, "main.lango"), catalog = path.join(dir, "tr.json");
        await writeFile(input, `export main(args)

main(args)
    println(_("Hello"))
    println(formatNumber($1234.5))

test
    assert formatNumber($1234.5) == "1.234,5"
    assert _("Hello") == "Merhaba"
`);
        await writeFile(catalog, JSON.stringify({ Hello: "Merhaba" }));
        const args = [input, "--catalog", catalog, "--locale", "tr-TR", "--time-zone", "Europe/Istanbul", "--currency", "TRY"];
        const { stdout } = await execute(process.execPath, ["src/cli.mjs", "run", ...args]);
        assert.match(stdout, /Merhaba\n1\.234,5/);
        const result = await execute(process.execPath, ["src/cli.mjs", "test", ...args, "--build-dir", path.join(dir, "tests")]);
        assert.match(result.stdout, /PASS/);
    } finally { await rm(dir, { recursive: true, force: true }); }
});
