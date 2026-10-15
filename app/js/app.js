import {
    state,
    getActiveDeck,
    getActiveCards,
    setActiveDeck,
    validateDeckName,
    addDeck,
    renameDeck,
    deleteDeck,
    wasLastSaveSuccessful
} from "./state.js";
import { render } from "./render.js";
import { openModal, closeModal, confirmAction } from "./modal.js";

const deckModal = document.getElementById("deck-modal");
const deckForm = document.getElementById("deck-form");
const deckNameInput = document.getElementById("deck-name-input");
const deckNameError = document.getElementById("deck-name-error");
const deckSidebar = document.getElementById("deck-sidebar");
const decksToggleBtn = document.getElementById("decks-toggle-btn");

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
        reportSaveFailure();
        render();

        if (deckSidebar.classList.contains("is-open")) {
            collapseDeckList();
            decksToggleBtn.focus();
        }
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
}

init();
