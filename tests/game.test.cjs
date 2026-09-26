// Run: node --test tests/game.test.cjs
// Isolated game logic tests: no browser, network, or real user saves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../dist/game.js'), 'utf8');
const audioSource = fs.readFileSync(path.join(__dirname, '../dist/audio.js'), 'utf8');

function boot(saved) {
  const nodes = new Map();
  function element() {
    const classes = new Set();
    const children = new Map();
    const listeners = new Map();
    return { style: {}, dataset: {}, open: false, textContent: '', innerHTML: '',
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle(x, v) { v ? classes.add(x) : classes.delete(x); } },
      addEventListener(name, fn) { listeners.set(name, fn); },
      fire(name, event = {}) { listeners.get(name)?.({ preventDefault() {}, pointerId: 1, ...event }); },
      setAttribute() {}, setPointerCapture() {},
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
  vm.runInContext(audioSource, context);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `globalThis.api = {
    get state() { return state; }, activePlay, updateTimers, makeOrder, makeOrders,
    canComplete, canMergePieces, completeShift, choosePerk, beginRun, selectStage,
    finishRun, buyUpgrade, discover, fulfill, produce, ensureProducers,
    select(i) { selectedCell = i; }, sellSelected, splitSelected, save,
    movePiece, orderInventory, findMerge, renderGuidance,
    get selected() { return selectedCell; }
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

test('twelve merges activate free production, faster cooldowns, and pause at home', () => {
  const {api, play, document} = boot(); play();
  api.state.board.fill(null);
  api.state.board[2] = {type:'generator', chain:'rice', cooldown:0};
  for (let n = 0; n < 12; n++) {
    api.state.board[0] = {type:'item', chain:'rice', level:0};
    api.state.board[1] = {type:'item', chain:'rice', level:0};
    api.movePiece(0,1);
  }
  assert.equal(api.state.merges, 12);
  assert.equal(api.state.feverTime, 15);
  assert.equal(api.state.heat, 0);
  api.state.energy = 0;
  api.produce(2);
  assert.equal(api.state.energy, 0);
  assert.equal(api.state.board[2].cooldown, 2);
  api.updateTimers(.5);
  assert.equal(api.state.board[2].cooldown, 1);
  document.getElementById('homeScreen').classList.remove('hidden');
  api.updateTimers(3);
  assert.equal(api.state.feverTime, 14.5);
  api.state.feverTime = .25; play();
  api.updateTimers(.5);
  assert.equal(api.state.board[2].cooldown, .25);
  assert.equal(api.state.feverTime, 0);
});

test('tap-to-merge, tap-to-move, cancelled gestures and secondary pointers are safe', () => {
  const {api, play, nodes} = boot(); play();
  api.state.board.fill(null);
  ['rice','noodle','grill'].forEach((chain, i) => { api.state.board[10+i] = {type:'generator',chain}; });
  api.state.board[0] = {type:'item',chain:'rice',level:0};
  api.state.board[1] = {type:'item',chain:'rice',level:0};
  const canvas = nodes.get('gameCanvas');
  // 390 × 450 test canvas: 53.43px cells, 8px left and 11.29px top.
  const first = {clientX:35, clientY:38};
  const second = {clientX:88, clientY:38};
  canvas.fire('pointerdown', first); canvas.fire('pointerup', first);
  canvas.fire('pointerdown', second);
  canvas.fire('pointerup', {...second, pointerId:2});
  assert.equal(api.state.board[1].level,0);
  canvas.fire('pointerup', second);
  assert.equal(api.state.board[0],null);
  assert.equal(api.state.board[1].level,1);
  canvas.fire('pointerdown', first);
  assert.equal(api.state.board[0].level,1);
  assert.equal(api.state.board[1],null);
  canvas.fire('pointerdown', first); canvas.fire('pointercancel');
  canvas.fire('pointerup',second);
  assert.equal(api.state.board[0].level,1);
});

test('sale undo conserves currency and item; later board changes invalidate undo', () => {
  const {api, play} = boot(); play();
  api.state.board[0] = {type:'item',chain:'grill',level:3};
  api.select(0); const coins = api.state.coins;
  api.sellSelected(); assert.equal(api.state.coins,coins+4);
  api.sellSelected(); assert.equal(api.state.coins,coins);
  assert.equal(api.state.board[0].level,3);
  api.sellSelected();
  api.state.board[1] = {type:'item',chain:'rice',level:0};
  api.movePiece(1,0);
  api.sellSelected();
  assert.equal(api.state.board[0],null);
  assert.equal(api.state.coins,coins+5);
});

test('order readiness allocates duplicates once and capped items have no merge hint', () => {
  const {api, play} = boot(); play(); api.state.board.fill(null);
  api.state.board[0] = {type:'item',chain:'rice',level:1};
  const items = api.orderInventory({items:[{chain:'rice',level:1},{chain:'rice',level:1}]});
  assert.equal(items[0].ready,true); assert.equal(items[1].ready,false);
  api.state.board[1] = {type:'item',chain:'rice',level:5};
  api.state.board[2] = {type:'item',chain:'rice',level:5};
  assert.equal(api.canMergePieces(api.state.board[1], api.state.board[2]),false);
  api.state.board[3] = {type:'wild',level:1};
  api.findMerge(); assert.equal(api.selected,0);
});

test('old saves gain new run counters and persisted fever resets on a new run', () => {
  const {api} = boot();
  const old = JSON.parse(JSON.stringify(api.state));
  delete old.totalServed; delete old.heat; delete old.feverTime; delete old.merges;
  old.shift = 2; old.served = 2;
  const reload = boot(old);
  assert.equal(reload.api.state.totalServed,8);
  assert.equal(reload.api.state.heat,0);
  reload.api.state.feverTime=12;
  reload.api.save();
  const resumed = boot(JSON.parse(reload.storage.get('nightMarketMergeSave_v3')));
  assert.equal(resumed.api.state.feverTime,12);
  resumed.api.beginRun(1);
  assert.equal(resumed.api.state.feverTime,0);
  assert.equal(resumed.api.state.totalServed,0);
});

test('next-stage result action starts the unlocked stage and last stage hides it', () => {
  const {api, play, nodes} = boot(); play();
  api.finishRun(true);
  assert.equal(nodes.get('nextStageBtn').hidden,false);
  const coins = api.state.coins;
  nodes.get('nextStageBtn').fire('click');
  assert.equal(api.state.stage,2);
  assert.equal(api.state.coins,coins);
  assert.equal(api.state.gameOver,false);
  assert.equal(api.activePlay(),true);
  api.beginRun(3); api.finishRun(true);
  assert.equal(nodes.get('nextStageBtn').hidden,true);
});

test('independent audio preferences survive saves and new runs; old mute is respected', () => {
  const {api,storage}=boot();
  api.state.musicOn=false; api.state.effectsOn=true; api.state.musicVolume=.23;
  api.beginRun(1); api.save();
  const reload=boot(JSON.parse(storage.get('nightMarketMergeSave_v3')));
  assert.equal(reload.api.state.musicOn,false);
  assert.equal(reload.api.state.effectsOn,true);
  assert.equal(reload.api.state.musicVolume,.23);
  const old=JSON.parse(JSON.stringify(api.state));
  delete old.effectsOn; delete old.musicVolume;
  const migrated=boot(old);
  assert.equal(migrated.api.state.effectsOn,false);
  assert.equal(migrated.api.state.musicVolume,.55);
});
