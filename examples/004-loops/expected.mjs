import {
    println as __println,
    requireBoolean as __requireBoolean,
    numericAdd as __numericAdd,
    boundary as __boundary,
    requireArity as __requireArity,
} from "./.lango/runtime.mjs";

function sum_to(limit) {
    __requireArity(arguments.length, [0], "sum_to");
    limit = __boundary(limit);
    let number = 0;
    let total = 0;
    __loop1: while (__requireBoolean(number < limit)) {
        total = __numericAdd(total, number);
        number = __numericAdd(number, 1);
    }
    return total;
    return null;
}

export function main(args) {
    __requireArity(arguments.length, [0], "main");
    args = __boundary(args);
    __println(sum_to(5));
    return null;
}
//# sourceMappingURL=main.mjs.map
