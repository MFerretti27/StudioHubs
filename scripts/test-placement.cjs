// Run with: node scripts/test-placement.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Resources/studiohubs/main.js'), 'utf8');
const placementCode = source.slice(source.indexOf('function normalizeSectionText('), source.indexOf('function ensureSection('));
const context = { CACHE: { config: {} }, window: {}, console };
vm.createContext(context);
vm.runInContext(placementCode, context);

function makeSection(title, { library = false, first = false } = {}) {
  return {
    title,
    classList: { contains: name => first && name === 'section0' },
    querySelector(selector) {
      if (selector === '.homeLibraryButtonContainer') return library ? {} : null;
      return { textContent: title };
    }
  };
}

function makeRoot(children) {
  const container = {
    children: [...children],
    moves: 0,
    insertBefore(node, reference) {
      this.moves++;
      this.children = this.children.filter(child => child !== node);
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      assert.ok(index >= 0);
      this.children.splice(index, 0, node);
      this.sync();
    },
    sync() {
      this.children.forEach((child, index) => {
        child.parentElement = this;
        child.nextElementSibling = this.children[index + 1] || null;
      });
    }
  };
  container.sync();
  return container;
}

const positions = {
  'after-my-media': 'My Media',
  'after-continue-watching': 'Continue Watching',
  'after-latest-media': 'Latest Movies',
  'after-next-up': 'Next Up',
  'after-continue-listening': 'Continue Listening',
  'after-continue-reading': 'Continue Reading',
  'after-live-tv': 'Live TV',
  'after-active-recordings': 'Active Recordings'
};

function checkPlacement(position, sections, expectedIndex) {
  context.CACHE.config = { homePosition: position };
  const hub = makeSection('Studio Collections');
  const container = makeRoot(sections);
  context.placeSection(container, hub);
  assert.equal(container.children.indexOf(hub), expectedIndex, position);
  const moves = container.moves;
  context.placeSection(container, hub);
  assert.equal(container.moves, moves, 'unchanged placement must not move DOM nodes');
}

for (const [position, title] of Object.entries(positions)) {
  checkPlacement(position, [makeSection('Other'), makeSection(title), makeSection('Last')], 2);
}
checkPlacement('top', [makeSection('My Media')], 0);
checkPlacement('after-next-up', [makeSection('My Media'), makeSection('Last')], 1);
checkPlacement('after-next-up', [makeSection('Libraries', { library: true }), makeSection('Last')], 1);
checkPlacement('after-next-up', [makeSection('Unknown', { first: true }), makeSection('Last')], 1);
checkPlacement('after-next-up', [makeSection('Unknown')], 0);
checkPlacement('after-next-up', [], 0);
checkPlacement('after-latest-media', [makeSection('Latest from Movies')], 1);
context.window.Globalize = { translate: (key) => key === 'HeaderContinueWatching' ? '继续观看' : key };
checkPlacement('after-continue-watching', [makeSection('继续观看')], 1);
context.window.Globalize = { translate: (key) => key === 'LatestFromLibrary' ? 'Neu aus ' : key };
checkPlacement('after-latest-media', [makeSection('Neu aus Filme')], 1);
context.window.Globalize = { translate: () => { throw new Error('translation unavailable'); } };
checkPlacement('after-next-up', [makeSection('Next Up')], 1);

const html = fs.readFileSync(path.join(root, 'Web/configuration.html'), 'utf8');
const dropdown = html.match(/<select\b[^>]*\bid="studioHubsHomePosition"[^>]*>[\s\S]*?<\/select>/)[0];
assert.match(dropdown, /is="emby-select"/);
assert.match(html, /data-require="emby-select"/);
const options = [...dropdown.matchAll(/value="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(options, ['top', ...Object.keys(positions)]);
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
console.log('Placement checks passed: all dropdown choices, fallback chain, translations, and stable repeated placement.');