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

Run a program directly with its Lango arguments after `--`:

```sh
npm run run -- examples/002-main-branch/input.lango Ada
```

## Faz 2

Faz 2 adds same-module functions, `return`, calls with arity validation,
Boolean/null literals, and numeric `+`, `-`, `*`, `/`, `%`, `**`, `>`, `==`, and `!=` expressions.
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

## Faz 15

Faz 15 adds protected instance properties with `_name`, accessible from a class
and its descendants but not through Lango external member access. See
`examples/015-protected-properties`.

## Faz 16

Faz 16 adds static methods with `Class::method()` and calls such as
`Class.method()`. See `examples/016-static-methods`.

## Faz 17

Faz 17 adds class-import aliases with `alias Local = class Exported`. See
`examples/017-class-import-alias`.

## Faz 18

Faz 18 adds class API declarations. Listed `methods` are public instance
methods; listed `static` methods are public static methods. Other implementations compile to JavaScript
private methods. See `examples/018-public-methods`.

## Faz 19

Faz 19 adds value and condition-only `switch` with grouped non-fallthrough
cases. See `examples/019-switch`.

## Faz 20

Faz 20 makes Lango's sole equality spelling, `==`, compile to JavaScript strict
equality. See `examples/020-strict-equality`.

## Faz 21

Faz 21 adds `not`, `and`, and `or` logical aliases. See
`examples/021-logical-operators`.

## Faz 22

Faz 22 adds decimal, scientific, and hexadecimal number literals. See
`examples/022-number-literals`.

## Faz 23

Faz 23 adds variable-index and string-key bracket access. See
`examples/023-bracket-access`.

## Faz 24

Faz 24 adds value-free `return`. See `examples/024-empty-return`.

## Faz 25

Faz 25 adds nested dot access such as `order.customer.name`. See
`examples/025-nested-access`.

## Faz 26

Faz 26 adds nested multiline object literals. See
`examples/026-nested-objects`.

## Faz 27

Faz 27 adds standalone function-call statements such as `finish()`.

## Faz 28

Faz 28 adds local closures with an explicit `capture` header. See
`examples/028-closures`.

## Faz 29

Faz 29 makes closure capture declarations meaningful: an outer binding must be
captured, a capture must be used, and local captures must be assigned before
the closure is created.

## Faz 30

Faz 30 permits a function to return a closure directly. See
`examples/030-returned-closures`.

## Faz 31

Faz 31 makes an explicit `capture @property` retain the original class
instance in a returned closure. See `examples/031-property-capture`.

## Faz 32

Faz 32 verifies nested closures: each closure declares its own direct capture,
while the captured binding remains shared. See `examples/032-nested-closures`.

## Faz 33

Faz 33 validates captured instance and static properties against the enclosing
class, and rejects property captures outside class methods.

## Faz 34

Faz 34 verifies static-property capture and rejects malformed or duplicate
capture declarations. See `examples/034-static-capture`.

## Faz 35

Faz 35 extends explicit closure capture to protected properties. See
`examples/035-protected-capture`.

## Faz 36

Faz 36 preserves a captured local as one shared, mutable binding rather than a
new closure-local variable. See `examples/036-shared-capture`.

## Faz 37

Faz 37 adds synchronous, dynamically scoped `context` bindings. See
`examples/037-context`.

## Faz 38

Faz 38 verifies nested context shadowing and restoration on function return.
See `examples/038-context-restoration`.

## Faz 39

Faz 39 makes declared context bindings available in class methods. See
`examples/039-class-context`.

## Faz 40

Faz 40 gives closures their own explicit context declarations. See
`examples/040-closure-context`.

## Faz 41

Faz 41 adds mutable file globals with explicit per-function access
declarations. See `examples/041-globals`.

## Faz 42

Faz 42 requires closures to declare globals explicitly before using them. See
`examples/042-closure-global`.

## Faz 43

Faz 43 adds standard `from_json()` and `to_json()` helpers. See
`examples/043-json`.

## Faz 44

Faz 44 checks JSON-helper arity and reports malformed input as `JsonParseError`.

## Faz 45

Faz 45 adds `get_class()` and `is_kindof()` reflection helpers. See
`examples/045-reflection`.

## Faz 46

Faz 46 adds explicit standard-library predicates for number, string, Boolean,
object, and array values. See `examples/046-predicates`.

## Faz 47

