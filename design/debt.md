# Lango Design Debt

This is the list of intentionally unresolved language and implementation work.
Items belong here until an explicit decision moves them to `decisions.md`.

## Language semantics

### Define the `else` indentation grammar

The guide intentionally displays `else` at a different indentation from both
the `if` and its body. Specify the exact column relationship, nesting behavior,
and diagnostics. Test nested `if`/`else`, an `else` at file indentation zero,
and formatter round-tripping before accepting the rule.

### Complete definite-assignment analysis

Decide how assignment facts flow through loops, `break`, `continue`, returns,
throws, exception handlers, closures, generators, and async functions. Until
then, the compiler may implement the straight-line and `if`-branch subset only.

### Protected properties and property initialization

Protected instance properties use the `_name` form. Decide whether protected
static properties exist, whether public properties need a declaration initializer
or type, and what reading an uninitialized instance property means.

### Object literals versus blocks

Specify all parser boundaries between a brace-delimited object, a multiline
call, and an indentation block. Include trailing commas, computed keys,
spreads, reserved words, and duplicate keys.

### Text equality and internationalization

Case-insensitive text comparison needs an explicit Unicode normalization and
locale-independent casing policy. This is especially important for Turkish
`I`, `İ`, `ı`, and `i`. Also decide translation catalog format, message keys,
pluralization, escaping, and whether interpolations can be reordered by a
translation.

### Multiline text whitespace

Specify whether the indentation shared with the closing `"""` delimiter is
removed, and whether a first/last blank line is retained.

### Nullability and missing values

Define Lango's relationship to JavaScript `null`, `undefined`, optional object
properties, and optional chaining. D-024 already excludes JavaScript truthiness.

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

The guide gives numbers decimal semantics but deliberately leaves their runtime
details open. Choose an actual representation: JavaScript `number`, a BigDecimal
runtime, a compiler rewrite, or a restricted subset. Specify precision, rounding,
literals, division, NaN/infinity behavior, JSON conversion, and conversion at
JavaScript library boundaries.

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

### Mutability and resource lifetime

D-030 makes bindings and properties mutable and excludes an immutable-binding
form. Specify how resources such as files, database transactions, subscriptions,
and locks are reliably released. Decide whether `try`/`finally` is the only
mechanism or whether a small `defer`/resource-scope construct belongs in the
language.

### Collection and iteration boundary

Define which JavaScript collection values receive first-class Lango behavior:
arrays, plain objects, Map, Set, iterable values, and strings/texts. Specify
the `for` behavior for each and Unicode indexing/iteration of strings and
texts. Explicitly exclude generators if they remain outside the language.

## JavaScript interoperability

### Set the emitted JavaScript baseline

Choose the ECMAScript version, ESM/CommonJS strategy, source-map behavior, and
whether a runtime helper package is permitted.

### Program entry point and host contract

Decide whether module top-level code is the sole entry mechanism or whether a
`main()` convention exists. Specify how a program selects or receives its host
environment (Node, browser, test runner, database adapter), command-line
arguments, environment configuration, and exit/error behavior.

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
