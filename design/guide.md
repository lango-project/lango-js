# Lango Programming Guide

## Code Structure

  * A file has imports and then standalone exports at the start, followed by
    declarations. A function export precedes every class and function
    declaration; a class is exported inline as `export class Name`.
  * An entry file exports `main(args)`. The host starts the program by calling
    it with its argument array.
  * `args` is an array of strings supplied by the host; it does
    not include the executable or entry-file name.
  * Normal completion means success. A numeric value returned from `main` is an
    exit code for command-line hosts.
  * If `main` returns a Promise, the host waits for its completion before
    determining the program outcome.
  * A Promise that `main` does not return is detached work. It does not delay
    the program outcome.
  * Root level has no free executable statements. Executable code belongs in a
    function, method, or test body.
  * A file can have class, function, global, context, and test
    declarations.
  * The compiler or host selects Node, browser, test, and database environments.
    Host services are accessed through explicit libraries, `args`, or `context`.
  * The first compiler output is ES2022 ESM: `.mjs` files for Node 24+ and
    modern ESM-capable browsers. The compiler writes external source maps;
    bundling is a host/build-tool concern.
  * Each build also contains a private `.lango/runtime.mjs`. Generated modules
    import only the helpers they use through compiler-calculated relative paths.
    The host configures that runtime before it calls exported `main(args)`.
  * Indented structure. Normal block bodies are four spaces deeper than their
    header. An `else` is two spaces deeper than its `if`, and its body is four
    spaces deeper than the `else`.
  * TAB characters are forbidden everywhere in source, including comments and
    text literals. Use `\t` when text needs a tab character.
  * Line oriented. Operators or paranthesis imbalance denotes line continuation.
  * A closing parenthesis, bracket, or brace may dedent to the start of its
    enclosing expression. This keeps chained calls aligned without ending the
    expression.
  * \# for comments

## Diagnostics and formatting

Every compiler diagnostic has a stable code such as `LNG1001`, a severity, and
a primary source span (file, one-based line and column range). A diagnostic may
include related spans when another location explains the problem. The compiler
reports as many independent errors as it can in one run, although errors after
recovery may be incomplete. Any error, including a semantic error, prevents
output emission.

The formatter operates only on parseable source. It preserves comments and
intentional blank-line separation, collapses repeated blank lines to one,
removes trailing whitespace, rejects TAB characters, and applies the indentation
and delimiter-alignment rules in this guide. It does not silently reformat an
invalid file. Run `node src/cli.mjs format file.lango` to format a file in
place.

## Function Definition

Leftmost definiton denotes a function.
```lango
add(a, b)
    return a + b
```
If you define it in code, then:
```lango
    add = (a, b)
        return a + b
```
Parameters can have a default value. They remain positional arguments:
```lango
greet(name, prefix = "Hello")
    return "${prefix}, ${name}"

greet("Savaş")
greet("Savaş", "Merhaba")
```
There are no rest parameters or argument-spread syntax. Pass a variable number
of values as one array argument instead. Parameters without a default value are
required. Functions cannot be overloaded; use a different name, a default
parameter, or an object argument for a different calling shape.
As a parameter to an existing function:
```lango
run_later(1000, ()
    println("Hello")
)
```
An inline closure is convenient as the last argument of a multiline call. This
does not change JavaScript argument order. For an API whose callback belongs
elsewhere, bind the closure first:
```lango
tick = ()
    println("tick")

setInterval(tick, 1000)
```
Callbacks receive only their declared positional arguments. A JavaScript API's
callback `this` is not visible in Lango; use an argument, `context`, or
`capture` when the callback needs outside state.

Imported JavaScript functions use their native argument rules. Calling a method
through its object preserves that object as JavaScript `this`; taking an
imported method as a value does not. Use an explicit closure when its receiver
matters:
```lango
callback = (value)
    capture client
    client.send(value)
```
Calling a non-function value raises `NotCallable`. JavaScript `undefined`
returns as `null`; JavaScript errors propagate unchanged. Convert a Decimal
explicitly with `to_js_number($value)` before passing it to a normal JavaScript
numeric API.

