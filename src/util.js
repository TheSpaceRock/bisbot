import moment from 'moment';

export function next_weekly_reset() {
    const now = moment().utc();
    let reset = moment().utc().day(2).hour(8).minute(0);
    if (reset < now) {
        reset = reset.day(7);
    }
    return reset;
}

export function last_weekly_reset() {
    return next_weekly_reset().day(-7);
}