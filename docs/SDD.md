# Flashcards App: Spec-Driven Design Document

## 1. Overview

A single-page Flashcards web app built with plain HTML, CSS, and JavaScript. Users create decks, add cards with front and back text, and study the cards with flip animations, shuffling, keyboard shortcuts, and simple spaced repetition. All data is saved in the browser with LocalStorage.

The app is built in small parts. After each part, the developer reviews the code, refines it, and commits to GitHub before the next part begins.

Two versions are planned:

- **Version 1 (tag `v1.0`):** modals use the native `<dialog>` element with `showModal()`.
- **Version 2 (tag `v2.0`):** modals are rebuilt by hand with a custom focus trap. Only `modal.js`, the modal markup, and modal CSS change.

After version 2, an annotated copy of the app and a rebuild guide are created.

## 2. Tech Stack and Constraints

- Plain HTML, CSS, and JavaScript. No frameworks, no build tools, no npm packages.
- JavaScript is split into ES modules (`<script type="module">`).
- ES modules do not load from a file opened directly in the browser (`file://`). Run the app with a local server, such as the VS Code Live Server extension.
- Targets current versions of Chrome, Edge, Firefox, and Safari, desktop and mobile.
- No external libraries are needed. Icons, if used, are inline SVG.

## 3. File Structure

```
flashcards-app/
  app/
    index.html
    styles.css
    js/
      app.js        entry point: loads state, wires events once, first render
      storage.js    loadState(), saveState(), versioning, safe parse
      state.js      the state object and every function that changes it
      render.js     functions that draw state into the DOM
      modal.js      openModal(), closeModal(), confirmAction()
      study.js      study session: order, index, flip, next, prev, shuffle
      srs.js        spaced repetition math: rateCard(), isDue()
      io.js         importDeck(), exportDeck()
      utils.js      createId(), debounce(), small shared helpers
  docs/
    SDD.md          this document
  CLAUDE.md
  README.md         created in Part 13
```

Files are created in the part that first needs them, not all at once in Part 0.

In Part 13, `app-annotated/` (a commented copy of `app/` plus `REBUILD-GUIDE.md`) is added at the root.

## 4. Data Model

### 4.1 Persisted state

```js
const state = {
  version: 1,
  decks: [
    {
      id: "string",            // from createId()
      name: "string",          // 1 to 60 characters, trimmed
      createdAt: 0,            // Date.now()
      updatedAt: 0,
      lastStudiedAt: null      // number or null
    }
  ],
  cardsByDeckId: {
    "deckId": [
      {
        id: "string",
        front: "string",       // 1 to 500 characters, trimmed
        back: "string",        // 1 to 500 characters, trimmed
        createdAt: 0,
        updatedAt: 0,
        dueAt: 0,              // new cards: equal to createdAt (due now)
        interval: 0,           // days; 0 means new or reset
        reviewCount: 0,
        lapses: 0,             // times rated Again
        lastReviewedAt: null   // number or null
      }
    ]
  },
  activeDeckId: null           // string or null
};
```

### 4.2 UI state (not persisted)

```js
const ui = {
  view: "manage",             // "manage" | "study" | "review"
  searchQuery: "",
  study: {
    order: [],                // array of card IDs for this session
    index: 0,
    isFlipped: false
  }
};
```

### 4.3 Rules

- Card IDs and deck IDs are unique and never reused. `createId()` uses `crypto.randomUUID()` with a fallback of `Date.now().toString(36) + Math.random().toString(36).slice(2)`.
- Deck names must be unique, compared case-insensitively after trimming.
- Deleting a deck also deletes its entry in `cardsByDeckId`.
- If the active deck is deleted, `activeDeckId` becomes the first remaining deck's ID, or `null` if none remain.
- Search and shuffle never change persisted data. They only change what is shown.

## 5. Storage