## Class and Method Definitions

```lango
class Manager

Manager() # Constructor
    @surprise = 10
  
Manager:add(a, b) # Method
    return a + b + @surprise

Manager::CreateInstance() # Static method
    return new Manager()
```
Instance methods are called through their receiver. To use one as a callback,
write a closure that calls it; `callback = manager.add` is not valid Lango.
Construct any class, including an imported JavaScript class, with `new`:
```lango
manager = new Manager()
emitter = new events.EventEmitter()
```

### Properties

Variables starting with @ are instance properties. They are private.

Variables starting with @@ are static properties.

Variables starting with _ (underscore) are protected instance properties.

There are no protected static properties; `@@_name` is invalid. The
`properties` section declares only the public API, not types or initial values.
A public property may therefore be initialized lazily. Reading a known property
before its first assignment gives `null`; reading an unknown property is a
compile-time error. Private and protected properties become known through an
assignment somewhere in their declaring class.

For example:

```lango
class Manager

Manager:do_it()
    @prop = 3
    _name = "Savaş"
    @@statik = true
```


### Public

To make classes, properties and methods public, they should be exported at the start of the file. All classes are reachable within themselves at the same file.

Public methods are listed at the start of the class:
```lango
export class Manager
    properties
        length
        quality
        _name # Protected
    methods
        add(a, b)
        kill()
```

Will be used as @length, @quality in the class implementation.

The `methods` list is the public instance API. The `static` list holds both
static values and public static methods. An implementation written as
`Manager:helper()` or `Manager::helper()` but omitted from that list is private.
Inside its class, call it with ordinary source syntax such as
`this.helper()` or `Manager.helper()`; the JavaScript backend chooses private
`#` method syntax where needed. A static public method is listed as
`create(name)` under `static`.

### Inheritance

Inheritance can be used as expected.
```lango
class Employee : Person

Employee(name, id)
    super(name)
    @id = id

Employee:describe()
    return super.describe()
```
Only one ancestor class is allowed; mixins and interfaces are not core language
features. A child constructor calls `super(...)` exactly once as its first
executable statement. A child without its own constructor forwards its arguments
to the ancestor automatically. Public and protected members are inherited;
private ancestor members are not accessible.

Use `super(...)` for the ancestor constructor and `super.method(...)` for an
ancestor instance method. Public inherited members need not be listed again;
an override cannot make a public or protected member less visible. Static lookup
checks the child before the ancestor, as in JavaScript.

### Static and Enum Values

Use `static` for mutable class values and `enum` for readonly class values:
```lango
class Color
    static
        Default = new Color(255, 255, 255)
    enum
        White = new Color(255, 255, 255)
        Black = new Color(0, 0, 0)
```
Outside the class, use `Color.White`; inside it, use `@@White`. These are
ordinary static properties, not a closed enum or exhaustive switch type. `enum`
makes the binding readonly: assigning `@@White` is a compile-time error. It does
not freeze an object or array held by the value.

## Variables

Variables are defined when first assigned:

    i = 0

Variables and properties are mutable. There is no `const`, `readonly`, or
immutable-binding declaration.

It is a compiler error to read it before defined.

After an `if`, a variable is available only when every normally continuing
branch assigned it. An assignment made only inside a loop does not make the
variable available after that loop; assign it before entering the loop instead.
The same conservative rule applies to captured local variables: they must be
assigned before the closure is created.

`null` is the only absence value. JavaScript `undefined` and a missing object
property are seen as `null` in Lango. Use `value == null` to test for absence.
Use `value?.property` to access a property only when its receiver is present;
the result is `null` when an optional receiver is `null`. Optional segments may
be chained, for example `user?.profile?.name`. Use `value?.[index]` for
null-safe indexed access. `value?.method()` calls a method only when its
receiver is present.

It may be defined like this:
```lango
if blabla
    n = 333
  else
      n = 666 # If all paths are defining it, then it is no error to use it later
```
### Global Variables

