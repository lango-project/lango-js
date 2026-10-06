import {
    println as __println,
    translate as __translate,
    requireArity as __requireArity,
} from "./.lango/runtime.mjs";

function show_order(order) {
    __requireArity(arguments.length, [0], "show_order");
    return __translate("Order {0}: {1}", [order.id, order.customer]);
    return null;
}

export function main(args) {
    __requireArity(arguments.length, [0], "main");
    let order = { id: 42, customer: "Savaş" };
    for (const [key, value] of Object.entries(order)) {
        __println(__translate("{0}={1}", [key, value]));
    }
    __println(show_order(order));
    return null;
}
//# sourceMappingURL=main.mjs.map
