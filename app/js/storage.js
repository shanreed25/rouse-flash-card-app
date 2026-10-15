export const STORAGE_KEY = "flashcards-app:state";
export const CURRENT_VERSION = 1;

export function createDefaultState() {
    return {
        version: CURRENT_VERSION,
        decks: [],
        cardsByDeckId: {},
        activeDeckId: null
    };
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function isNumberOrNull(value) {
    return value === null || isNumber(value);
}

// Checks the required fields and types. Optional fields are handled by fillDefaults().
function isValidShape(data) {
    if (!isPlainObject(data)) return false;
    if (!isNumber(data.version)) return false;
    if (!Array.isArray(data.decks)) return false;
    if (!isPlainObject(data.cardsByDeckId)) return false;
    if (data.activeDeckId !== null && typeof data.activeDeckId !== "string") return false;

    const deckIds = new Set();
    for (const deck of data.decks) {
        if (!isPlainObject(deck)) return false;
        if (typeof deck.id !== "string" || typeof deck.name !== "string") return false;
        if (!isNumber(deck.createdAt)) return false;
        if (deckIds.has(deck.id)) return false;
        deckIds.add(deck.id);
    }

    for (const cards of Object.values(data.cardsByDeckId)) {
        if (!Array.isArray(cards)) return false;
        for (const card of cards) {
            if (!isPlainObject(card)) return false;
            if (typeof card.id !== "string") return false;
            if (typeof card.front !== "string" || typeof card.back !== "string") return false;
            if (!isNumber(card.createdAt)) return false;
        }
    }

    return true;
}

function fillDeckDefaults(deck) {
    return {
        ...deck,
        updatedAt: isNumber(deck.updatedAt) ? deck.updatedAt : deck.createdAt,
        lastStudiedAt: isNumberOrNull(deck.lastStudiedAt) && deck.lastStudiedAt !== undefined
            ? deck.lastStudiedAt
            : null
    };
}

function fillCardDefaults(card) {
    return {
        ...card,
        updatedAt: isNumber(card.updatedAt) ? card.updatedAt : card.createdAt,
        dueAt: isNumber(card.dueAt) ? card.dueAt : card.createdAt,
        interval: isNumber(card.interval) ? card.interval : 0,
        reviewCount: isNumber(card.reviewCount) ? card.reviewCount : 0,
        lapses: isNumber(card.lapses) ? card.lapses : 0,
        lastReviewedAt: isNumberOrNull(card.lastReviewedAt) && card.lastReviewedAt !== undefined
            ? card.lastReviewedAt
            : null
    };
}

function fillDefaults(data) {
    const decks = data.decks.map(fillDeckDefaults);
    const cardsByDeckId = {};

    for (const [deckId, cards] of Object.entries(data.cardsByDeckId)) {
        cardsByDeckId[deckId] = cards.map(fillCardDefaults);
    }
    for (const deck of decks) {
        if (!cardsByDeckId[deck.id]) {
            cardsByDeckId[deck.id] = [];
        }
    }

    return { ...data, decks, cardsByDeckId };
}

// Version 1 has no migrations. Later versions add steps here, one per version.
export function migrateState(state) {
    return state;
}

function backUpRawData(raw) {
    const backupKey = `${STORAGE_KEY}:backup-${Date.now()}`;
    try {
        localStorage.setItem(backupKey, raw);
    } catch (error) {
        console.error("Could not write a backup of the saved data.", error);
    }
    return backupKey;
}

function fixActiveDeckId(state) {
    const exists = state.decks.some((deck) => deck.id === state.activeDeckId);
    if (!exists) {
        state.activeDeckId = state.decks.length > 0 ? state.decks[0].id : null;
    }
}

export function loadState() {
    let raw = null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        console.error("Could not read saved data.", error);
        return createDefaultState();
    }

    if (raw === null) {
        return createDefaultState();
    }

    let parsed = null;
    let isValid = false;
    try {
        parsed = JSON.parse(raw);
        // A version newer than this code understands is treated as invalid so it is never overwritten.
        isValid = isValidShape(parsed) && parsed.version <= CURRENT_VERSION;
    } catch (error) {
        isValid = false;
    }

    if (!isValid) {
        const backupKey = backUpRawData(raw);
        console.warn(`Saved data was invalid. A copy was stored at "${backupKey}" and the app started fresh.`);
        return createDefaultState();
    }

    let state = fillDefaults(parsed);
    if (state.version < CURRENT_VERSION) {
        state = migrateState(state);
    }
    fixActiveDeckId(state);
    return state;
}

// Returns true on success, false on failure so the caller can show a message.
export function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error("Could not save data.", error);
        return false;
    }
}