They are explicitly declared at the file level, and the *global* keyword is
used for accessing them inside a function or method.
```lango
global surprise = 10

add(a, b)
    global surprise
    return a + b + surprise
```
## Objects
A flexible object can be defined like this:

    o = {}

And properties can be assigned freely:

    o.name = "Savaş"

Relaxed JSON notation can be used:
```lango
data = {
    name: "Savaş"
    surname: "Alparslan"
    children: ["Özgür"]
}

println(data.name)
println(data["name"]) # Same with the above
```
Braces always create an object; they never create a code block. For short
objects, fields can be written inline and separated with comma-space:
`{ name: "Savaş", active: true }`. Multiline objects have at most one field per
physical line and use newlines rather than commas. A field key may be a bare
name (including `$price`) or quoted text. Computed keys and object spread are
not supported; repeating a key is a compile-time error.
Use bracket access for a quoted key, for example `user["display name"]`.

An object field beginning with `$` is a Decimal field:
```lango
invoice = {
    $price: 12.50
    quantity: 3
}

$total = invoice.$price * invoice.quantity
```
## Arrays

Arrays can also be defined freely.
```lango
a = ["Bill", "Elon"]
a.add("Savaş") # instead of push()

println(a[2])

a.length
```
An array may use commas only when all of its members are on one physical line.
A multiline array has one member per line and no commas:
```lango
names = [
    "Bill"
    "Elon"
]
```
Function parameter and argument lists retain comma separators, but only when
their list is on one physical line. Multiline function lists are not currently
part of the syntax.
## 
## Control Structures

### If
```lango
if n == 5
    println("Five")
  else # This is not an indentation bug.
      println("Not five")
```
_Else_ is indented two spaces deeper than its `if` to make its relationship
clear (and a little ugly).

No elseif. Use _switch_ for it.

### Switch

First usage:
```lango
switch n
  case 3
  case 5
      println("Hello")
  case 6
      println("Six")
  else
      println("Good bye")
```
Or
```lango
switch
  case n == 5
      println("Five")
  case n > 100
      println("Big")
  else
      println("Not five")

```
### Loop
```lango
n = 0
loop while n < 100
    println(n)
    n++
```
```lango
n = 0
loop until n == 100
    println(n)
    n++
```
```lango
n = 0
loop 
    println(n)
    n++
    if n == 100
        break
```
####  Leveled break and continue

You can use the following to break from a 3 level inner loop:

    break 3 # Cannot use a variable here

### For (Iterator)
```lango
for array as n
    println(n)
```
```lango
for obj as name: value
    println("${name}=${value}")

```
Arrays, strings, and other JavaScript iterables can be used with the
single-value form. Plain objects use the `key: value` form. `Map` and `Set`
remain ordinary JavaScript values; a `Map` may also use the `key: value` form.
### Return

*return* returns a value (or not) from a function or method as expected.

## Operators

Operators are as usual, except: Logical operators _and_, _or_ and _not_ can be used alongside &&, || and !. Operators at the same precedence level associate from left to right; exponentiation (`**`) instead associates from right to left and binds more tightly than multiplication. Conditions require `true` or `false`; Lango does not use JavaScript truthiness or implicit conversion. Arithmetic operators, including remainder (`%`), work on numbers, and strings are composed with interpolation.

There should be space before and after an operator, except unary operators.
`value ?? fallback` evaluates to `fallback` only when `value` is `null`; `false`,
`0`, and empty strings are retained.
Use `item in values` to test exact membership in an array, or substring
membership when both operands are strings. With a string item and an object,
it tests that object's own keys only. Host `Set` values use their native exact
membership semantics. Host `Map` values test their keys with the same native
semantics.
Use `item not in values` for the inverse test.

## Strings and localization

There is one string kind: a primitive JavaScript string. Single and double
quotes are equivalent except for delimiter/escape convenience, and both support
interpolation:

```lango
name = 'Savaş'
message = 'Hello, ${name}'
```

Localization is explicit. `_()` accepts a string literal, extracts it during
compilation, and returns the translated primitive string at runtime. Its
source template is the default catalog key and fallback; `${expression}` values
become catalog placeholders.

