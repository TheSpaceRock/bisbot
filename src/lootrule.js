import { RaidRole } from "./enum.js";

export const LootRule = Object.freeze({
    PriorityFFA:    0,
});

export function resolve_loot_rollers(drops, loot_rule, role_map) {
    if (loot_rule === LootRule.PriorityFFA) {
        for (const id in drops) {
            const priority_role = drops[id].rollers.reduce((r, x) => Math.min(r, x.role), RaidRole.Unknown);
            drops[id].rollers = drops[id].rollers.filter((x) => x.role == priority_role);
        }
    } else {
        throw Error('Unknown loot rule');
    }
    return drops;
}