export class GearInfo {

    #slots;
    #grades;
    #upgrades;
    #tomes;

    constructor(slots, grades, upgrades, tomes) {
        this.#slots = slots;
        this.#grades = grades;
        this.#upgrades = upgrades;
        this.#tomes = tomes;
    }

    slots() {
        return this.#slots;
    }

    grades() {
        return this.#grades;
    }

    slot_name_to_id() {
        const result = {};
        for (const slot of this.#slots) {
            result[slot.name] = slot.id;
        }
        return result;
    }

    get_slot_by_id(id) {
        const slots = this.#slots.filter((x) => x.id === id);
        if (slots.length !== 1) {
            throw new Error(`Unknown slot id ${id}`);
        }
        return slots[0];
    }

    resolve_grade(hints) {
        let possible_grades = this.#grades.filter((x) => {
            return (x.allowed_types & hints.slot.gear_type) !== 0 && x.ilvl === hints.ilvl
        });
        if (possible_grades.length === 1) {
            return possible_grades[0].id;
        }
        possible_grades = possible_grades.filter((x) => hints.name.includes(x.etro_hint));
        if (possible_grades.length === 1) {
            return possible_grades[0].id;
        }
        throw new Error(`Failed to resolve gear grade for: ${hints.name} i${hints.ilvl} slot_id=${hints.slot.id}`);
    }

    can_upgrade(slot_id, grade_from, grade_to) {
        const gear_type = this.get_slot_by_id(slot_id).gear_type;
        const result = this.#upgrades.filter((x) => x.gear_type === gear_type && x.grade_from === grade_from && x.grade_to === grade_to).length > 0;
        return result;
    }

    get_tomestone_value(slot_id, grade) {
        let tome_value = this.#tomes.filter((x) => x.slot_id === slot_id && (x.grade_id === grade || this.can_upgrade(slot_id, x.grade_id, grade)));
        if (tome_value.length === 1) {
            return tome_value[0].value;
        } else {
            if (tome_value.length > 1) {
                console.warn('Ambiguous tomestone value: ', tome_value);
            }
            return 0;
        }
    }

}