```lango
message = _("Welcome, ${name}")
```

### Multiline
```lango
message = """
    Here is a
    multiline string.
"""
```
The value is `Here is a\nmultiline string.`: the outer line breaks are omitted and
the shared indentation of nonblank lines is removed. The closing `"""` may be
aligned for surrounding code without changing the value. Blank lines contain no
whitespace. A multiline string must place both delimiters on their own lines;
write short text as `"text"`. Use explicit `\n` or `\t` when those characters
are part of the value.
### Comparison

String comparisons are exact and case-sensitive: `"I" == "i"` is false. Use
`!=` for the inverse comparison.

### As an Array

Strings are Unicode code-point arrays. `length`, `for ... as`, and
individual `[]` access all use zero-based code points, so a surrogate-pair emoji
is one element. Grapheme clusters are not combined: a visually single composed
emoji may contain several elements. An out-of-range index is `null`.

## Standard Lib

The standard library provides the absolute minimum functions.
```lango
from_json(text)
to_json(object)
_(literal)
println(value)
is_number(value)
is_string(value)
is_bool(value)
is_object(value)
is_array(value)
to_js_number($decimal)
get_class(value) # Can be used as get_class(value) == MyClass
is_kindof(value, Class) 
```
`println(value)` writes the host's display form of one value followed by a line
break and returns `null`. It is the portable Lango output function; source code
does not use a host `console` global.
`get_class(null)` is `null`. Primitive values report `Number`, `String`, or
`Boolean`; objects report their prototype constructor. `is_kindof` follows
inheritance for objects and is false for `null`. These checks use native
JavaScript realm identity; values from another realm are not given a special
Lango identity.
`from_json` parses a numeric JSON field whose name starts with `$` directly as
a Decimal. This preserves the numeric token's precision.
Other JSON numeric fields are native JavaScript Numbers. Assign one to a `$`
binding when Decimal arithmetic is needed, accepting that JSON parsing may
already have lost precision; Lango has no separate Decimal-JSON parser or
field-selection syntax.
`from_json` accepts a string and returns only plain JSON-shaped values;
invalid input reports `JsonParseError` with its input location. `to_json` returns
a string and accepts only JSON-shaped values, including Decimal.
Dates, binary data, Map/Set, class instances, functions, Promises, and other
custom objects require an explicit library conversion first. Cycles raise
`JsonCycle`, and non-finite numbers raise `NonFiniteNumber` rather than becoming
JSON `null`.

## Embedded SQL

Here's an example:
```lango
rs = SQL
    select name, surname
    from students
    where birth_year > :year
rs.year = 2011
rs.execute()
loop while rs.next()
    println("${rs.name} ${rs.surname}")
```
`:year` is a named query parameter. Set it through the result before execution;
it is bound as data rather than inserted into the SQL text.

Assigning a `$` Decimal to a named SQL parameter preserves its exact canonical
decimal spelling through the database adapter; it is never silently narrowed to
a JavaScript Number. A driver without Decimal/numeric parameter support reports
an error.

If a SQL statement returns multiple result sets, `next_result()` moves to the
next set and returns whether one exists. `next()` moves to a row and returns
whether one exists; reading `rs.field` without a current row is an error.
`rs.parameter = value` is only parameter binding before execution, never a
result-row update. A non-row statement exposes `rs.affected_rows`: it is the
number of affected rows when the driver reliably reports one, otherwise `null`.
For a single-row `insert`, `rs.generated_key` is the automatically generated
key when the driver provides it; otherwise it is `null`. It is also `null` for
multi-row inserts. For multiple or composite generated values, use `returning`
and read ordinary result rows instead.

```lango
rs = SQL
    insert into orders (customer_id)
    values (:customer_id)

rs.customer_id = customer_id
rs.execute()
order_id = rs.generated_key
```

```lango
rs = SQL
    insert into orders (customer_id)
    values (:customer_id)
    returning id

rs.customer_id = customer_id
rs.execute()

if rs.next()
    order_id = rs.id
```

