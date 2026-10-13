const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('ExpressionShelf_Web/index.html', 'utf8');
const app = fs.readFileSync('ExpressionShelf_Web/app.js', 'utf8');
const css = fs.readFileSync('ExpressionShelf_Web/style.css', 'utf8');

assert(html.includes('data-scope="favorites"'), 'favorites shelf tab exists');
assert(app.includes("const FAVORITES_KEY = 'ExpressionShelf.favorites.v1'"), 'favorites use a persistent, namespaced key');
assert(app.includes('localStorage.setItem(FAVORITES_KEY'), 'favorites are persisted');
assert(app.includes("state.scope === 'favorites' ? !favorites.has(p.id)"), 'favorites scope filters the grid');
assert(app.includes("star.onclick = (e) =>"), 'each card has a favorite toggle');
assert(app.includes('아직 즐겨찾기가 없습니다.'), 'empty favorites state explains how to add items');
assert(css.includes('.favorite-btn.on'), 'favorite state is visually distinct');

console.log('Favorites persistence and shelf UI checks passed.');
