import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile, LangoError } from "../src/compiler.mjs";

test("Faz 89 validates a selected imported static method's required arguments", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase89-"));
    const library = path.join(directory, "account.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, `export class Account
    static
        create(value)

Account::create(value)
    return value
`);
    await writeFile(input, `import "./account"
    class Account
        static
            create(value)

export main(args)

main(args)
    return Account.create()
`);
    await assert.rejects(
        () => buildFile(input, output),
        (error) => error instanceof LangoError && error.code === "LNG1203",
    );
});
