'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const S = require('../site/shopping.js');
const entry = (id, title, category) => ({ itemId: id, product: { id, title, category } });

test('generic retailer routes are independent and survive JSON persistence', () => {
  const aldi = S.layout('aldi'), kaufland = S.layout('kaufland');
  assert.notDeepEqual(aldi.areas.map(x => x.id), kaufland.areas.map(x => x.id));
  const edited = S.assign(S.updateArea(S.moveArea(aldi, 'frozen', -8), 'frozen', { label: 'Mein Kühlgang', color: S.colors[0].value }), 'p1', 'frozen');
  assert.deepEqual(S.layout('aldi', JSON.parse(JSON.stringify(edited))), edited);
  assert.equal(aldi.areas[0].id, 'produce');
  assert.equal(S.layout('kaufland').assignments.p1, undefined);
});
test('area order actually sorts products, preserves duplicates and supports custom assignments', () => {
  let current = S.addArea(S.layout('aldi'), 'Erst hier');
  const custom = current.areas.find(area => area.label === 'Erst hier').id;
  current = S.moveArea(S.assign(current, 'milk', custom), custom, -100);
  const milk = entry('milk', 'Milch'), apple = entry('apple', 'Äpfel'), bread = entry('bread', 'Brot');
  const grouped = S.group([bread, milk, apple, milk], current);
  assert.deepEqual(grouped.map(g => g.area.id), [custom, 'produce', 'bakery']);
  assert.deepEqual(grouped.flatMap(g => g.entries), [milk, milk, apple, bread]);
  assert.equal(grouped[0].entries[0], milk);
});
test('original item assignments outrank selected alternative product assignments', () => {
  let current = S.assign(S.layout('aldi'), 'original', 'sweets');
  current = S.assign(current, 'alternative', 'pantry');
  const product = { id: 'alternative', title: 'Milch' };
  assert.equal(S.areaFor(product, current, 'original').id, 'sweets');
  assert.equal(S.group([{ itemId: 'original', product }], current)[0].area.id, 'sweets');
  assert.equal(S.areaFor(product, current).id, 'pantry');
});
test('deleting areas retains every item, remaps assignments, and retains mandatory other', () => {
  const current = S.assign(S.layout('aldi'), 'p', 'produce');
  const removed = S.removeArea(S.removeArea(current, 'produce'), 'other');
  const items = [entry('p', 'Äpfel'), entry('q', 'Banane'), entry('r', 'Brot')];
  assert.equal(removed.assignments.p, 'other');
  assert.equal(removed.areas.filter(a => a.id === 'other').length, 1);
  assert.equal(S.group(items, removed).flatMap(g => g.entries).length, 3);
  assert.equal(S.areaFor(items[1].product, removed).id, 'other');
  assert.equal(S.layout('aldi', JSON.parse(JSON.stringify(removed))).areas.some(a => a.id === 'produce'), false);
});
test('normalization tolerates unknown data and keeps identifiers, colors and icons safe', () => {
  for (const bad of [null, [], 4, 'bad', { areas: 'bad' }, { areas: [null, {}, { id: '__proto__' }] }]) {
    const current = S.layout('aldi', bad);
    assert.ok(current.areas.length);
    assert.ok(current.areas.some(a => a.id === 'other'));
  }
  const current = S.layout('aldi', JSON.parse('{"areas":[{"id":"produce","label":"<img src=x onerror=alert(1)>","color":"url(javascript:x)","icon":"<svg>"},{"id":"produce"},{"id":"custom-1","label":5}],"assignments":{"p":"missing","__proto__":"produce"}}'));
  assert.equal(current.areas.filter(a => a.id === 'produce').length, 1);
  assert.equal(current.areas[0].label, '<img src=x onerror=alert(1)>'); // Plain text; rendering callers escape it.
  assert.ok(S.colors.some(color => color.value === current.areas[0].color));
  assert.ok(S.icons.includes(current.areas[0].icon));
  assert.equal(current.assignments.p, 'other');
  assert.equal(Object.hasOwn(current.assignments, '__proto__'), false);
  const updated = S.updateArea(current, 'produce', { label: 'a'.repeat(80), id: 'hijacked' });
  assert.equal(updated.areas[0].label.length, 40);
  assert.equal(updated.areas[0].id, 'produce');
  assert.equal(S.group(null, null).length, 0);
  assert.equal(S.group([{}, null, entry('x', '')], null)[0].entries.length, 3);
});
test('typical groceries follow category and avoid ingredient or partial word false matches', () => {
  const cases = [
    ['Äpfel', '', 'produce'], ['Bananen', '', 'produce'], ['Vollkornbrot', '', 'bakery'],
    ['Basmati Reis', '', 'pantry'], ['Erdnussbutter', '', 'pantry'], ['Kokosmilch', '', 'pantry'],
    ['Dosentomaten', '', 'pantry'], ['Butterkekse', '', 'sweets'], ['Vollmilchschokolade', '', 'sweets'],
    ['Mineralwasser', '', 'drinks'], ['Toilettenpapier', '', 'household'], ['Milch', '', 'dairy'],
    ['Gouda', '', 'dairy'], ['Hähnchenbrust', '', 'meat'], ['TK Brokkoli', 'Gemüse', 'frozen'],
    ['Tiefgekühltes Hähnchen', 'Fleisch', 'frozen'], ['Vanilleeis', '', 'frozen'],
    ['Joghurt mit Erdbeeren', '', 'dairy'], ['Reis mit Hähnchen', '', 'pantry'],
    ['Müsliriegel mit Milch', 'Süßwaren', 'sweets'], ['Apfel Shampoo', 'Drogerie', 'household'],
    ['Milchschokolade', 'Süßwaren', 'sweets'], ['Salatdressing', '', 'other'],
    ['GOLDÄHREN Vollkornbrot', 'Backwaren, Aufstriche & Cerealien', 'bakery'],
    ['GOLDÄHREN Toast', 'Backwaren, Aufstriche & Cerealien', 'bakery'],
    ['Haferflocken', 'Backwaren, Aufstriche & Cerealien', 'pantry'],
    ['Brot mit Käse', 'Backwaren, Aufstriche & Cerealien', 'bakery'],
    ['Brotaufstrich', 'Aufstriche', 'pantry'], ['Unbekannt', '', 'other']
  ];
  const current = S.layout('aldi');
  for (const [title, category, expected] of cases) assert.equal(S.areaFor({ title, category }, current).id, expected, title);
  assert.equal(S.areaFor({ name: 'Brot' }, current).id, 'bakery');
  assert.equal(S.areaFor({ title: 'Hühnerfrikassee', brand: 'FRoSTA', category: 'Fertiggerichte' }, current).id, 'frozen');
});
test('all mutations are pure and custom ids stay stable after normalization', () => {
  const source = S.layout('aldi'), before = JSON.stringify(source);
  for (const next of [
    S.moveArea(source, 'produce', 1), S.updateArea(source, 'produce', { label: 'Neu' }),
    S.addArea(source, 'Eigener Gang'), S.removeArea(source, 'produce'), S.assign(source, 'p', 'produce')
  ]) {
    assert.notEqual(next, source);
    assert.notEqual(next.areas[0], source.areas[0]);
    assert.equal(JSON.stringify(source), before);
  }
  const added = S.addArea(S.addArea(source, 'A'), 'B');
  assert.equal(new Set(added.areas.map(a => a.id)).size, added.areas.length);
  assert.deepEqual(S.layout('aldi', added), added);
  assert.deepEqual(S.moveArea(source, 'produce', NaN), source);
});
test('browser UMD exposes the same module without dependencies', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../site/shopping.js'), 'utf8'), context);
  assert.equal(typeof context.SparnahShopping.group, 'function');
  assert.equal(context.SparnahShopping.layout('aldi').areas[0].id, 'produce');
});
