import {
    println as __println,
    translate as __translate,
} from "./.lango/runtime.mjs";

function show_order(order) {
    return __translate("Order {0}: {1}", [order.id, order.customer]);
    return null;
}

export function main(args) {
    let order = { id: 42, customer: "Savaş" };
    for (const [key, value] of Object.entries(order)) {
        __println(__translate("{0}={1}", [key, value]));
    }
    __println(show_order(order));
    return null;
}
//# sourceMappingURL=main.mjs.map