Faz 47 requires Boolean values for conditions and logical operators instead of
using JavaScript truthiness. See `examples/047-boolean-conditions`.

## Faz 48

Faz 48 adds `loop until` and unqualified `loop` forms. See
`examples/048-loop-until`.

## Faz 49

Faz 49 lets `array.add(value)` be used as an expression and preserves its new
length result. See `examples/049-array-add-return`.

## Faz 50

Faz 50 adds `run <input.lango> [args...]` to the CLI for programs that export
`main(args)`.

## Faz 51

Faz 51 adds validated `break N` and `continue N` for nested loops. See
`examples/051-loop-levels`.

## Faz 52

Faz 52 adds discoverable `test` blocks and `assert` statements. Production
builds omit them; `npm run test:lango -- <input.lango>` runs them synchronously.

## Faz 53

Faz 53 resets dynamic context, file globals, and class static values before
each CLI-run Lango test.

## Faz 54

Faz 54 rejects unknown instance, protected, and static property references in
class code.

## Faz 55

Faz 55 validates that declared public instance and static method signatures
match their implementations.

## Faz 56

Faz 56 rejects duplicate static member names across `static` values, `enum`
values, and public static methods.

## Faz 57

Faz 57 rejects duplicate public instance members and duplicate class-method
implementations.

## Faz 58

Faz 58 aligns statically known Lango calls with the default-parameter rule:
excess arguments are ignored, while every required parameter must receive its
own positional argument.

## Faz 59

Faz 59 adds runtime arity checks for dynamically called Lango functions,
methods, and closures; excess arguments remain ignored.

## Faz 60

Faz 60 applies compile-time arity validation to direct constructor and
statically known class-method calls.

## Faz 61

Faz 61 normalizes JavaScript `undefined` at method boundaries and makes a
bare Lango `return` produce `null`.

## Faz 62

Faz 62 normalizes missing JavaScript property and index reads, including known
but unassigned class properties, to Lango `null`.

## Faz 63

Faz 63 rejects non-finite native-number arithmetic and JavaScript boundary
values with `NonFiniteNumber`.

## Faz 64

Faz 64 rejects a numeric literal that would compile to a non-finite JavaScript
Number.

## Faz 65

Faz 65 supports dynamic callback values and reports `NotCallable` for a
non-callable dynamic value.

## Faz 66

Faz 66 permits calls through local dynamic bindings and reports `NotCallable`
when the bound value is not a function.

## Faz 67

Faz 67 normalizes and validates JavaScript arguments at every Lango function
and method entry.

## Faz 68

Faz 68 applies the same JavaScript-boundary normalization and validation to
Lango closures.

## Faz 69

Faz 69 gives `to_json` Lango boundary semantics for nested `undefined`,
non-finite numbers, plain objects, and cycles.

## Faz 70

Faz 70 adds header-only JavaScript namespace imports such as
`import js "node:path" as path`; their namespace cannot collide with a Lango
declaration.

## Faz 71

Faz 71 lets closures explicitly capture JavaScript namespace imports and
resolves imported aliases by their local name.

## Faz 72

Faz 72 adds aliased Lango function imports, for example
`alias sum = add(left, right)`.

## Faz 73

Faz 73 verifies during a build that each selected Lango function or class is
actually exported by its target module.

## Faz 74

Faz 74 rejects duplicate imported local names and import/declaration name
collisions.

## Faz 75

Faz 75 validates direct calls to imported Lango functions against the signature
declared in the import header.

## Faz 76

Faz 76 requires an imported Lango function signature to match its target
export.

## Faz 77

Faz 77 rejects `@instance` and protected-property access from static class
methods.

## Faz 78

Faz 78 allows qualified JavaScript construction such as
`new events/EventEmitter()` after a namespace import.

## Faz 79

Faz 79 supports nested JavaScript namespace method calls such as
`fs/promises/readFile(...)`.

## Faz 80

Faz 80 reserves slash-separated namespace paths for imported JavaScript
namespaces; object properties and methods remain dot-separated.

## Faz 81

Faz 81 treats a JavaScript namespace itself as non-callable and reports
`NotCallable`.

## Faz 105

Faz 105 adds the initial synchronous SQLite adapter and core transactions:
`start_trans()`, `commit_trans()`, `rollback_trans()`, and `trans_state()`.
Nested transactions join the outer physical transaction; an inner rollback
makes it rollback-only. See `examples/105-transactions`.

## Faz 106

