import {
    state,
    ui,
    getActiveDeck,
    getActiveCards,
    getVisibleCards,
    setActiveDeck,
    validateDeckName,
    addDeck,
    renameDeck,
    deleteDeck,
    validateCard,
    addCard,
    updateCard,
    deleteCard,
    wasLastSaveSuccessful
} from "./state.js";
import { render } from "./render.js";
import { startSession, endSession, flip, next, prev, shuffle, syncSession, rebuildSession } from "./study.js";
import { debounce } from "./utils.js";
import { openModal, closeModal, confirmAction, isModalOpen } from "./modal.js";

const deckModal = document.getElementById("deck-modal");
const deckForm = document.getElementById("deck-form");
const deckNameInput = document.getElementById("deck-name-input");
const deckNameError = document.getElementById("deck-name-error");
const cardModal = document.getElementById("card-modal");
const cardForm = document.getElementById("card-form");
const cardFrontInput = document.getElementById("card-front-input");
const cardBackInput = document.getElementById("card-back-input");
const cardFrontError = document.getElementById("card-front-error");
const cardBackError = document.getElementById("card-back-error");
const deckSidebar = document.getElementById("deck-sidebar");
const decksToggleBtn = document.getElementById("decks-toggle-btn");
const searchInput = document.getElementById("search-input");

function showStatus(message) {
    document.getElementById("status-message").textContent = message;
}

function showError(message) {
    document.getElementById("error-message").textContent = message;
}

function reportSaveFailure() {
    if (!wasLastSaveSuccessful()) {
        showError("Could not save your changes. Storage may be full or blocked.");
    }
}

function collapseDeckList() {
    deckSidebar.classList.remove("is-open");
    decksToggleBtn.setAttribute("aria-expanded", "false");
}

function clearDeckNameError() {
    deckNameError.textContent = "";
    deckNameError.hidden = true;
    deckNameInput.removeAttribute("aria-invalid");
}

function showDeckNameError(message) {
    deckNameError.textContent = message;
    deckNameError.hidden = false;
    deckNameInput.setAttribute("aria-invalid", "true");
    deckNameInput.focus();
}

function openDeckModal(mode, openerEl) {
    const deck = mode === "edit" ? getActiveDeck() : null;
    if (mode === "edit" && !deck) return;

    deckForm.reset();
    clearDeckNameError();
    deckForm.dataset.mode = mode;
    deckForm.dataset.deckId = deck ? deck.id : "";

    document.getElementById("deck-modal-title").textContent = deck ? "Rename Deck" : "New Deck";
    document.getElementById("deck-save-btn").textContent = deck ? "Save" : "Create";
    deckNameInput.value = deck ? deck.name : "";

    openModal(deckModal, openerEl);
}

function handleDeckSubmit(event) {
    event.preventDefault();

    const mode = deckForm.dataset.mode;
    const deckId = deckForm.dataset.deckId;
    const name = deckNameInput.value;

    const error = validateDeckName(name, mode === "edit" ? deckId : undefined);
    if (error) {
        showDeckNameError(error);
        return;
    }

    clearDeckNameError();
    const trimmed = name.trim();

    if (mode === "edit") {
        renameDeck(deckId, trimmed);
        showStatus(`Deck renamed to ${trimmed}.`);
    } else {
        addDeck(trimmed);
        searchInput.value = "";
        collapseDeckList();
        showStatus(`Deck ${trimmed} created.`);
    }

    closeModal(deckModal);
    render();
    reportSaveFailure();
}

// Moves focus to the deck that takes the deleted deck's place, or the empty-state button.
function focusAfterDelete(deletedIndex) {
    const buttons = document.querySelectorAll('#deck-list [data-action="select-deck"]');
    let target = document.getElementById("empty-new-deck-btn");
    if (buttons.length > 0) {
        target = buttons[Math.min(deletedIndex, buttons.length - 1)];
    }
    // On mobile the deck list is collapsed, so fall back to the Decks toggle button.
    if (!target || target.offsetParent === null) {
        target = decksToggleBtn;
    }
    target.focus();
}

async function handleDeleteDeck() {
    const deck = getActiveDeck();
    if (!deck) return;

    const cardCount = getActiveCards().length;
    const cardWord = cardCount === 1 ? "card" : "cards";
    const confirmed = await confirmAction(
        `Delete '${deck.name}' and its ${cardCount} ${cardWord}? This cannot be undone.`
    );
    if (!confirmed) return;

    const deletedIndex = state.decks.findIndex((item) => item.id === deck.id);
    deleteDeck(deck.id);
    searchInput.value = "";
    render();
    showStatus(`Deck ${deck.name} deleted.`);
    reportSaveFailure();
    focusAfterDelete(deletedIndex);
}

