# Lango Design Debt

This is the list of intentionally unresolved language and implementation work.
Items belong here until an explicit decision moves them to `decisions.md`.

## Language semantics

### Unicode string indexing and iteration

D-032 defines strings and texts as built-in iterable values. Specify whether
indexing with `[]` and iteration operate on UTF-16 code units, Unicode code
points, or grapheme clusters, and keep the choice consistent with string length
and text comparison.

## JavaScript interoperability

### Set the emitted JavaScript baseline

Choose the ECMAScript version, ESM/CommonJS strategy, source-map behavior, and
whether a runtime helper package is permitted.

### Imports and exports

The guide defines header-based imports and exports. Specify file-name/module
resolution, extension handling, JavaScript package specifiers, aliases, export
conflicts, initialization order, and runtime semantics for cyclic module graphs.
Module cycles are not macro-expansion rounds: resolve them as module-graph
components before macro expansion.

### Callback and argument adaptation

Clarify the rule behind trailing function arguments and the `setInterval`
example. Prefer one general, statically understandable adaptation rule over a
growing list of special-cased JavaScript APIs.

### Class construction and JavaScript classes

Specify how imported JavaScript constructors are distinguished from ordinary
functions, whether subclassing is supported, and how Lango visibility rules
interact with JavaScript fields and methods.

### Standard-library aliases

Inventory every intentional Lango alias such as `Array#add`, state its JavaScript
equivalent and return value, and decide whether aliases apply only to known
arrays or to any object exposing the underlying method.

### Reflection edge cases

Specify `get_class` and `is_kindof` behavior for null, undefined, primitive
values, objects with an overwritten `constructor`, proxies, and values from a
different JavaScript realm. Decide whether Lango supplies a stable class
identity beyond JavaScript's native constructor/`instanceof` behavior.

### JSON conversion edge cases

Specify `from_json`/`to_json` handling for Text, arbitrary-precision numbers,
dates, binary data, undefined/missing properties, non-finite numbers, custom
objects, and cyclic graphs. Decide the error type and source location reported
for invalid input.

### Embedded SQL contract

Define SQL-literal recognition, query formatting, identifier quoting, repeated
named parameters, parameter type conversion, statement/result-set API,
transactions, cancellation, diagnostics, and database adapter registration.
Decide whether `result.name = value` is exclusively parameter binding or can
also mutate a row. Add multi-database selection syntax here when it is designed.

### Embedded XML lexical and escaping rules

Define how XML literals are distinguished from `<`, `>`, and related operators;
which XML forms are accepted; and how interpolated text and attributes are
escaped. Decide whether parsing produces only validated text or an XML value
with query/manipulation operations.

### Macro evaluation and generated source

Define the compile-time expression subset available inside macros, macro
parameters and bindings, `IF` behavior, escaping and validation for `PASTE`,
hygiene/name-capture rules, source-map provenance, and expansion diagnostics.
Decide whether a macro may call an imported runtime function (presumably no)
and whether generated source may contain tests or translation texts. The
16-round limit applies to macro expansion only, never to resolving module cycles.

## Tooling

### Establish executable examples

Every accepted decision should gain at least one Lango input, expected JavaScript
output, and a runtime assertion. Start with parsing/formatting fixtures before
the full transpiler exists.

### Diagnostics and formatting

Define error spans, recovery behavior, error codes, formatter output, and the
policy for comments, blank lines, and line continuation.

### Test execution model

Specify test discovery order, test isolation, setup/teardown, assertion error
format, filtering, coverage, async tests, and how tests interact with imports,
macros, context, and production build output.