- LocalStorage key: `flashcards-app:state`.
- `saveState(state)` writes `JSON.stringify(state)` inside `try/catch`. If saving fails (for example, storage is full), show a non-blocking error message and log the error.
- `loadState()`:
  1. Reads the key. If missing, returns a fresh default state.
  2. Parses inside `try/catch`.
  3. Validates the shape: `decks` is an array, `cardsByDeckId` is an object, each deck and card has the required fields with the right types.
  4. Fills in missing optional fields with defaults (for example, a card with no `dueAt` gets `dueAt = createdAt`).
  5. If parsing or validation fails, copies the raw string to `flashcards-app:state:backup-<timestamp>`, logs a warning, and returns a fresh default state. Data is never silently thrown away.
  6. If `version` is lower than the current version, runs a migration function. Version 1 has no migrations, but the function exists so later versions can add them.
- Every function in `state.js` that changes data calls `saveState()` once at the end. No other module writes to LocalStorage.

## 6. Architecture Rules

- **One source of truth.** All data lives in `state` and `ui`. The DOM is always drawn from state, never read back as data.
- **Change then render.** Event handler calls a function in `state.js` or `study.js`, then calls `render()`.
- **Small render functions.** `render()` calls `renderSidebar()`, `renderDeckHeader()`, `renderToolbar()`, `renderCardList()`, `renderStudy()`, and `renderStats()`. Each one redraws only its own container.
- **Event listeners are attached once,** in `app.js` during `init()`. Lists use event delegation on a stable parent (`#deck-list`, `#card-list`) and read `data-action` and `data-id` attributes from the clicked element using `event.target.closest("[data-action]")`. Render functions never add listeners.
- **Keyboard shortcuts** use a single `keydown` listener on `document`, added once in `init()`. The handler checks `ui.view` and the event target to decide whether to act, so no listeners are added or removed when switching views.
- **User text is inserted with `textContent`,** never `innerHTML`. Deck names and card text must not be able to inject HTML.
- **Stable selectors.** JavaScript selects elements by ID or `data-*` attribute, never by tag position or styling classes.

### 6.1 Modal interface (shared by version 1 and version 2)

`modal.js` is the only module that knows how modals work. Every other module uses these three functions:

```js
openModal(modalEl, openerEl)   // opens the modal, moves focus inside,
                               // remembers openerEl for returning focus
closeModal(modalEl)            // closes the modal, returns focus to the opener
confirmAction(message)         // opens #confirm-modal, returns a Promise
                               // that resolves to true (confirm) or false
```

Rules that keep the version 2 swap small:

- No code outside `modal.js` calls `showModal()`, `.close()`, or reads `.open` or `.returnValue`.
- Forms inside modals use `<form>` with a normal `submit` event listener and `event.preventDefault()`. Do not use `<form method="dialog">`.
- Cancel buttons are `type="button"` and call `closeModal()`.
- `isModalOpen()` is exported from `modal.js` so the keyboard handler can check it.

**Version 1:** modals are `<dialog>` elements opened with `showModal()`. Listen for the `cancel` event (Esc) and route it through `closeModal()` so focus is always returned to the opener.

**Version 2:** modals are `<div role="dialog" aria-modal="true" aria-labelledby="...">` elements, shown by removing `hidden`. Details are in Part 12.

## 7. Naming Conventions

- HTML IDs and CSS classes: kebab-case.
- State classes use an `is-` prefix: `is-active`, `is-flipped`, `is-hidden`.
- JavaScript functions and variables: camelCase. Constants: UPPER_SNAKE_CASE.
- Delegated actions use `data-action` with these exact values: `select-deck`, `edit-deck`, `delete-deck`, `edit-card`, `delete-card`.
- The related ID is stored in `data-id`.

### 7.1 Element IDs

