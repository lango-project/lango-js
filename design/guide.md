# Lango Programming Guide

## Code Structure

  * A file has imports and exports at the start, followed by declarations.
  * An entry file exports `main(args)`. The host starts the program by calling
    it with its argument array.
  * `args` is an array of programmatic strings supplied by the host; it does
    not include the executable or entry-file name.
  * Normal completion means success. A numeric value returned from `main` is an
    exit code for command-line hosts.
  * If `main` returns a Promise, the host waits for its completion before
    determining the program outcome.
  * A Promise that `main` does not return is detached work. It does not delay
    the program outcome.
  * Root level has no free executable statements. Executable code belongs in a
    function, method, test, or macro body.
  * A file can have class, function, macro, global, context, and test
    declarations.
  * The compiler or host selects Node, browser, test, and database environments.
    Host services are accessed through explicit libraries, `args`, or `context`.
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
setInterval(1000, ()
    console.log("Hello")
)
```
_Function parameters should be the last one. Legacy functions like setInterval() get special treatment from the transpiler._
Callbacks receive only their declared positional arguments. A JavaScript API's
callback `this` is not visible in Lango; use an argument, `context`, or
`capture` when the callback needs outside state.

## Class and Method Definitions

```lango
class Manager

Manager() # Constructor
    @surprise = 10
  
Manager:add(a, b) # Method
    return a + b + @surprise

fn Manager::CreateInstance() # Static method
    return Manager()
```
Instance methods are called through their receiver. To use one as a callback,
write a closure that calls it; `callback = manager.add` is not valid Lango.

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

### Inheritance

Inheritance can be used as expected.
```lango
class Manager : HumanBeing
  
```
Each method can be overriden by defining again.

*super* keyword is used to access ancestor class.

### Enums

There is no separate enum structure. Enums are encapsulated in classes.
```lango
class Color
    enum
        White = Color(255, 255, 255)
        Black = Color(0, 0, 0)
```
Each enum member's value should be explicitly specified.

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

console.log(data.name)
console.log(data["name"]) # Same with the above
```
Braces always create an object; they never create a code block. An object has
at most one field per physical line. Its fields are separated by newlines, not
commas, so an object has no trailing comma. A field key may be a bare name
(including `$price`) or quoted text. Computed keys and object spread are not
supported; repeating a key is a compile-time error.

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

console.log(a[2])

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
    console.log("Five")
  else # This is not an indentation bug.
      console.log("Not five")
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
      console.log("Hello")
  case 6
      console.log("Six")
  else
      console.log("Good bye")
```
Or
```lango
switch
  case n == 5
      console.log("Five")
  case n > 100
      console.log("Big")
  else
      console.log("Not five")

```
### Loop
```lango
n = 0
loop while n < 100
    console.log(n)
    n++
```
```lango
n = 0
loop until n == 100
    console.log(n)
    n++
```
```lango
n = 0
loop 
    console.log(n)
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
    console.log(n)
```
```lango
for obj as name: value
    console.log("${name}=${value}")

```
Arrays, strings, texts, and other JavaScript iterables can be used with the
single-value form. Plain objects use the `key: value` form. `Map` and `Set`
remain ordinary JavaScript values; they have no special Lango syntax.
### Return

*return* returns a value (or not) from a function or method as expected.

## Operators

Operators are as usual, except: Logical operators _and_, _or_ and _not_ can be used alongside &&, || and !. Conditions require `true` or `false`; Lango does not use JavaScript truthiness or implicit conversion. Arithmetic operators work on numbers, and text is composed with interpolation.

There should be space before and after an operator, except unary operators.

## Strings and Text

There are two kinds of strings. Programmatic strings like 'code', and texts like "Elon Gates".

Texts can have interpolation like "My name is ${name}".

Texts can be subject to translation.

After macro expansion, texts are extracted into JSON translation catalogs. The
source template is both the default message key and fallback text. Interpolated
expressions become `{0}`, `{1}`, and so on in the catalog, so a translation may
reorder them. A host chooses the active catalog; Lango source does not choose a
locale.

### Multiline
```lango
text = """
    Here is a
    multiline text.
"""
```
### Comparison

Comparisons are case-sensitive for programmatic strings. Text comparisons use
Unicode NFC normalization and locale-independent Unicode case folding. Thus
`"I" == "i"` is true, whereas `"I" == "ı"` and `"İ" == "i"` are false even
when the program is shown in Turkish.

### As an Array

Strings and texts are character arrays. Individual characters are accessed with [].

## Standard Lib

The standard library provides the absolute minimum functions.
```lango
from_json(text)
to_json(object)
is_number(value)
is_string(value)
is_bool(value)
is_object(value)
is_array(value)
to_js_number($decimal)
get_class(value) # Can be used as get_class(value) == MyClass
is_kindof(value, Class) 
```
`from_json` parses a numeric JSON field whose name starts with `$` directly as
a Decimal. This preserves the numeric token's precision.

## Embedded SQL

Here's an example:
```lango
rs = SQL
         select name, surname
         from students
         where birth_year > @year
