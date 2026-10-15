import { state, getActiveDeck } from "./state.js";

export function render() {
    renderSidebar();
    renderDeckHeader();
}

export function renderSidebar() {
    const deckList = document.getElementById("deck-list");
    deckList.replaceChildren();

    if (state.decks.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";

        const message = document.createElement("p");
        message.textContent = "No decks yet. Create your first deck to get started.";

        const button = document.createElement("button");
        button.type = "button";
        button.id = "empty-new-deck-btn";
        button.textContent = "New Deck";

        emptyState.append(message, button);
        deckList.append(emptyState);
        return;
    }

    for (const deck of state.decks) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "deck-item";
        button.dataset.action = "select-deck";
        button.dataset.id = deck.id;
        button.textContent = deck.name;

        if (deck.id === state.activeDeckId) {
            button.classList.add("is-active");
            button.setAttribute("aria-current", "true");
        }

        deckList.append(button);
    }
}

export function renderDeckHeader() {
    const deck = getActiveDeck();
    document.getElementById("deck-title").textContent = deck ? deck.name : "No deck selected";

    const hasNoDeck = deck === null;
    document.getElementById("edit-deck-btn").disabled = hasNoDeck;
    document.getElementById("delete-deck-btn").disabled = hasNoDeck;
    document.getElementById("export-deck-btn").disabled = hasNoDeck;
}
