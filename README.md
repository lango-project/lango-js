# Lango

Lango is a JavaScript-transpiling language designed for readable, pragmatic
programs. Its language decisions are in `design/`.

## Faz 1

Faz 1 is the first executable vertical slice. It compiles the
`examples/002-main-branch` program and supports:

- `export main(args)`
- local assignments
- `if` / `else`
- numeric `>` conditions
- `.length` and numeric array indexing
- string interpolation
- explicit `_(...)` localization
- `println(...)`

Build a source file with:

```sh
npm run build -- examples/002-main-branch/input.lango --out /tmp/lango/main.mjs
```

The build writes the generated module, an external source-map file, and its
private `.lango/runtime.mjs` beside the output. Run the current checks with:

```sh
npm test
```

Faz 1 deliberately rejects all syntax outside this vertical slice. It is the
base for progressively implementing the accepted language decisions rather than
a claim of full-language support.

## Faz 2

Faz 2 adds same-module functions, `return`, calls with arity validation,
Boolean/null literals, and numeric `+`, `-`, `*`, `/`, `>`, and `==` expressions.
See `examples/003-functions`.
