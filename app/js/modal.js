// Version 1 modals: native <dialog> elements opened with showModal().
// This is the only module that knows how modals work.

const openers = new Map();
let pendingResolve = null;

const confirmModal = document.getElementById("confirm-modal");
const confirmMessage = document.getElementById("confirm-message");

export function isModalOpen() {
    return document.querySelector("dialog[open]") !== null;
}

export function openModal(modalEl, openerEl) {
    openers.set(modalEl, openerEl);
    modalEl.showModal();

    const firstField = modalEl.querySelector("input, textarea, select");
    const target = firstField || modalEl.querySelector("button");
    if (target) {
        target.focus();
    }
}

export function closeModal(modalEl) {
    if (modalEl.open) {
        modalEl.close();
    }

    const opener = openers.get(modalEl);
    openers.delete(modalEl);

    if (opener && opener.isConnected) {
        opener.focus();
    } else {
        document.getElementById("new-deck-btn").focus();
    }
}

function settleConfirm(result) {
    if (!pendingResolve) return;

    const resolve = pendingResolve;
    pendingResolve = null;
    closeModal(confirmModal);
    resolve(result);
}

export function confirmAction(message) {
    // Only one confirmation can be pending. An older one resolves as cancelled.
    settleConfirm(false);

    confirmMessage.textContent = message;

    return new Promise((resolve) => {
        pendingResolve = resolve;
        openModal(confirmModal, document.activeElement);
    });
}

// Esc: stop the browser from closing the dialog itself, so focus always returns to the opener.
for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        if (dialog === confirmModal) {
            settleConfirm(false);
        } else {
            closeModal(dialog);
        }
    });
}

// Attached once at load so a click can never resolve the promise more than once.
document.getElementById("confirm-ok-btn").addEventListener("click", () => settleConfirm(true));
document.getElementById("confirm-cancel-btn").addEventListener("click", () => settleConfirm(false));