function handleDeckListClick(event) {
    if (event.target.closest("#empty-new-deck-btn")) {
        openDeckModal("create", document.getElementById("empty-new-deck-btn"));
        return;
    }

    const target = event.target.closest("[data-action]");
    if (!target) return;

    if (target.dataset.action === "select-deck") {
        setActiveDeck(target.dataset.id);
        searchInput.value = "";
        reportSaveFailure();
        render();

        if (deckSidebar.classList.contains("is-open")) {
            collapseDeckList();
            decksToggleBtn.focus();
        }
    }
}

function setCardFieldError(input, errorEl, message) {
    if (message) {
        errorEl.textContent = message;
        errorEl.hidden = false;
        input.setAttribute("aria-invalid", "true");
    } else {
        errorEl.textContent = "";
        errorEl.hidden = true;
        input.removeAttribute("aria-invalid");
    }
}

function openCardModal(mode, openerEl, card) {
    if (!getActiveDeck()) return;

    cardForm.reset();
    setCardFieldError(cardFrontInput, cardFrontError, null);
    setCardFieldError(cardBackInput, cardBackError, null);
    cardForm.dataset.mode = mode;
    cardForm.dataset.cardId = card ? card.id : "";

    document.getElementById("card-modal-title").textContent = card ? "Edit Card" : "New Card";
    document.getElementById("card-save-btn").textContent = card ? "Save" : "Add Card";
    cardFrontInput.value = card ? card.front : "";
    cardBackInput.value = card ? card.back : "";

    openModal(cardModal, openerEl);
}

// Looks up a card button by data-id after a re-render has replaced the old buttons.
function findCardButton(action, cardId) {
    const buttons = document.querySelectorAll(`#card-list [data-action="${action}"]`);
    return Array.from(buttons).find((button) => button.dataset.id === cardId) || null;
}

function handleCardSubmit(event) {
    event.preventDefault();

    const deck = getActiveDeck();
    if (!deck) return;

    const errors = validateCard(cardFrontInput.value, cardBackInput.value);
    setCardFieldError(cardFrontInput, cardFrontError, errors.front);
    setCardFieldError(cardBackInput, cardBackError, errors.back);
    if (errors.front) {
        cardFrontInput.focus();
        return;
    }
    if (errors.back) {
        cardBackInput.focus();
        return;
    }

    const isEdit = cardForm.dataset.mode === "edit";
    const cardId = cardForm.dataset.cardId;

    let savedId = cardId;
    if (isEdit) {
        updateCard(deck.id, cardId, cardFrontInput.value, cardBackInput.value);
    } else {
        const card = addCard(deck.id, cardFrontInput.value, cardBackInput.value);
        savedId = card ? card.id : null;
    }

    const isHidden = !getVisibleCards().some((card) => card.id === savedId);
    if (isHidden) {
        showStatus("Card saved. It's hidden by the current search.");
    } else {
        showStatus(isEdit ? "Card updated." : "Card added.");
    }

    closeModal(cardModal);
    syncSession();
    render();
    reportSaveFailure();

    // The old Edit button was replaced by render(), so focus the new one for the same card.
    if (isEdit) {
        const editButton = findCardButton("edit-card", cardId);
        if (editButton) editButton.focus();
    }
}

function handleCardFormKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        cardForm.requestSubmit();
    }
}

// Moves focus to the Edit button that takes the deleted card's place, else the empty-state button.
function focusAfterCardDelete(deletedIndex) {
    const editButtons = document.querySelectorAll('#card-list [data-action="edit-card"]');
    if (editButtons.length > 0) {
        editButtons[Math.min(deletedIndex, editButtons.length - 1)].focus();
        return;
    }
    const emptyButton =
        document.getElementById("empty-new-card-btn") || document.getElementById("clear-search-btn");
    if (emptyButton) emptyButton.focus();
}

function applySearch() {
    const query = searchInput.value;
    if (query === ui.searchQuery) return;

    ui.searchQuery = query;
    if (ui.view === "study") rebuildSession();
    render();

    const total = getActiveCards().length;
    if (query.trim() === "") {
        showStatus(`${total} cards`);
    } else {
        showStatus(`${getVisibleCards().length} of ${total} cards match`);
    }
}

function handleClearSearch() {
    searchInput.value = "";
    ui.searchQuery = "";
    if (ui.view === "study") rebuildSession();
    render();
    searchInput.focus();
}