Use named `:parameter` values for dynamic SQL values. String interpolation is not
used for parameter binding: `:parameter` is always passed to the database as
data. `${expression}` is also allowed in SQL and is inserted directly into the
SQL string. It uses ordinary string conversion. Use it deliberately for dynamic identifiers, keywords, or SQL
fragments; it is not escaped or parameterized, and interpolated content cannot
create new `:parameter` bindings.

### Transactions

The core database library uses one default database and keeps its active
connection and transaction in synchronous dynamic context. Begin and finish a
transaction with `start_trans()`, `commit_trans()`, and `rollback_trans()`;
queries executed below `start_trans()` automatically use that transaction.

```lango
save_order(order)
    start_trans()
    insert_order(order)
    reserve_stock(order)
    commit_trans()

reserve_stock(order)
    start_trans() # joins the current transaction
    reserve(order.items)
    commit_trans() # finishes only this inner scope
```

`start_trans()` starts a transaction when none is active. When one is already
active, it silently joins it; only the outermost `commit_trans()` performs the
database commit. An inner `rollback_trans()` makes the one physical transaction
`rollback_only`. The outermost `commit_trans()` then rolls it back and raises
`TransactionRolledBack`, so a caller cannot mistake that outcome for a commit.
Calling `commit_trans()` or `rollback_trans()` without an active transaction is
an error.

`trans_state()` returns `null` when there is no active transaction, or one of
`'active'`, `'rollback_only'`, or `'failed'` while one is active. A completed
transaction has no retained context state; application code that needs an audit
result stores it itself.

Use `DB.Active`, `DB.RollbackOnly`, and `DB.Failed` when comparing an active
state. They are the corresponding stable state values; there is no `DB.Idle`,
because the inactive state is `null`.

Core transactions are for synchronous server-side database work. They do not
cross Promise, timer, or event callback boundaries. The core library has no
connection-selection API and does not create SQL savepoints for nested
`start_trans()` calls; multi-connection and savepoint-oriented work belongs in
an explicit advanced database library.

### SQL errors

Database and driver failures raise `SqlError`. Its `message` is suitable for
display or logging; `code` is the adapter's stable database/driver error code
when available, otherwise `null`; `query` is the SQL string; and `position` is
the position reported by the adapter when available, otherwise `null`. Its unit
is adapter-specific. Parameter values are never interpolated into `query` or a generated
error message.

```lango
try
    rs.execute()
catch err
    if err.code == "unique_violation"
        throw "This email is already registered"
    throw err
```

### Timeouts and cancellation

The core database library has no source-level query-cancellation API. A timeout
is configured by the selected host or database adapter and is reported as
`SqlError` (normally with `err.code == "timeout"` when the adapter supplies
such a code). If the adapter reports that the timeout left the active
transaction unusable, `trans_state()` becomes `'failed'` and the only valid
finish is `rollback_trans()`. Client-driven cancellation and cancellation that
needs another database connection belong to an advanced database library.

An adapter reports this condition by throwing its normal database error with
`transactionUnusable` set to `true`; the runtime still exposes that error as a
`SqlError`.

### Database configuration

Lango source does not name a database adapter, connection string, or credential.
The compiler/host configuration selects one `database_adapter` and deployment
configuration supplies that adapter's default connection settings and secrets.
Outside a transaction, `rs.execute()` uses this default connection. Inside a
transaction, it uses the default connection bound by `start_trans()` in the
current context. A database operation with no configured default adapter or
connection raises `DatabaseNotConfigured`.

## Embedded XML

At the start of an expression, `<tag` starts an XML literal; in an operator
position, `<` remains comparison. XML's static structure must be well-formed at
compile time. An XML literal produces a string. Its source whitespace is
preserved.

`${expression}` is allowed only in text nodes and quoted attribute values. It
is XML-escaped for that position, so it cannot introduce markup, a tag name, or
an attribute name. Dynamic XML structure and XML parsing/manipulation use a
separate library.

