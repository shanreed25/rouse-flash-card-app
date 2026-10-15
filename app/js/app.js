import { setActiveDeck } from "./state.js";
import { render } from "./render.js";

function showError(message) {
    document.getElementById("error-message").textContent = message;
}

function handleDeckListClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    if (target.dataset.action === "select-deck") {
        const saved = setActiveDeck(target.dataset.id);
        if (!saved) {
            showError("Could not save your changes. Storage may be full or blocked.");
        }
        render();
    }
}

function init() {
    render();
    document.getElementById("deck-list").addEventListener("click", handleDeckListClick);
}

init();