async function handleCardListClick(event) {
    if (event.target.closest("#clear-search-btn")) {
        handleClearSearch();
        return;
    }

    if (event.target.closest("#empty-new-card-btn")) {
        openCardModal("create", document.getElementById("empty-new-card-btn"));
        return;
    }

    const target = event.target.closest("[data-action]");
    const deck = getActiveDeck();
    if (!target || !deck) return;

    const cardId = target.dataset.id;
    const cards = getActiveCards();
    if (!cards.some((card) => card.id === cardId)) return;
    const cardIndex = getVisibleCards().findIndex((card) => card.id === cardId);

    if (target.dataset.action === "edit-card") {
        openCardModal("edit", target, cards.find((card) => card.id === cardId));
    } else if (target.dataset.action === "delete-card") {
        const confirmed = await confirmAction("Delete this card? This cannot be undone.");
        if (!confirmed) return;

        deleteCard(deck.id, cardId);
        syncSession();
        render();
        showStatus("Card deleted.");
        reportSaveFailure();
        focusAfterCardDelete(cardIndex);
    }
}

function handleStudyStart() {
    startSession();
    render();
    document.getElementById("study-card").focus();
    reportSaveFailure();
}

function handleStudyEnd() {
    endSession();
    render();
    document.getElementById("study-btn").focus();
}

function handleStudyAction(action) {
    action();
    render();
}

// Placeholder. Part 8 adds the scheduling logic.
function rateCurrentCard(rating) {}

const KEY_ACTIONS = {
    " ": flip,
    ArrowRight: next,
    ArrowLeft: prev
};

const KEY_RATINGS = { "1": "again", "2": "good", "3": "easy" };

function handleKeydown(event) {
    if (ui.view !== "study" && ui.view !== "review") return;
    if (isModalOpen()) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const target = event.target;
    if (target.closest("input, textarea, select, [contenteditable]")) return;

    const isSpace = event.key === " ";
    if (isSpace && (target.closest("button, a") || event.repeat)) return;

    const action = KEY_ACTIONS[event.key];
    if (action) {
        event.preventDefault();
        handleStudyAction(action);
        return;
    }

    const rating = KEY_RATINGS[event.key];
    if (rating && ui.study.isFlipped) {
        event.preventDefault();
        handleStudyAction(() => rateCurrentCard(rating));
    }
}

function handleDecksToggle() {
    const isOpen = deckSidebar.classList.toggle("is-open");
    decksToggleBtn.setAttribute("aria-expanded", String(isOpen));
}

function init() {
    render();

    document.getElementById("deck-list").addEventListener("click", handleDeckListClick);
    document.getElementById("new-deck-btn").addEventListener("click", (event) => {
        openDeckModal("create", event.currentTarget);
    });
    document.getElementById("edit-deck-btn").addEventListener("click", (event) => {
        openDeckModal("edit", event.currentTarget);
    });
    document.getElementById("delete-deck-btn").addEventListener("click", handleDeleteDeck);
    deckForm.addEventListener("submit", handleDeckSubmit);
    document.getElementById("deck-cancel-btn").addEventListener("click", () => closeModal(deckModal));
    decksToggleBtn.addEventListener("click", handleDecksToggle);

    document.getElementById("new-card-btn").addEventListener("click", (event) => {
        openCardModal("create", event.currentTarget);
    });
    document.getElementById("card-list").addEventListener("click", handleCardListClick);
    cardForm.addEventListener("submit", handleCardSubmit);
    cardForm.addEventListener("keydown", handleCardFormKeydown);
    document.getElementById("card-cancel-btn").addEventListener("click", () => closeModal(cardModal));

    const debouncedSearch = debounce(applySearch, 300);
    searchInput.addEventListener("input", () => {
        if (searchInput.value.trim() === "") {
            applySearch();
        } else {
            debouncedSearch();
        }
    });

    document.getElementById("study-btn").addEventListener("click", handleStudyStart);
    document.getElementById("manage-btn").addEventListener("click", handleStudyEnd);
    document.getElementById("study-empty-manage-btn").addEventListener("click", handleStudyEnd);
    document.getElementById("study-card").addEventListener("click", () => handleStudyAction(flip));
    document.getElementById("flip-btn").addEventListener("click", () => handleStudyAction(flip));
    document.getElementById("prev-btn").addEventListener("click", () => handleStudyAction(prev));
    document.getElementById("next-btn").addEventListener("click", () => handleStudyAction(next));
    document.getElementById("shuffle-btn").addEventListener("click", () => handleStudyAction(shuffle));

    document.addEventListener("keydown", handleKeydown);
}

init();
