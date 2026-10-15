// Spaced repetition math. Pure functions: no DOM, no state, no saving.

export const DAY = 24 * 60 * 60 * 1000;
export const MAX_INTERVAL_DAYS = 365;
export const RATINGS = { AGAIN: "again", GOOD: "good", EASY: "easy" };

// Returns a new object with only the scheduling fields that change. The card is not modified
// and updatedAt is never included (it tracks text edits only).
export function rateCard(card, rating, now) {
    let interval;
    let lapses = card.lapses;

    if (rating === RATINGS.AGAIN) {
        interval = 0;
        lapses += 1;
    } else if (rating === RATINGS.GOOD) {
        interval = card.interval === 0 ? 1 : card.interval * 2;
    } else if (rating === RATINGS.EASY) {
        interval = card.interval === 0 ? 4 : card.interval * 3;
    } else {
        throw new Error(`Unknown rating: ${rating}`);
    }

    interval = Math.min(interval, MAX_INTERVAL_DAYS);

    return {
        interval,
        dueAt: now + interval * DAY,
        reviewCount: card.reviewCount + 1,
        lapses,
        lastReviewedAt: now
    };
}

export function isDue(card, now) {
    return card.dueAt <= now;
}

// Earliest dueAt among cards that are not due yet, or null if there are none.
export function getNextDueDate(cards, now) {
    let earliest = null;
    for (const card of cards) {
        if (isDue(card, now)) continue;
        if (earliest === null || card.dueAt < earliest) earliest = card.dueAt;
    }
    return earliest;
}

export function formatInterval(days) {
    if (days === 0) return "now";
    return days === 1 ? "1 day" : `${days} days`;
}
