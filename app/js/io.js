import { state, importDeck } from "./state.js";
import { MAX_INTERVAL_DAYS } from "./srs.js";

const FORMAT = "flashcards-app-deck";
const FORMAT_VERSION = 1;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_DECK_NAME_LENGTH = 60;
const MAX_CARD_TEXT_LENGTH = 500;
const DEFAULT_DECK_NAME = "Imported deck";

function toFileName(deckName) {
    const slug = deckName
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
    return `${slug || "deck"}.json`;
}

// Downloads the deck as JSON. IDs, createdAt, and updatedAt are not exported.
export function exportDeck(deckId) {
    const deck = state.decks.find((item) => item.id === deckId);
    if (!deck) return;

    const data = {
        format: FORMAT,
        version: FORMAT_VERSION,
        exportedAt: Date.now(),
        deck: { name: deck.name },
        cards: (state.cardsByDeckId[deckId] || []).map((card) => ({
            front: card.front,
            back: card.back,
            dueAt: card.dueAt,
            interval: card.interval,
            reviewCount: card.reviewCount,
            lapses: card.lapses,
            lastReviewedAt: card.lastReviewedAt
        }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = toFileName(deck.name);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// Returns the trimmed text, or null if it is not a string of 1 to 500 characters.
function parseText(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_CARD_TEXT_LENGTH) return null;
    return trimmed;
}

function parseDeckName(data) {
    const name = isPlainObject(data.deck) ? data.deck.name : null;
    if (typeof name !== "string") return DEFAULT_DECK_NAME;
    const shortened = name.trim().slice(0, MAX_DECK_NAME_LENGTH).trim();
    return shortened === "" ? DEFAULT_DECK_NAME : shortened;
}

// Pure: no DOM, no state. Each invalid scheduling field falls back to its new-card default.
export function parseDeckFile(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        return { ok: false, error: "This file isn't valid JSON." };
    }

    const notADeck = { ok: false, error: "This file isn't a Flashcards deck export." };
    if (!isPlainObject(data) || data.format !== FORMAT) return notADeck;
    if (typeof data.version !== "number" || !(data.version <= FORMAT_VERSION)) return notADeck;
    if (!Array.isArray(data.cards)) return notADeck;

    const now = Date.now();
    const cards = [];
    let skipped = 0;

    for (const item of data.cards) {
        const front = isPlainObject(item) ? parseText(item.front) : null;
        const back = isPlainObject(item) ? parseText(item.back) : null;
        if (front === null || back === null) {
            skipped += 1;
            continue;
        }
        cards.push({
            front,
            back,
            dueAt: isNonNegativeNumber(item.dueAt) ? item.dueAt : now,
            interval: isNonNegativeNumber(item.interval) ? Math.min(item.interval, MAX_INTERVAL_DAYS) : 0,
            reviewCount: isNonNegativeNumber(item.reviewCount) ? item.reviewCount : 0,
            lapses: isNonNegativeNumber(item.lapses) ? item.lapses : 0,
            lastReviewedAt: isNonNegativeNumber(item.lastReviewedAt) ? item.lastReviewedAt : null
        });
    }

    if (data.cards.length > 0 && cards.length === 0) {
        return { ok: false, error: "No valid cards were found in this file." };
    }

    return { ok: true, deckName: parseDeckName(data), cards, skipped };
}

// Returns { ok: true, deckName, count, skipped } or { ok: false, error }.
export async function importDeckFile(file) {
    if (file.size > MAX_FILE_BYTES) {
        return { ok: false, error: "This file is too large (limit 1 MB)." };
    }

    let text;
    try {
        text = await file.text();
    } catch (error) {
        return { ok: false, error: "This file could not be read." };
    }

    const parsed = parseDeckFile(text);
    if (!parsed.ok) return parsed;

    const result = importDeck(parsed.deckName, parsed.cards);
    if (!result.ok) return result;
    return { ok: true, deckName: result.deckName, count: result.count, skipped: parsed.skipped };
}