| Area | IDs |
| --- | --- |
| Header | `app-header`, `new-deck-btn` |
| Sidebar | `deck-sidebar`, `deck-list`, `decks-toggle-btn` (mobile only), `decks-heading`, `empty-new-deck-btn` (deck empty state) |
| Deck header | `deck-title`, `edit-deck-btn`, `delete-deck-btn`, `export-deck-btn`, `import-deck-btn`, `import-file-input` |
| Stats | `deck-stats`, `stats-progress` (the `<progress>` element), `stats-progress-label`, `stats-empty` (no-cards message) |
| Toolbar | `search-input`, `match-count`, `new-card-btn`, `study-btn`, `review-btn`, `manage-btn`, `shuffle-btn` |
| Card list | `card-list`, `cards-heading` (visually hidden), `empty-new-card-btn` (card empty state), `clear-search-btn` (no-match state) |
| Study | `study-view`, `study-card`, `study-front`, `study-back`, `study-position`, `flip-btn`, `prev-btn`, `next-btn`, `rating-controls`, `again-btn`, `good-btn`, `easy-btn`, `study-session`, `study-empty`, `study-empty-message`, `study-empty-manage-btn`, `study-end` (end-of-session message), `study-end-message`, `study-again-btn`, `study-end-manage-btn` |
| Modals | `deck-modal`, `deck-modal-title`, `deck-form`, `deck-name-input`, `deck-name-error`, `deck-cancel-btn`, `deck-save-btn`, `confirm-modal-title`, `card-modal-title`, `card-front-error`, `card-back-error`, `card-form-hint`, `card-cancel-btn`, `card-save-btn`, `card-modal`, `card-form`, `card-front-input`, `card-back-input`, `confirm-modal`, `confirm-message`, `confirm-ok-btn`, `confirm-cancel-btn` |
| Messages | `status-message` (aria-live polite), `error-message` (aria-live assertive) |
| Footer | `app-footer` |

If a new ID or class is needed, add it to this table in the same part.

### 7.2 CSS classes

| Area | Classes |
| --- | --- |
| Utility | `visually-hidden` |
| State | `is-active`, `is-open` (mobile deck list expanded), `is-flipped` (study card showing its back), `no-transition` (suppresses the flip animation while the card changes) (see section 7 for other `is-` classes) |
| Study | `card-face`, `card-face--front`, `card-face--back`, `study-controls` |
| Modals and forms | `dialog-actions`, `form-field`, `field-error`, `form-hint` |
| Empty state | `empty-state` |
| Header | `app-name` |
| Layout | `app-layout` |
| Sidebar | `sidebar-heading`, `deck-item` |
| Deck header | `deck-header`, `deck-actions` |
| Stats | `stats-list`, `stat`, `stats-progress` (wrapper for the progress label and bar) |
| Toolbar | `toolbar`, `search-group`, `toolbar-actions` |
| Card list | `card-item`, `card-text`, `card-side`, `card-label`, `card-text-value`, `card-actions` |

## 8. Layout and Design

### 8.1 Layout

- **Header:** app name on the left, New Deck button on the right.
- **Sidebar:** list of decks. The active deck is highlighted and marked with `aria-current="true"`. Each deck item is a button that selects the deck.
- **Main:**
  - Deck header: deck title, Edit, Delete, Export, Import buttons.
  - Stats row (Part 9).
  - Toolbar: search input with match count, New Card, and view buttons (Manage, Study, Review due).
  - Content area: the card list in manage view, or the study card and controls in study and review views.
- **Footer:** short keyboard shortcut instructions.

### 8.2 Responsive behavior

- 768px and wider: CSS grid with a 260px sidebar and a fluid main column.
- Below 768px: single column. The deck list collapses behind a "Decks" button (`decks-toggle-btn`) using `aria-expanded` and `aria-controls`.
- No horizontal scrolling at 320px width.
- Touch targets are at least 44px by 44px.

### 8.3 Theme

All colors are CSS variables on `:root`, with dark mode values under `@media (prefers-color-scheme: dark)`. Purple is the accent color.

