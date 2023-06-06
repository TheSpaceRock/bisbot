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
        let slots = gear_info.slots().map((x) => ({ slot_id: x.id, current: this.current_gear[x.id].grade_id, bis: this.bis_gear[x.id].grade_id }))
        slots = slots.filter((x) => x.current !== x.bis && !gear_info.can_upgrade(x.slot_id, x.current, x.bis));
        const values = slots.map((x) => gear_info.get_tomestone_value(x.slot_id, x.bis));
        return values.reduce((sum, x) => sum + x, 0)
    }

}