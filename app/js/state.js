import { loadState, saveState } from "./storage.js";

export const state = loadState();

export const ui = {
    view: "manage",
    searchQuery: "",
    study: {
        order: [],
        index: 0,
        isFlipped: false
    }
};

export function getActiveDeck() {
    return state.decks.find((deck) => deck.id === state.activeDeckId) || null;
}

export function getActiveCards() {
    return state.cardsByDeckId[state.activeDeckId] || [];
}

// Returns the result of saveState() so the caller can show an error if saving failed.
export function setActiveDeck(deckId) {
    if (!state.decks.some((deck) => deck.id === deckId)) {
        return true;
    }
    state.activeDeckId = deckId;
    ui.view = "manage";
    ui.searchQuery = "";
    return saveState(state);
}
