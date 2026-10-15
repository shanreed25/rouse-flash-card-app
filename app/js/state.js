import { loadState, saveState } from "./storage.js";
import { createId } from "./utils.js";

const MAX_DECK_NAME_LENGTH = 60;

export const state = loadState();

let lastSaveSucceeded = true;

function save() {
    lastSaveSucceeded = saveState(state);
    return lastSaveSucceeded;
}

// Lets callers show an error after any state change whose save failed.
export function wasLastSaveSuccessful() {
    return lastSaveSucceeded;
}

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
    return save();
}

// Returns an error message, or null if the name is valid.
export function validateDeckName(name, excludeDeckId) {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
        return "Deck name is required.";
    }
    if (trimmed.length > MAX_DECK_NAME_LENGTH) {
        return `Deck name must be ${MAX_DECK_NAME_LENGTH} characters or fewer.`;
    }
    const lowered = trimmed.toLowerCase();
    const isDuplicate = state.decks.some(
        (deck) => deck.id !== excludeDeckId && deck.name.toLowerCase() === lowered
    );
    if (isDuplicate) {
        return "A deck with this name already exists.";
    }
    return null;
}

export function addDeck(name) {
    const now = Date.now();
    const deck = {
        id: createId(),
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
        lastStudiedAt: null
    };
    state.decks.push(deck);
    state.cardsByDeckId[deck.id] = [];
    state.activeDeckId = deck.id;
    ui.view = "manage";
    ui.searchQuery = "";
    save();
    return deck;
}

export function renameDeck(deckId, name) {
    const deck = state.decks.find((item) => item.id === deckId);
    if (!deck) return;
    deck.name = name.trim();
    deck.updatedAt = Date.now();
    save();
}

const MAX_CARD_TEXT_LENGTH = 500;

function validateCardText(label, text) {
    if (text.length === 0) {
        return `${label} is required.`;
    }
    if (text.length > MAX_CARD_TEXT_LENGTH) {
        return `${label} must be ${MAX_CARD_TEXT_LENGTH} characters or fewer.`;
    }
    return null;
}

// Returns { front, back }, each an error message or null.
export function validateCard(front, back) {
    return {
        front: validateCardText("Front", front.trim()),
        back: validateCardText("Back", back.trim())
    };
}

export function addCard(deckId, front, back) {
    const cards = state.cardsByDeckId[deckId];
    if (!cards) return null;

    const now = Date.now();
    const card = {
        id: createId(),
        front: front.trim(),
        back: back.trim(),
        createdAt: now,
        updatedAt: now,
        dueAt: now,
        interval: 0,
        reviewCount: 0,
        lapses: 0,
        lastReviewedAt: null
    };
    cards.push(card);
    save();
    return card;
}

// Only text and updatedAt change. Scheduling fields are left alone.
export function updateCard(deckId, cardId, front, back) {
    const card = (state.cardsByDeckId[deckId] || []).find((item) => item.id === cardId);
    if (!card) return;

    card.front = front.trim();
    card.back = back.trim();
    card.updatedAt = Date.now();
    save();
}

export function deleteCard(deckId, cardId) {
    if (!state.cardsByDeckId[deckId]) return;

    state.cardsByDeckId[deckId] = state.cardsByDeckId[deckId].filter((card) => card.id !== cardId);
    save();
}

export function deleteDeck(deckId) {
    state.decks = state.decks.filter((deck) => deck.id !== deckId);
    delete state.cardsByDeckId[deckId];
    if (state.activeDeckId === deckId) {
        state.activeDeckId = state.decks.length > 0 ? state.decks[0].id : null;
        ui.view = "manage";
        ui.searchQuery = "";
    }
    save();
}

export function markDeckStudied(deckId) {
    const deck = state.decks.find((item) => item.id === deckId);
    if (!deck) return;
    deck.lastStudiedAt = Date.now();
    save();
}