| Variable | Light | Dark |
| --- | --- | --- |
| `--color-bg` | `#faf9fc` | `#16141c` |
| `--color-surface` | `#ffffff` | `#211e2a` |
| `--color-text` | `#1f1b2d` | `#ece9f5` |
| `--color-text-muted` | `#5b5670` | `#b3adc6` |
| `--color-border` | `#ddd8ea` | `#3a3548` |
| `--color-accent` | `#6d28d9` | `#c4b5fd` |
| `--color-accent-text` | `#ffffff` | `#1f1b2d` |
| `--color-danger` | `#b91c1c` | `#fca5a5` |
| `--color-focus` | `#6d28d9` | `#c4b5fd` |

- All text and button color pairs must meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large text and UI borders). Verify in Part 11 and adjust values if needed.
- Focus style: `outline: 3px solid var(--color-focus); outline-offset: 2px;` on `:focus-visible` for every interactive element.
- Also define spacing, radius, and font variables (`--space-1` through `--space-6`, `--radius`, `--font-body`). Use the system font stack.

### 8.4 Flip animation

- `#study-card` has two faces (`.card-face--front`, `.card-face--back`) using `transform-style: preserve-3d` and `backface-visibility: hidden`.
- Adding `is-flipped` rotates the card 180 degrees on the Y axis over about 400ms, animating only `transform`.
- With `prefers-reduced-motion: reduce`, there is no rotation; the faces swap instantly.
- **Reset without revealing the next answer:** when moving to another card, add a `no-transition` class, remove `is-flipped`, update the text, force a reflow (read `offsetWidth`), then remove `no-transition`. The back of the next card must never be visible, even for a frame.
- The hidden face gets `aria-hidden="true"`; the visible face does not.

## 9. Features

### 9.1 Deck management

- New Deck opens `#deck-modal` with a name field. Saving adds the deck, makes it active, and closes the modal.
- Clicking a deck in the sidebar makes it active and returns to manage view.
- Edit opens the same modal with the current name filled in.
- Delete asks for confirmation through `confirmAction()`, showing the deck name and card count.
- Validation: name is required, 1 to 60 characters after trimming, and unique. Errors appear below the field, linked with `aria-describedby`, and focus stays in the field.
- Empty state: "No decks yet. Create your first deck to get started." with a New Deck button.

### 9.2 Card management

- New Card opens `#card-modal` with Front and Back fields (`<textarea>`).
- In the card fields, Enter adds a new line and Ctrl+Enter (Cmd+Enter on Mac) submits. Enter submits in single-line inputs, which is the browser's default form behavior.
- The card list shows each card's front and back with Edit and Delete buttons.
- Editing updates `updatedAt` and does not reset scheduling fields.
- Delete asks for confirmation.
- If the edited or deleted card is the current study card, the study view updates right away. Deleting a card removes its ID from `ui.study.order` and keeps `index` in range.
- Empty state: "No cards in this deck yet." with a New Card button.

### 9.3 Study mode

- The Study button enters study view with every card in the deck (after search filtering) in their saved order.
- Shuffle randomizes `ui.study.order` with a Fisher-Yates shuffle and resets to the first card. Shuffle does not change saved card order.
- Flip toggles the current card. Clicking the card itself also flips it.
- Previous and Next are disabled at the first and last card. No wrapping.
- Position text: "Card 3 of 10", announced through `status-message`.
- Moving to a card always shows its front.
- After flipping, the rating controls (Again, Good, Easy) appear. Rating a card applies section 9.6 and moves to the next card.
- Entering study or review sets the deck's `lastStudiedAt`.
- The Manage button returns to the card list.

### 9.4 Keyboard shortcuts

Handled by the single `document` keydown listener.

