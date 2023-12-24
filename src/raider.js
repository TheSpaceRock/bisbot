export class Raider {

    constructor(basics, books, recent_clears, slot_data) {
        this.guild_id = basics.guild_id;
        this.user_id = basics.user_id;
        this.bis_url = basics.bis_url;
        this.job = basics.job;
        this.role = basics.role;

        this.clears = {};
        this.current_gear = {};
        this.bis_gear = {};

        for (const x of books) {
            this.clears[x.raid_id] = {};
            this.clears[x.raid_id].books = x.books;
        }
        for (const x of recent_clears) {
            this.clears[x.raid_id].last_clear = x.last_clear;
        }

        for (const slot of slot_data) {
            this.current_gear[slot.slot_id] = {
                grade_id: slot.current_grade,
                name: slot.current_name,
                ilvl: slot.current_ilvl,
            };
            this.bis_gear[slot.slot_id] = {
                grade_id: slot.bis_grade,
                name: slot.bis_name,
                ilvl: slot.bis_ilvl,
            };
        }
    }

    get_tomestones_required(gear_info) {
        const slots = gear_info.slots().map((x) => ({ slot_id: x.id, current: this.current_gear[x.id].grade_id, bis: this.bis_gear[x.id].grade_id }))
        const non_bis_slots = slots.filter((x) => x.current !== x.bis && !gear_info.can_upgrade(x.slot_id, x.current, x.bis));
        const all_values = slots.map((x) => gear_info.get_tomestone_value(x.slot_id, x.bis));
        const non_bis_values = non_bis_slots.map((x) => gear_info.get_tomestone_value(x.slot_id, x.bis));
        return {
            current: non_bis_values.reduce((sum, x) => sum + x, 0),
            total: all_values.reduce((sum, x) => sum + x, 0),
        }
    }

    // Assists with mapping current slots to best possible bis slot
    map_slots_bis_to_current(gear_info) {
        const result = {};
        // Ring slots are mapped with priority of: bis > upgradeable > slot id
        // The mappings are greedy, starting with the highest ilvl bis slots
        const ring_slots = gear_info.slots().filter(x => x.name.includes('Ring'));
        ring_slots.sort((a, b) => (this.bis_gear[a.id].ilvl - this.bis_gear[b.id.ilvl]) || (a - b));
        const unmapped_bis_slots = [];
        let available_cur_slots = ring_slots;
        for (const bis_slot of ring_slots) {
            const match_slots = available_cur_slots.filter(x => this.current_gear[x.id].grade_id === this.bis_gear[bis_slot.id].grade_id);
            const upgrade_slots = available_cur_slots.filter(x => gear_info.can_upgrade(bis_slot.id, this.current_gear[x.id].grade_id, this.bis_gear[bis_slot.id].grade_id));
            if (match_slots.length > 0) {
                const cur_id = match_slots[0].id;
                result[bis_slot.id] = cur_id;
                available_cur_slots = available_cur_slots.filter(x => x.id !== cur_id);
            } else if (upgrade_slots.length > 0) {
                const cur_id = upgrade_slots[0].id;
                result[bis_slot.id] = cur_id;
                available_cur_slots = available_cur_slots.filter(x => x.id !== cur_id);
            } else {
                unmapped_bis_slots.push(bis_slot);
            }
        }
        if (unmapped_bis_slots.length !== available_cur_slots.length) {
            console.error(`Ring slot length mismatch (this shouldn't be possible?):\nbis=`, unmapped_bis_slots, '\ncur=', available_cur_slots);
        }
        unmapped_bis_slots.sort((a, b) => a.id - b.id);
        for (const [i, bis_slot] of unmapped_bis_slots.entries()) {
            const cur_slot = available_cur_slots[i];
            result[bis_slot.id] = cur_slot.id;
        }
        // Map non-ring slots normally
        for (const slot of gear_info.slots().filter(x => !x.name.includes('Ring'))) {
            result[slot.id] = slot.id;
        }
        const remapped_ids = Object.entries(result).filter(([a, b]) => a !== '' + b).map(([bis, cur]) => `${bis} -> ${cur}`);
        if (remapped_ids.length > 0) {
            console.log('Remapped slot IDs', remapped_ids);
        }
        return result;
    }

}