```lango
xml_name = "<Savaş & Co>"

xml = <customer name="${xml_name}">
        <status>active</status>
      </customer>

# name="&lt;Savaş &amp; Co&gt;"
```

```lango
xml = <student name="Savas" />

xml = <records>
        <item />
        <item />
      </records>

call(333, <item/>)
```

TODO should it be closed properly? Or just relax and accept any chunk?

## Numbers

Numbers are normal JavaScript `Number` values by default. Use an explicit
Decimal binding when exact decimal arithmetic is needed:
```lango
$price = 12.50
$tax = 2.50
$total = $price + $tax

chart.plot(to_js_number($total))
```
Decimal is implemented by a compiler-embedded, pinned runtime; source code does
not import or configure a Decimal package. The compiler profile controls only
the documented division scale and rounding mode.
When an expression contains a `$` Decimal value, its other numeric operands are
Decimal values too. A Decimal result must be stored in a `$` binding. Use
`to_js_number($decimal)` only when a JavaScript library needs a native Number.
When `??` combines `null` with a Decimal value, its result is also Decimal.
Decimal addition, subtraction, and multiplication are exact. Division is valid
at the configured number of fractional digits, which defaults to six. It uses
the configured rounding mode, which defaults to half-even.
When a function returns a Decimal on one reachable path, all of its normal
return paths must return Decimal values. The compiler infers this across Lango
calls and closures; a Decimal-returning result must be kept in a `$` binding,
passed to a `$` parameter, used in a Decimal expression, or discarded.
Decimal has no `Math` function surface and no per-operation `round`, `floor`,
`ceil`, or `sqrt`. Use `**` for exponentiation and `%` for remainder. Advanced
math goes through an imported JavaScript library after an explicit
`to_js_number($decimal)` conversion; assigning its finite result to a `$`
binding converts it back to Decimal.
`NaN`, `Infinity`, and `-Infinity` are not Lango numbers; producing or receiving
one is a runtime error.
Numeric literals support decimal (`12`, `12.50`), scientific notation (`1.2e3`),
and hexadecimal integers (`0xFF`).
When a native Number enters a Decimal expression, it is converted from its
normal short decimal representation. `to_js_number($decimal)` may lose
precision because it explicitly converts back to a native Number.

## Closure

Outside variables to be captured inside the closure should be explicitly specified by the *capture* keyword:
```lango
make_adder()
    number = 666

    return (a, b)
        capture number
        return a + b + number
```
Instance and static properties used by a closure must also be captured. A
property capture keeps its owner, not a snapshot of its current value:
```lango
return ()
    capture @count, @@limit
    @count = @count + 1
    return @count < @@limit
```
Each nested closure declares its own captures. Captures are shared bindings, so
a closure may change a captured local. A `for` loop gives each iteration its
own captured item; a local declared outside a `loop` remains shared across its
iterations. Put every `capture` at the start of the closure body. Missing or
unused captures are compile-time errors; a missing capture reports
`MissingCapture` and the needed name.
## Context

Context variables are used for dependency injection or not to carry specific variables through all functions or methods.

To create a context variable:

    context pi = 3.14

In anywhere below the call stack, you can use this variable whenever you want:

    context pi

Context variables are read through their bare name and cannot be assigned with
a normal assignment.

Context is a synchronous dynamic stack. A nested `context name = value` shadows
the previous value until its current function activation returns or throws;
recursive and re-entrant calls get their own layer. A JavaScript API that calls
a Lango callback synchronously can see the active context. Promise, timer, and
event callbacks cannot: copy a needed context value to a local binding and
`capture` it before registering the callback.

You can only assign it inside the *context* statement. This creates a scoped
value: all calls below the current stack frame use it, and leaving that frame
restores the previous value.
```lango
f()
    context pi = 3
    g()
    println(pi) # prints 3

g()
    context pi
    println(pi) # prints 3
    h()
    println(pi) # still prints 3 even though h() changes it to 3.14

h()
    context pi = 3.14
    j()

j()
    k()

k()
    context pi
    println(pi) # prints 3.14
```

## Promises

