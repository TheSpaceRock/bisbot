export class GearInfo {

    #slots;
    #grades;

    constructor(slots, grades) {
        this.#slots = slots;
        this.#grades = grades;
    }

    slots() {
        return this.#slots;
    }

    grades() {
        return this.#grades;
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
        return 0;
    }

}