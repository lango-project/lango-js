import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 235 accepts a constructor callback closure", () => {
    const output = compile(`import js "node:http" as http

main(args)
    server = new http/Server((request, response)
        response.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8"
        })
        response.end("Merhaba, Lango HTTP sunucusu!\\n")
    )
`).javascript;
    assert.match(output, /new http\.Server\(__withArity\(\(request, response\) => \{/);
    assert.match(output, /response\.writeHead\(200, \{ "Content-Type": "text\/plain; charset=utf-8" \}\)/);
    assert.match(output, /response\.end\("Merhaba, Lango HTTP sunucusu!\\n"\)/);
});

test("Faz 235 requires the constructor callback closing parenthesis", () => {
    assert.throws(
        () => compile(`import js "node:http" as http

main(args)
    server = new http/Server((request, response)
        response.end("missing")
`),
        (error) => error instanceof LangoError && error.code === "LNG1263",
    );
});
