// Run: node --test tests/game.test.cjs
// Isolated game logic tests: no browser, network, or real user saves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../dist/game.js'), 'utf8');

function boot(saved) {
  const nodes = new Map();
  function element() {
    const classes = new Set();
    const children = new Map();
    return { style: {}, dataset: {}, open: false, textContent: '', innerHTML: '',
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle(x, v) { v ? classes.add(x) : classes.delete(x); } },
      addEventListener() {}, setAttribute() {}, setPointerCapture() {},
      getBoundingClientRect: () => ({ width: 390, height: 450, left: 0, top: 0 }),
      getContext: () => ({ setTransform() {} }),
      querySelector(s) { if (!children.has(s)) children.set(s, element()); return children.get(s); },
      querySelectorAll: () => [], appendChild() {},
      showModal() { this.open = true; }, close() { this.open = false; },
    };
  }
  const document = { hidden: false,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    querySelector: () => [...nodes.values()].find(n => n.open) || null,
    querySelectorAll: () => [], createElement: element, addEventListener() {},
  };
  const storage = new Map(saved ? [['nightMarketMergeSave_v3', JSON.stringify(saved)]] : []);
  const context = vm.createContext({ document, window: { addEventListener() {} },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v) },
    performance: { now: () => 0 }, devicePixelRatio: 1, requestAnimationFrame() {},
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, confirm: () => true, console,
  });
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `globalThis.api = {
    get state() { return state; }, activePlay, updateTimers, makeOrder, makeOrders,
    canComplete, canMergePieces, completeShift, choosePerk, beginRun, selectStage,
    finishRun, buyUpgrade, discover, fulfill, produce, ensureProducers,
    select(i) { selectedCell = i; }, sellSelected, splitSelected, save
  }; })();`), context);
  const api = context.api;
  function play() { api.state.introduced = true; document.getElementById('homeScreen').classList.add('hidden'); }
  return { api, play, nodes, document, storage };
}

test('home and upgrade choice pause timers; active play regenerates energy', () => {
  const {api, play, document} = boot();
  const start = api.state.orders[0].remaining;
  api.updateTimers(4); assert.equal(api.state.orders[0].remaining, start);
  play(); api.updateTimers(3); assert.equal(api.state.energy, 101);
  assert.equal(api.state.orders[0].remaining, start - 3);
  document.getElementById('helpDialog').showModal();
  api.updateTimers(3); assert.equal(api.state.orders[0].remaining, start - 3);
});

test('two rounds yield one upgrade choice then victory and permanent stars', () => {
  const {api, play} = boot(); play();
  api.completeShift(); assert.equal(api.state.shift, 2); assert.equal(api.state.offers.length, 3);
  const time = api.state.orders[0].remaining;
  api.updateTimers(5); assert.equal(api.state.orders[0].remaining, time);
  const key = api.state.offers[0]; api.choosePerk(key); assert.equal(api.state.perks[0], key);
  api.state.runCombo = 3; api.completeShift();
  assert.equal(api.state.gameOver, true); assert.equal(api.state.won, true);
  assert.equal(api.state.records[1].stars, 3); assert.equal(api.state.unlockedStage, 2);
  const coins = api.state.coins; api.beginRun(2);
  assert.equal(api.state.coins, coins); assert.equal(api.state.records[1].stars, 3);
  assert.equal(api.state.perks.length, 0); assert.equal(api.state.splits, 2);
  assert.equal(api.state.board.filter(p => p?.type === 'trash').length, 2);
});

test('permanent upgrades and collections charge/reward only once per action', () => {
  const {api} = boot(); api.state.coins = 1000;
  api.buyUpgrade('stove'); assert.equal(api.state.coins, 820); assert.equal(api.state.upgrades.stove, 1);
  const item = { type: 'item', chain: 'rice', level: 4 };
  api.discover(item); assert.equal(api.state.coins, 870);
  api.discover(item); assert.equal(api.state.coins, 870);
  api.beginRun(1); assert.equal(api.state.upgrades.stove, 1); assert.equal(api.state.discovered['rice:4'], true);
});

test('all orders use existing producers; preparation time scales with ingredients', () => {
  const {api} = boot(); api.state.level = 99;
  for (let n = 0; n < 200; n++) {
    const order = api.makeOrder(99, 2, n % 3, 3);
    assert.ok(order.items.every(item => item.chain !== 'sweet'));
    assert.ok(order.remaining >= order.items.reduce((sum,p) => sum + 2 ** p.level,0) * 3.2 + 25);
  }
});

test('split conserves ingredient value; repeated items require exact inventory', () => {
  const {api, play} = boot(); play(); api.state.board.fill(null);
  api.state.board[0] = {type:'item',chain:'rice',level:2}; api.select(0); api.splitSelected();
  assert.equal(api.state.splits,1);
  const order = {items:[{chain:'rice',level:1},{chain:'rice',level:1}]};
  assert.equal(api.canComplete(order),true); api.sellSelected(); assert.equal(api.canComplete(order),false);
  assert.equal(api.canMergePieces({type:'item',chain:'rice',level:1},{type:'item',chain:'grill',level:1}),false);
});

test('failure and saved round break survive reload without losing permanent progress', () => {
  const {api, play, storage} = boot(); play(); api.completeShift(); api.save();
  const reload = boot(JSON.parse(storage.get('nightMarketMergeSave_v3')));
  assert.equal(reload.api.state.offers.length,3); assert.equal(reload.api.activePlay(),false);
  api.choosePerk(api.state.offers[0]); api.state.lives = 1; api.state.orders[0].remaining = .1;
  api.updateTimers(1); assert.equal(api.state.gameOver,true); assert.equal(api.state.won,false);
  const coins=api.state.coins; api.beginRun(1); assert.equal(api.state.coins,coins);
});

test('complete order-to-victory loop consumes items and records exactly one clear', () => {
  const {api, play} = boot(); play();
  for (let n=0; n<12; n++) {
    const order = api.state.orders[0];
    api.state.board = api.state.board.map(p => p?.type === 'generator' ? p : null);
    order.items.forEach(item => {
      const slot = api.state.board.findIndex(p => !p);
      api.state.board[slot] = {type:'item',...item};
    });
    api.fulfill(0);
    assert.equal(api.state.board.filter(p => p?.type === 'item').length,0);
    if (api.state.offers.length) api.choosePerk(api.state.offers[0]);
  }
  assert.equal(api.state.won,true);
  assert.equal(api.state.stageWins[1],2);
  const coins = api.state.coins;
  api.fulfill(0); assert.equal(api.state.coins,coins);
});
