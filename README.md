# Rouse: Flascard App

> A single-page Flashcards web app built with plain HTML, CSS, and JavaScript. Users create decks, add cards with front and back text, and study the cards with flip animations, shuffling, keyboard shortcuts, and simple spaced repetition. All data is saved in the browser with LocalStorage.

**The app is built in small parts. After each part, the developer reviews the code, refines it, and commits to GitHub before the next part begins.**

### Tech Stack and Constraints

- Plain HTML, CSS, and JavaScript. No frameworks, no build tools, no npm packages.
- JavaScript is split into ES modules (`<script type="module">`).
- ES modules do not load from a file opened directly in the browser (`file://`). Run the app with a local server, such as the VS Code Live Server extension.
- Targets current versions of Chrome, Edge, Firefox, and Safari, desktop and mobile.
- No external libraries are needed. Icons, if used, are inline SVG.