Faz 106 adds indented `SQL` query objects with statically declared named
parameters, `execute()`, `next()`, and current-row field access. See
`examples/106-sql-query`.

## Faz 107

Faz 107 adds `affected_rows` and `generated_key` on executed SQL query
objects. See `examples/107-query-results`.

## Faz 108

Faz 108 maps adapter failures to parameter-safe `SqlError` values with
`code`, `query`, and `position`. See `examples/108-sql-errors`.

## Faz 109

Faz 109 requires the host to configure the one default database adapter;
unconfigured database work raises `DatabaseNotConfigured`. See
`examples/109-database-configuration`.

## Faz 110

Faz 110 exposes an adapter-reported unusable transaction as `DB.Failed`; it
must be closed with `rollback_trans()`. See `examples/110-failed-transaction`.

## Faz 111

Faz 111 supports SQL `returning` clauses as normal query rows. See
`examples/111-returning`.

## Faz 112

Faz 112 binds Decimal SQL parameters as canonical text without narrowing them
to JavaScript numbers. See `examples/112-decimal-sql`.

## Faz 113

Faz 113 keeps arithmetic assigned to a Decimal binding in Decimal precision.
See `examples/113-decimal-assignment`.

## Faz 114

Faz 114 recognizes SQL parameters only outside quoted SQL text and comments.
See `examples/114-sql-parameters`.

## Faz 115

Faz 115 adds deliberate raw `${expression}` interpolation to SQL literals,
separate from safe `:name` parameter binding. See `examples/115-sql-interpolation`.

## Faz 116

Faz 116 recognizes PostgreSQL `::type` casts without treating a type name as a
SQL parameter. See `examples/116-postgres-casts`.

## Faz 117

Faz 117 adds explicit Decimal literals such as `$10.50` and `$1e3`. See
`examples/117-decimal-literals`.

## Faz 118

Faz 118 recognizes operators only at the current expression level, including
inside nested function arguments. See `examples/118-nested-expressions`.

## Faz 119

Faz 119 preserves commas inside quoted and nested function arguments. See
`examples/119-nested-arguments`.

## Faz 120

Faz 120 evaluates equal-precedence arithmetic chains from left to right. See
`examples/120-operator-order`.

## Faz 121

Faz 121 adds parentheses for explicit expression grouping. See
`examples/121-parentheses`.

## Faz 122

Faz 122 adds unary minus for native and Decimal values. See
`examples/122-negative-numbers`.

## Faz 123

Faz 123 adds inclusive `<=` and `>=` comparisons. See
`examples/123-inclusive-comparisons`.

## Faz 124

Faz 124 compares Decimal values without narrowing them to JavaScript numbers.
See `examples/124-decimal-comparisons`.

## Faz 125

Faz 125 compares compound Decimal expressions with Decimal equality. See
`examples/125-decimal-equality`.

## Faz 126

Faz 126 adds strict inequality with `!=`, including precision-safe Decimal
comparisons. See `examples/126-not-equal`.

## Faz 127

Faz 127 adds the remainder operator `%` for native and Decimal numbers. See
`examples/127-remainder`.

## Faz 128

Faz 128 adds right-associative exponentiation with `**` for native and Decimal
numbers. See `examples/128-exponentiation`.

## Faz 129

Faz 129 evaluates arithmetic whose two operands are compound Decimal
expressions through the Decimal backend. See
`examples/129-compound-decimal-arithmetic`.

## Faz 130

Faz 130 infers Decimal returns through nested compound arithmetic, while
keeping Decimal comparisons Boolean. See `examples/130-decimal-return-inference`.

## Faz 131

Faz 131 adds null coalescing with `??`. See `examples/131-null-coalescing`.

## Faz 132

Faz 132 adds array and string membership with `in`. See
`examples/132-membership`.

## Faz 133

Faz 133 adds negated membership with `not in`. See
`examples/133-not-membership`.

## Faz 134

Faz 134 extends membership to own object keys. See
`examples/134-object-membership`.

## Faz 135

Faz 135 adds inline object literals. See `examples/135-inline-objects`.

## Faz 136

Faz 136 adds quoted object keys. See `examples/136-quoted-object-keys`.

## Faz 137

Faz 137 rejects duplicate object keys at compile time. See
`examples/137-duplicate-object-keys`.

## Faz 138

Faz 138 infers Decimal function results through null coalescing. See
`examples/138-decimal-null-coalescing`.