| Key | Action | Active when |
| --- | --- | --- |
| Space | Flip card | Study or review view |
| Arrow Right | Next card | Study or review view |
| Arrow Left | Previous card | Study or review view |
| 1, 2, 3 | Again, Good, Easy | Card is flipped |
| Esc | Close modal | Modal open (handled by `modal.js`) |
| Enter | Submit form | Single-line form inputs (browser default) |
| Ctrl/Cmd + Enter | Submit form | Card textareas |

Guards:

- Do nothing while a modal is open (`isModalOpen()`).
- Do nothing when the target is an `input`, `textarea`, `select`, or `[contenteditable]`.
- For Space, also do nothing when the target is a `button` or link, so Space keeps its normal meaning of pressing the focused button.
- Call `event.preventDefault()` for Space so the page does not scroll.
- Ignore key presses with Ctrl, Alt, or Meta held (except the Ctrl/Cmd + Enter submit).

### 9.5 Search

- `#search-input` filters cards in the active deck by a case-insensitive match on front or back text.
- Debounced at 300ms with `debounce()` from `utils.js`.
- `#match-count` shows "4 of 12 cards". The count is also announced through `status-message`.
- Search applies to the card list and to the study and review sets. Changing the query in study or review view rebuilds the order and resets to the first card, front side up.
- Clearing the search restores every card.
- Switching decks clears the search.
- Empty result: "No cards match 'term'."

### 9.6 Spaced repetition

Functions in `srs.js` are pure: they take a card and a timestamp and return the updated scheduling fields. `state.js` applies the result and saves.

```
DAY = 24 * 60 * 60 * 1000
MAX_INTERVAL = 365 days

Again: interval = 0
       dueAt = now
       lapses += 1
       In review view, the card is added again at the end of the session order.

Good:  interval = (interval === 0) ? 1 : interval * 2
       dueAt = now + interval * DAY

Easy:  interval = (interval === 0) ? 4 : interval * 3
       dueAt = now + interval * DAY

All ratings: interval = Math.min(interval, MAX_INTERVAL)
             reviewCount += 1
             lastReviewedAt = now
             updatedAt is not changed (that field tracks text edits only)

isDue(card, now) = card.dueAt <= now
```

- **Review due view** (`review-btn`) builds the session from due cards only. The button shows the due count, for example "Review due (5)", and is disabled when nothing is due.
- When a review session runs out of cards, show "All caught up. Next card due on [date]." or "All caught up." if the deck is empty.
- Ratings can also be given in regular study view, and they update the schedule the same way.

### 9.7 Progress and stats

Shown in `#deck-stats` for the active deck, computed from state each render (never stored):

- Total cards
- Due now
- New (reviewCount is 0)
- Total reviews (sum of reviewCount)
- Last studied: "Today", "Yesterday", a `toLocaleDateString()` date, or "Not studied yet"
- Progress: a native `<progress>` (value = cards with interval of 1 day or more, max = total) with a visible label such as "Learned 6 of 12 cards (50%)". For an empty deck, show "Add cards to start tracking progress." instead

Stats ignore the search query and are hidden when no deck is active.

### 9.8 Import and export

**Export** downloads the active deck as `deck-name.json` (name lowercased, spaces replaced with hyphens) using a Blob and a temporary link.

File format:

```json
{
  "format": "flashcards-app-deck",
  "version": 1,
  "exportedAt": 1760000000000,
  "deck": { "name": "Spanish Verbs" },
  "cards": [
    {
      "front": "hablar",
      "back": "to speak",
      "dueAt": 1760000000000,
      "interval": 2,
      "reviewCount": 3,
      "lapses": 0,
      "lastReviewedAt": 1759900000000
    }
  ]
}
```

**Import** opens a file picker (`#import-file-input`, `accept=".json,application/json"`):

