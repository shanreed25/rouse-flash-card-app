import { state, ui, getActiveDeck, getActiveCards, getVisibleCards } from "./state.js";
import { getCurrentCard } from "./study.js";

const LABEL_PREVIEW_LENGTH = 30;

let lastRenderedCardId = null;
let lastAnnouncedCardId = null;

export function render() {
    renderSidebar();
    renderDeckHeader();
    renderToolbar();
    renderCardList();
    renderStudy();
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

// Never sets #search-input's value, so it cannot overwrite what the user is typing.
export function renderToolbar() {
    const hasDeck = getActiveDeck() !== null;
    document.getElementById("search-input").disabled = !hasDeck;

    const total = getActiveCards().length;
    const matchCount = document.getElementById("match-count");
    if (!hasDeck) {
        matchCount.textContent = "";
    } else if (getSearchTerm() !== "") {
        matchCount.textContent = `${getVisibleCards().length} of ${total} cards`;
    } else {
        matchCount.textContent = `${total} cards`;
    }
}

function getSearchTerm() {
    return ui.searchQuery.trim();
}

export function renderCardList() {
    const cardList = document.getElementById("card-list");
    const hasDeck = getActiveDeck() !== null;
    cardList.replaceChildren();
    document.getElementById("new-card-btn").disabled = !hasDeck;

    if (!hasDeck) return;

    const totalCards = getActiveCards().length;
    const cards = getVisibleCards();
    if (totalCards > 0 && cards.length === 0) {
        const item = document.createElement("li");
        item.className = "empty-state";

        const message = document.createElement("p");
        message.textContent = `No cards match '${getSearchTerm()}'.`;

        const button = document.createElement("button");
        button.type = "button";
        button.id = "clear-search-btn";
        button.textContent = "Clear search";

        item.append(message, button);
        cardList.append(item);
        return;
    }

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

export function renderStudy() {
    const isStudy = ui.view === "study";
    const studyCard = document.getElementById("study-card");

    document.getElementById("card-list").hidden = isStudy;
    document.getElementById("cards-heading").hidden = isStudy;
    document.getElementById("study-view").hidden = !isStudy;
    document.getElementById("shuffle-btn").hidden = !isStudy;
    document.getElementById("manage-btn").setAttribute("aria-pressed", String(!isStudy));
    document.getElementById("study-btn").setAttribute("aria-pressed", String(isStudy));
    document.getElementById("study-btn").disabled = getVisibleCards().length === 0;

    const card = isStudy ? getCurrentCard() : null;
    document.getElementById("study-session").hidden = card === null;
    document.getElementById("study-empty").hidden = !isStudy || card !== null;

    const isNoMatch = getActiveCards().length > 0 && getSearchTerm() !== "" && getVisibleCards().length === 0;
    document.getElementById("study-empty-message").textContent = isNoMatch
        ? `No cards match '${getSearchTerm()}'.`
        : "No cards to study.";

    if (card === null) {
        lastRenderedCardId = null;
        lastAnnouncedCardId = null;
        return;
    }

    const isFlipped = ui.study.isFlipped;
    const front = document.getElementById("study-front");
    const back = document.getElementById("study-back");
    front.textContent = card.front;
    back.textContent = card.back;
    front.setAttribute("aria-hidden", String(isFlipped));
    back.setAttribute("aria-hidden", String(!isFlipped));

    if (card.id === lastRenderedCardId) {
        studyCard.classList.toggle("is-flipped", isFlipped);
    } else {
        studyCard.classList.add("no-transition");
        studyCard.classList.toggle("is-flipped", isFlipped);
        void studyCard.offsetWidth;
        studyCard.classList.remove("no-transition");
        lastRenderedCardId = card.id;
    }

    const total = ui.study.order.length;
    const position = `Card ${ui.study.index + 1} of ${total}`;
    document.getElementById("study-position").textContent = position;
    document.getElementById("prev-btn").disabled = ui.study.index === 0;
    document.getElementById("next-btn").disabled = ui.study.index >= total - 1;
    document.getElementById("flip-btn").textContent = isFlipped ? "Show question" : "Show answer";

    if (card.id !== lastAnnouncedCardId) {
        document.getElementById("status-message").textContent = position;
        lastAnnouncedCardId = card.id;
    }
}
