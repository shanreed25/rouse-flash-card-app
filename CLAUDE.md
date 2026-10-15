# Flashcards App

A single-page Flashcards app in plain HTML, CSS, and JavaScript (ES modules, no frameworks, no build tools). The full spec is in `docs/SDD.md`. Read it before starting any part.

## How we work

- The app is built in numbered parts listed in `docs/SDD.md` section 11.
- Work only on the part I name. Do not start the next part or add features from later parts.
- Start each part in plan mode and wait for me to approve the plan.
- When a part is finished, stop and list every file and function you added or changed, plus anything you were unsure about.
- Never run `git commit`, `git push`, or `git tag`. I review and commit myself.

## Code rules

- Use the IDs, classes, `data-action` values, and function names defined in `docs/SDD.md` section 7. If you need a new one, add it to the SDD table in the same part.
- All data lives in `state` and `ui`. Event handlers change state, then call `render()`.
- Attach event listeners once in `init()`. Use event delegation for lists. Never add listeners inside render functions.
- One `keydown` listener on `document` handles shortcuts; it checks state instead of being added and removed.
- Only `state.js` changes data, and only through `saveState()` in `storage.js`.
- Only `modal.js` knows how modals work. Other code calls `openModal()`, `closeModal()`, `confirmAction()`, and `isModalOpen()`.
- Insert user text with `textContent`, never `innerHTML`.
- Select elements by ID or `data-*` attribute, not by tag position or styling classes.
- All colors come from the CSS variables in `docs/SDD.md` section 8.3.

## Running locally

Open `app/index.html` with a local server such as VS Code Live Server. ES modules do not load from `file://`.

## Folders

- `app/` is the source of truth.
- `app-annotated/` is created in Part 13 only. After that, any change to `app/` must also be made in `app-annotated/` and reflected in `REBUILD-GUIDE.md`.