Promises use ordinary method calls and closures.
`fetch` is the selected browser/Node host's standard callable and needs no
JavaScript namespace import.
```lango
fetch(input).then((output)
    if not output.ok
        throw {
            type: "HttpError"
            status: output.status
        }

    return output.json()
).then((data)
    println("${data.name}")
).catch((err)
    println("Request failed: ${err.message}")
)
```
`then`, `catch`, and `finally` are the standard JavaScript Promise methods.
HTTP error responses are handled by checking `output.ok`; they do not normally
reject `fetch` on their own.

An ordinary `try/catch` does not catch a later Promise rejection; use a later
`.catch(...)` in that chain. A Promise returned from `main` determines the
program outcome, while a detached Promise follows the host's normal unhandled-
rejection behavior. Lango adds no cancellation or concurrency model beyond the
JavaScript library in use.

`context` does not automatically cross into a Promise callback. Copy a needed
context value into a local binding and capture that binding explicitly:
```lango
load()
    context tenant
    saved_tenant = tenant

    fetch("/data").then((response)
        capture saved_tenant
        audit(saved_tenant, response)
    )
```

## Unwanted Features

*async* and *await* have no place. Promise operations are handled explicitly
with their methods.

Continuation is complicated.

No destructuring. No named parameters. Still parameters can be sent as relaxed JSON. For example:

```lango
register_student({
    name: "Savaş"
    surname: "Alparslan"
})

```


Setters and getters are confusing.

## Test

Unit tests use `test` blocks in ordinary source files. A quoted text after
`test` is its display name; an unnamed test receives a stable source-location
name.
```lango
test
    assert add(3, 5) == 8
```
```lango
test "addition test 1"
    assert add(3, 5) == 8
```
`assert` failures are `AssertionFailed` and report the original asserted
expression and source location. Tests are discovered during compilation,
excluded from production output, and run in deterministic module-path then
source order. Each receives a fresh Lango module state and dynamic context, so
Lango globals and static values do not leak between tests. External JavaScript
modules retain their host cache behavior.

Tests run synchronously in the first runner. A failing test does not stop later
tests; the runner reports every failure at the end. There are no special setup
or teardown hooks: use normal helpers and `try`/`finally`. Test filtering by
name or path is a test-runner option, and coverage is tooling rather than a
language feature.

## Import/Export

Functions and classes can be exported and imported within source codes.

Class export syntax is mentioned above. Let's repeat it here:
```lango
export class Manager
    properties
        length
        quality
    methods
        add(a, b)
        kill()
```
Functions and global, context variables are exported with full headers:
```lango
export add(a, b)

export # export multiple
    add(a, b)
    subtract(a, b)
    global surprise
    global
        another_surprise
    context ctx
```
Imports are also specified with full headers:
```lango
import "./another_file"
    add(a, b)
    class Manager
    alias surp = global surprise
    alias Admin = class Manager
        properties
            length
        methods
            add(a, b)
        static
            create(length)
```
*alias* keyword is used to avoid name clashes. Properties and methods cannot be aliased.

The path is relative to the importing source and omits the `.lango` extension.
JavaScript packages and host modules use a namespace import:
```lango
import js "node:fs" as fs
```
Use a JavaScript namespace path with `/`, for example
`fs/promises/readFile(...)`. Ordinary object properties and methods continue to
use `.`, such as `file.name` or `file.close()`. A namespace call may be used as
an ordinary expression statement when its result is intentionally discarded.
Lango module cycles are allowed
for functions and classes. A cycle cannot read an uninitialized global or static
value from another module; that is a compile-time error. Module cycles are
resolved before the rest of compilation.

## Throw and Try/Catch/Finally

This feature is as usual, except catch cannot catch specific exceptions.
```lango
try
    ...
catch err # err or anything else
    ...
finally
    ...
```
throw statement can throw anything you want and the err parameter holds it.

    throw {
      type: "Runtime"
      code: 666
      message: "Syntax Error"
    }

Use `finally` to release a resource explicitly:
```lango
connection = database.open()

try
    connection.execute()
finally
    connection.close()
```
