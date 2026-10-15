import { state, getActiveDeck, getActiveCards } from "./state.js";

const LABEL_PREVIEW_LENGTH = 30;

export function render() {
    renderSidebar();
    renderDeckHeader();
    renderCardList();
}

function shortenForLabel(text) {
    const singleLine = text.replace(/\s+/g, " ");
    if (singleLine.length <= LABEL_PREVIEW_LENGTH) return singleLine;
    return singleLine.slice(0, LABEL_PREVIEW_LENGTH) + "...";
}

function createCardSide(label, text) {
    const side = document.createElement("p");
    side.className = "card-side";

    const labelEl = document.createElement("span");
    labelEl.className = "card-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "card-text-value";
    valueEl.textContent = text;

    side.append(labelEl, valueEl);
    return side;
}

function createCardButton(action, label, card) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = card.id;
    button.textContent = label;
    button.setAttribute("aria-label", `${label} card: ${shortenForLabel(card.front)}`);
    return button;
}

export function renderCardList() {
    const cardList = document.getElementById("card-list");
    const hasDeck = getActiveDeck() !== null;
    cardList.replaceChildren();
    document.getElementById("new-card-btn").disabled = !hasDeck;

    if (!hasDeck) return;

    const cards = getActiveCards();
    if (cards.length === 0) {
        const item = document.createElement("li");
        item.className = "empty-state";

        const message = document.createElement("p");
        message.textContent = "No cards in this deck yet.";

        const button = document.createElement("button");
        button.type = "button";
        button.id = "empty-new-card-btn";
        button.textContent = "New Card";

        item.append(message, button);
        cardList.append(item);
        return;
    }

    for (const card of cards) {
        const item = document.createElement("li");
        item.className = "card-item";

        const text = document.createElement("div");
        text.className = "card-text";
        text.append(createCardSide("Front", card.front), createCardSide("Back", card.back));

        const actions = document.createElement("div");
        actions.className = "card-actions";
        actions.append(
            createCardButton("edit-card", "Edit", card),
            createCardButton("delete-card", "Delete", card)
        );

        item.append(text, actions);
        cardList.append(item);
    }
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