rs.year = 2011
rs.execute()
loop while rs.next()
    console.log("${rs.name} ${rs.surname}")
```
`@year` is a named query parameter. Set it through the result before execution;
it is bound as data rather than inserted into the SQL text.

The actual database connection and appropriate library calls are managed by the environment.

TODO syntax for multiple database 

If a SQL statement returns multiple result sets, *NextResult()* method is used to switch to the next one.

Use named `@parameter` values for dynamic SQL values. Text interpolation is not
used inside SQL.

## Embedded XML

XML is detected when the syntax is encountered.
```lango
xml = <student name="Savas" />

xml = <records>
        <item />
        <item />
      </records>

call(333, <item/>)
```
XML literals evaluate to text and normal `${expression}` interpolation can be
used in text or attribute values.

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
When an expression contains a `$` Decimal value, its other numeric operands are
Decimal values too. A Decimal result must be stored in a `$` binding. Use
`to_js_number($decimal)` only when a JavaScript library needs a native Number.
Decimal addition, subtraction, and multiplication are exact. Division is valid
at the configured number of fractional digits, which defaults to six. It uses
the configured rounding mode, which defaults to half-even.
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
## Context

Context variables are used for dependency injection or not to carry specific variables through all functions or methods.

To create a context variable:

    context pi = 3.14

In anywhere below the call stack, you can use this variable whenever you want:

    context pi

Context variables are read through their bare name and cannot be assigned with
a normal assignment.

You can only assign it inside the *context* statement. This creates a scoped
value: all calls below the current stack frame use it, and leaving that frame
restores the previous value.
```lango
f()
    context pi = 3
    g()
    console.log(pi) # prints 3

g()
    context pi
    console.log(pi) # prints 3
    h()
    console.log(pi) # still prints 3 even though h() changes it to 3.14

h()
    context pi = 3.14
    j()

j()
    k()

k()
    context pi
    console.log(pi) # prints 3.14
```

## Promises

Promises use ordinary method calls and closures.
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

Unit tests are defined with test keyword in any source code. Some examples:
```lango
test 
    assert add(3, 5) == 8
```
```lango
test "addition test 1"
    assert add(3, 5) == 8
```
Assert should report the whole failed expression as text.

## Macros

Macros generate source code while during the compilation. They are distinguished from the normal code by being all caps.

Some examples:
```lango
PI = 3.14

f()
    return PASTE(PI)
```
```lango
WARN()
    PASTE("console.log(\"WARNING!\")")

f()
    WARN()
```
```lango
MYMACRO(A)
    IF A == 5
        PASTE("FIVE")
  
f()
    A = 5
    console.log("${MYMACRO(A)}")
```
At the start of the compilation, all macro calls are evaluated and all PASTE's are pasted into the code until all are resolved.

A PASTE() may paste another macro call. But recursion is not encouraged; the macro expansion fails after 16 rounds.

## Import/Export

Functions, classes and macros can be exported and imported within source codes.

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
Functions, macros and global, context variables are exported with full headers:
```lango
export add(a, b)

export # export multiple
    add(a, b)
    subtract(a, b)
    MYMACRO(a)
    global surprise
    global
        another_surprise
    context ctx
```
Imports are also specified with full headers:
```lango
import another_file
    add(a, b)
    MYMACRO(a)
    alias surp = global surprise
    alias Admin = class Manager
        properties
            length
        methods
            add(a, b)
```
*alias* keyword is used to avoid name clashes. Properties and methods cannot be aliased.

Two or more source files may import/export each other. Dependency loops are resolved by the compiler. Infinite loops are not allowed since iteration is failed after 16 rounds.

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
