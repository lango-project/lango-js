# Lango Design Debt

This is the list of intentionally unresolved language and implementation work.
Items belong here until an explicit decision moves them to `decisions.md`.

## Language semantics

### Multiline text whitespace

Specify whether the indentation shared with the closing `"""` delimiter is
removed, and whether a first/last blank line is retained.

### Promise and error integration edge cases

Specify Promise rejection stack traces, unhandled-rejection reporting, the
interaction between Promise `catch` and ordinary `try`/`catch`, cancellation,
concurrency, and context propagation.

### Function invocation contract

Specify calls into ordinary JavaScript functions, including methods on imported
JavaScript objects. D-025 defines positional default parameters,
missing-argument errors, excludes rest/spread syntax, and defines excess
arguments; D-026 excludes overloads, D-027 defines Lango instance-method
receivers, and D-028 defines callback invocation. The relaxed-JSON object-
argument convention does not replace these positional-call rules.

### Number model and arbitrary precision

D-038 defines native Numbers by default and explicit Decimal values through a
transpiler-selected backend, and D-039 defines exact arithmetic and division
rounding. Design exact Decimal JSON parsing/serialization for external schemas
that cannot use `$` field names, math-library functions, SQL parameter mapping,
and the adapter semantic test suite. Define Decimal-flow analysis for mixed
return paths, recursion, closures, higher-order functions, and module exports.

### Context execution model

Specify context shadowing, recursion, exception restoration, re-entrant calls,
callbacks, and async propagation. Decide the runtime mechanism for Node and
browsers, and how code that crosses into an uninstrumented JavaScript library
retains or loses context.

### Closure capture edge cases

Specify capture behavior for nested closures, mutation of a captured binding,
loop bindings, destructuring, globals, context names, imported names, and
instance/static properties. Define the diagnostic for an implicit capture.

### Inheritance and `super` edge cases

Specify constructor order and required `super` calls, method-resolution rules,
inherited public API declarations, static-member inheritance, visibility changes
in overrides, and the exact syntax for invoking an ancestor constructor or
method. Decide whether multiple inheritance, mixins, or interfaces are excluded
explicitly.

### Enum value semantics

The current `enum` block is close to a shorthand for public static class
instances. Decide whether it earns separate syntax through closed-member
semantics, constructor restrictions, identity/equality rules, exhaustive
switching, serialization, or enumeration APIs. If none of these are wanted,
replace it with ordinary static class constants rather than maintaining a
near-duplicate feature.

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
