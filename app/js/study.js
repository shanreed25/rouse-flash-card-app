import {
    ui,
    getActiveDeck,
    getActiveCards,
    getVisibleCards,
    getDueCards,
    markDeckStudied,
    applyRating
} from "./state.js";
import { RATINGS } from "./srs.js";

// All session building goes through here so search filtering applies in one place.
// Review sessions use due cards only; study sessions use every visible card.
export function getSessionCards() {
    return ui.view === "review" ? getDueCards() : getVisibleCards();
}

// Rebuilds the order after the search query changes. Stays in the current view and
// does not mark the deck as studied.
export function rebuildSession() {
    ui.study.order = getSessionCards().map((card) => card.id);
    ui.study.index = 0;
    ui.study.isFlipped = false;
}

// mode is "study" or "review".
export function startSession(mode) {
    ui.view = mode === "review" ? "review" : "study";
    rebuildSession();

    const deck = getActiveDeck();
    if (deck) markDeckStudied(deck.id);
}

// Looks the card up in the whole deck, not the session set, because a rated card is no longer due.
export function getCurrentCard() {
    const id = ui.study.order[ui.study.index];
    if (id === undefined) return null;
    return getActiveCards().find((card) => card.id === id) || null;
}

// True when the index has moved past the last card. A review session with nothing due
// (and no search) also counts, so it shows "All caught up."
export function isSessionOver() {
    if (ui.view !== "study" && ui.view !== "review") return false;
    if (ui.study.order.length === 0) {
        return ui.view === "review" && ui.searchQuery.trim() === "";
    }
    return ui.study.index >= ui.study.order.length;
}

export function flip() {
    if (ui.study.order.length === 0 || isSessionOver()) return;
    ui.study.isFlipped = !ui.study.isFlipped;
}

export function next() {
    if (ui.study.index >= ui.study.order.length - 1) return;
    ui.study.index += 1;
    ui.study.isFlipped = false;
}

// The review queue only moves forward, so a card cannot be rated twice by going back.
export function prev() {
    if (ui.view === "review" || isSessionOver()) return;
    if (ui.study.index <= 0) return;
    ui.study.index -= 1;
    ui.study.isFlipped = false;
}

// Rates the current card and moves on to the next one. Returns the applied scheduling
// fields, or null if there was no card to rate.
export function rateCurrentCard(rating) {
    const card = getCurrentCard();
    const deck = getActiveDeck();
    if (!card || !deck) return null;

    const updates = applyRating(deck.id, card.id, rating);
    if (!updates) return null;

    if (ui.view === "review" && rating === RATINGS.AGAIN) {
        ui.study.order.push(card.id);
    }
    ui.study.index += 1;
    ui.study.isFlipped = false;
    return updates;
}

// Fisher-Yates on a copy. Saved card order is never touched.
export function shuffle() {
    const order = ui.study.order.slice();
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    ui.study.order = order;
    ui.study.index = 0;
    ui.study.isFlipped = false;
}

// Call after cards are added, edited, or deleted.
export function syncSession() {
    const previousId = ui.study.order[ui.study.index];
    const wasOver = ui.study.index >= ui.study.order.length;
    const existing = new Set(getSessionCards().map((card) => card.id));
    ui.study.order = ui.study.order.filter((id) => existing.has(id));
    if (wasOver) {
        ui.study.index = ui.study.order.length;
    } else {
        ui.study.index = Math.min(ui.study.index, Math.max(0, ui.study.order.length - 1));
    }
    if (ui.study.order[ui.study.index] !== previousId) {
        ui.study.isFlipped = false;
    }
}

export function endSession() {
    ui.view = "manage";
}
