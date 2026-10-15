import { ui, getActiveDeck, getActiveCards, markDeckStudied } from "./state.js";

// All session building goes through here so Part 7 can add search filtering in one place.
export function getSessionCards() {
    return getActiveCards().slice();
}

export function startSession() {
    ui.view = "study";
    ui.study.order = getSessionCards().map((card) => card.id);
    ui.study.index = 0;
    ui.study.isFlipped = false;

    const deck = getActiveDeck();
    if (deck) markDeckStudied(deck.id);
}

export function getCurrentCard() {
    const id = ui.study.order[ui.study.index];
    if (id === undefined) return null;
    return getSessionCards().find((card) => card.id === id) || null;
}

export function flip() {
    if (ui.study.order.length === 0) return;
    ui.study.isFlipped = !ui.study.isFlipped;
}

export function next() {
    if (ui.study.index >= ui.study.order.length - 1) return;
    ui.study.index += 1;
    ui.study.isFlipped = false;
}

export function prev() {
    if (ui.study.index <= 0) return;
    ui.study.index -= 1;
    ui.study.isFlipped = false;
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
    const existing = new Set(getSessionCards().map((card) => card.id));
    ui.study.order = ui.study.order.filter((id) => existing.has(id));
    ui.study.index = Math.min(ui.study.index, Math.max(0, ui.study.order.length - 1));
    if (ui.study.order[ui.study.index] !== previousId) {
        ui.study.isFlipped = false;
    }
}

export function endSession() {
    ui.view = "manage";
}
