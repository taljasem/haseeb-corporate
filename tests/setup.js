import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement `scrollTo` / element.scrollTop writes used by
// the chat scroll pane — silence those so tests don't false-fail.
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

// i18next browser-languagedetector queries navigator + localStorage on
// init; jsdom has both, but localStorage is per-test isolated by default
// via jsdom's reset. No shim needed.