- Reject files larger than 1 MB.
- Reject files that are not valid JSON or where `format` is not `flashcards-app-deck`.
- Each card must have non-empty string `front` and `back` within the length limits. Invalid cards are skipped.
- Scheduling fields are kept if they are valid numbers; otherwise the card is treated as new.
- Imported decks and cards always get new IDs.
- If the deck name already exists, add " (imported)", then " (imported 2)", and so on.
- The imported deck becomes active.
- Show a result message: "Imported 'Spanish Verbs': 24 cards (2 skipped)."
- Reset the file input so the same file can be imported again.

## 10. Accessibility Requirements

- Semantic landmarks: `header`, `nav` (deck list), `main`, `footer`. Use `section` with headings inside `main`.
- Every input has a visible `<label>` with matching `for` and `id`.
- Every button has visible text or an `aria-label`. Icon-only buttons need `aria-label`, for example "Edit deck Spanish Verbs".
- Focus is always visible. After deleting an item, focus moves to a sensible place (the next item, or the list's empty-state button).
- Dynamic updates are announced through `status-message` (polite) and errors through `error-message` (assertive).
- The whole app can be used with only the keyboard.
- Modal requirements: focus moves inside on open, Tab cannot reach the page behind, Esc closes, focus returns to the opener, the modal has an accessible name from its heading.

## 11. Build Plan

### 11.1 Workflow for every part

1. In Claude Code, run `/clear`, then prompt: "Read docs/SDD.md and CLAUDE.md. Build Part N only." Use plan mode. Review and adjust the plan before accepting.
2. Claude Code builds the part, then stops and lists every file and function it added or changed, plus anything it was unsure about.
3. The developer tests with the part's checklist, reads the code, and asks for refinements.
4. The developer commits. Claude Code never commits or pushes.

Each part lists **Scope** (what to build), **Not in scope** (what to leave for later), and **Checks** (what must pass before committing).

### Part 0: Project setup

- **Scope:** `app/index.html` with the doctype, `lang="en"`, viewport meta, title, a link to `styles.css`, and `<script type="module" src="js/app.js">`. Empty `styles.css`. `js/app.js` containing only a `console.log("Flashcards app loaded")`. `.gitignore` for OS and editor files.
- **Not in scope:** any layout or features.
- **Checks:** page loads through Live Server with the console message and no errors.
- **Commit:** `Part 0: project setup`

### Part 1: Layout shell

- **Scope:** semantic HTML for header, sidebar, main (deck header, stats placeholder, toolbar, content area), and footer, using the IDs in section 7.1. Static placeholder decks and cards. All CSS variables from section 8.3, base styles, responsive grid, focus styles, dark mode.
- **Not in scope:** JavaScript behavior, modals, flip animation.
- **Checks:**
  - Every ID and class in the HTML has a matching style or is listed in section 7.1, with no typos between files.
  - Layout works at 320px, 768px, and 1280px with no horizontal scroll.
  - Dark mode works when the operating system setting changes.
  - Tab moves through every button with a visible focus outline.
- **Commit:** `Part 1: layout shell`

### Part 2: State, storage, and rendering

- **Scope:** `utils.js` (`createId`, `debounce`), `storage.js` (section 5), `state.js` with the state shape and `setActiveDeck()`, `render.js` with `render()` and `renderSidebar()`, `app.js` with `init()`. Replace placeholder decks with the rendered list. Show the deck empty state.
- **Not in scope:** creating or editing decks through the UI.
- **Checks:**
  - With no saved data, the empty state appears.
  - Paste a sample state into LocalStorage through DevTools and reload: the decks appear.
  - Replace the saved value with broken JSON and reload: the app loads with the empty state, a backup key exists, and a warning is logged.
- **Commit:** `Part 2: state, storage, and rendering`

### Part 3: Modal and deck CRUD

- **Scope:** `modal.js` version 1 (`<dialog>`, section 6.1), `#deck-modal`, `#confirm-modal`, deck create, rename, delete, and select. Deck header shows the active deck. Delegated listener on `#deck-list`. Mobile decks toggle.
- **Not in scope:** cards.
- **Checks:**
  - Keyboard only: open the modal, Tab stays out of the page behind, Esc closes, focus returns to the button that opened it.
  - Empty, too-long, and duplicate names show an error and keep the modal open.
  - Sidebar updates without reloading; the active deck is highlighted and has `aria-current`.
  - Reload keeps decks and the last active deck.
  - Deleting the active deck selects another deck or shows the empty state.
  - Create and delete several decks, then confirm in DevTools that clicking a deck runs its handler only once.
- **Commit:** `Part 3: modal and deck CRUD`

### Part 4: Card CRUD

- **Scope:** `#card-modal`, card create, edit, and delete, card list in manage view with delegated listener on `#card-list`, card empty state, Ctrl/Cmd+Enter submit in textareas.
- **Not in scope:** study mode.
- **Checks:**
  - Front and back are required; errors show and focus stays in the field.
  - Editing updates the list right away and survives a reload.
  - Every card has a unique ID, including cards created quickly one after another.
  - Card text containing `<b>test</b>` displays as plain text.
- **Commit:** `Part 4: card CRUD`

### Part 5: Study mode and flip animation

- **Scope:** `study.js`, study view, flip (button and card click), previous, next, shuffle, position text, flip animation and reset (section 8.4), reduced motion support, `lastStudiedAt`.
- **Not in scope:** keyboard shortcuts, ratings.
- **Checks:**
  - Moving to another card always shows the front, with no flash of the next answer.
  - Previous is disabled on the first card and Next on the last.
  - Rapid clicking causes no console errors.
  - Editing or deleting the current card from manage view and returning to study keeps the view valid.
  - Flip runs smoothly in the browser's Performance panel (only `transform` animates).
- **Commit:** `Part 5: study mode and flip animation`

### Part 6: Keyboard shortcuts

- **Scope:** the single `document` keydown listener and guards from section 9.4, footer instructions. Keys 1, 2, and 3 can be wired now but will do nothing until Part 8.
- **Checks:**
  - Space, Arrow Left, and Arrow Right work in study view.
  - Typing a space in any input or textarea never flips a card.
  - Shortcuts do nothing while a modal is open.
  - Switching decks and views many times, then pressing Arrow Right once, moves exactly one card.
- **Commit:** `Part 6: keyboard shortcuts`

### Part 7: Search

- **Scope:** search with debounce, match count, announcements, empty result message, behavior in study view from section 9.5.
- **Checks:**
  - Search is case-insensitive and matches front or back.
  - Saved data in LocalStorage is unchanged after searching.
  - Clearing search restores every card.
  - Switching decks clears search.
- **Commit:** `Part 7: search`

### Part 8: Spaced repetition

- **Scope:** `srs.js`, rating controls after flip, keys 1, 2, and 3, review due view, due count on the Review button, end-of-session message.
- **Checks:**
  - A new card rated Good is due in 1 day; rated Good again, due in 2 days.
  - A new card rated Easy is due in 4 days.
  - Again sends the card to the end of the review session.
  - Change a card's `dueAt` to a past time in DevTools, reload, and confirm the card appears in review.
  - Ratings persist after reload.
- **Commit:** `Part 8: spaced repetition`

### Part 9: Progress and stats

- **Scope:** `renderStats()` with the values in section 9.7.
- **Checks:** every number is correct for a small test deck and updates right after a rating, add, or delete.
- **Commit:** `Part 9: progress and stats`

### Part 10: Import and export

- **Scope:** `io.js`, export and import from section 9.8.
- **Checks:**
  - Export, delete the deck, import the file: cards and scheduling come back.
  - Importing a non-JSON file, a JSON file in the wrong format, and a file over 1 MB each show an error and change nothing.
  - Importing a file with a few broken cards skips them and reports the count.
  - Importing the same file twice creates "Name (imported)".
- **Commit:** `Part 10: import and export`

### Part 11: QA and polish

- **Scope:** full accessibility audit (section 10), contrast check of every color pair in both themes, review of all empty states and error messages, `aria-live` announcements, any bug fixes found.
- **Checks:**
  - Complete a full session using only the keyboard: create a deck, add cards, study, rate, search, export.
  - Run Lighthouse accessibility in Chrome DevTools and fix any issues.
  - No console errors or warnings during normal use.
- **Commit:** `Part 11: QA and polish`
- **After committing:** `git tag v1.0` and `git push --tags`.

### Part 12: Version 2, hand-built modal

- **Scope:** replace the inside of `modal.js` and the modal markup and CSS. Keep the same `openModal()`, `closeModal()`, `confirmAction()`, and `isModalOpen()` interface.
  - Modal container: `<div role="dialog" aria-modal="true" aria-labelledby="...">` with a backdrop element, hidden with the `hidden` attribute when closed.
  - On open: remember the opener, set `inert` on `#app-header`, `#deck-sidebar`, `main`, and `#app-footer`, show the modal, focus the first field.
  - Focus trap: on Tab from the last focusable element, move to the first; on Shift+Tab from the first, move to the last. Recalculate the focusable list on every Tab press so disabled or hidden elements are skipped.
  - Esc closes. Clicking the backdrop closes.
  - On close: remove `inert`, hide the modal, return focus to the opener (if the opener was removed, focus `#new-deck-btn`).
  - Prevent page scrolling behind the open modal.
- **Not in scope:** any change to deck, card, study, or other feature code.
- **Checks:**
  - The Git diff shows changes only in `modal.js`, `index.html` modal markup, and modal CSS.
  - Every Part 3 modal check passes again with keyboard only.
  - Tab loops from the last button back to the first field and never reaches the browser address bar or the page.
  - Clicking or tabbing to the page behind the modal does nothing while it is open.
  - Test with a screen reader if available (VoiceOver on Mac, NVDA on Windows): the modal is announced by name.
- **Commit:** `Part 12: hand-built modal (version 2)`
- **After committing:** `git tag v2.0` and `git push --tags`.

### Part 13: Documentation, annotated copy, and deployment

- **Scope:**
  1. Copy `app/` to `app-annotated/`. Add comments to the HTML, CSS, and JS that explain why each section exists and how the pieces connect. Do not change any code.
  2. Write `app-annotated/REBUILD-GUIDE.md`: rebuild the app from an empty folder in stages, each ending with something that runs in the browser, naming the file and concept for each stage. Include a section comparing the version 1 `<dialog>` modal and the version 2 hand-built modal, with the command to view version 1 (`git checkout v1.0`).
  3. Verify that `app/` and `app-annotated/` are identical once comments are removed, and report the result.
  4. Write `README.md` (short description, features, how to run locally, screenshots, links to docs).
  5. Write `docs/deployment.md` and set up deployment of the `app/` folder, using either GitHub Pages with a GitHub Actions workflow that publishes `app/`, or Cloudflare Pages with `app` as the output directory and no build command.
  6. Add screenshots to `docs/screenshots/` (light, dark, mobile, study view).
- **Checks:** comments are accurate, the rebuild guide works when followed, the verification passes, the deployed site loads and works.
- **Commit:** `Part 13: documentation, annotated copy, and deployment`

## 12. Common AI Failure Modes to Catch During Review

- Class names or IDs that differ between HTML, CSS, and JS.
- Event listeners added inside render functions or added again on every view change.
- Missing labels, `for` and `id` mismatches, buttons without accessible names.
- Focus lost or sent to the top of the page after closing a modal or deleting an item.
- DOM queries tied to markup position instead of IDs or `data-*` attributes.
- LocalStorage overwritten with a partial state, or a crash on malformed data.
- Flip state not reset when the card changes.
- Off-by-one errors at the first and last card, or after deleting the last card.
- Search or shuffle changing saved data.
- `innerHTML` used with user text.
- Features from a later part added early.
