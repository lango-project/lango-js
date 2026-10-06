# Lango

Lango is a JavaScript-transpiling language designed for readable, pragmatic
programs. Its language decisions are in `design/`.

## Faz 1

Faz 1 is the first executable vertical slice. It compiles the
`examples/002-main-branch` program and supports:

- separate `export main(args)` header followed by `main(args)`
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

## Faz 3

Faz 3 adds `loop while`, `<`, `break`, `continue`, and `name++`. See
`examples/004-loops`.

## Faz 4

Faz 4 adds single-line array literals, `for values as value`, and `Array#add()`.
See `examples/005-arrays`.

## Faz 5

Faz 5 adds multiline object literals, dot access, and `for object as key: value`.
See `examples/006-objects`.

## Faz 10

Faz 10 adds a class-level `properties` section. Declared `@property` names are
emitted as JavaScript public fields; other `@property` names remain JavaScript
private `#fields`. See `examples/010-public-properties`.

## Faz 11

Faz 11 adds initialized class-level values through a `static` section. They are
read as `Class.Name` outside the class and as `@@Name` in instance methods. See
`examples/011-static-values`.

## Faz 12

Faz 12 adds the readonly `enum` class section. Its values are accessed like
static values, but an assignment through `@@Name` is a compiler error. See
`examples/012-enum-values`.

## Faz 13

Faz 13 adds single inheritance with `class Child : Parent`, `super(...)`, and
`super.method(...)`. See `examples/013-inheritance`.

## Faz 14

Faz 14 adds direct imports of exported Lango classes with `class Name` in an
import header. See `examples/014-class-modules`.
