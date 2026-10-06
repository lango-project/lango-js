import {
    println as __println,
    finite as __finite,
    requireArity as __requireArity,
} from "./.lango/runtime.mjs";

function sum(values) {
    __requireArity(arguments.length, [0], "sum");
    let total = 0;
    for (const value of values) {
        total = __finite(total + value);
    }
    return total;
    return null;
}

export function main(args) {
    __requireArity(arguments.length, [0], "main");
    let values = [2, 3, 5];
    values.push(7);
    __println(sum(values));
    return null;
}
//# sourceMappingURL=main.mjs.map
