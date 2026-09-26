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
  const storage = new Map(saved ? [[saved.mode === 'cozy' ? 'nightMarketMergeSave_cozy_v1' : 'nightMarketMergeSave_v3', JSON.stringify(saved)]] : []);
  const context = vm.createContext({ document, window: { addEventListener() {} },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v) },
    performance: { now: () => 0 }, devicePixelRatio: 1, requestAnimationFrame() {},
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, confirm: () => true, console,
  });
  vm.runInContext(audioSource, context);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `globalThis.api = {
    get state() { return state; }, activePlay, updateTimers, makeOrder, makeOrders,
    canComplete, canMergePieces, expandShop, buyDecoration, swapOrder, expansionReady,
    buyUpgrade, discover, fulfill, produce, ensureProducers, orderReward,
    select(i) { selectedCell = i; }, sellSelected, save,
    movePiece, orderInventory, findMerge, renderGuidance,
    get selected() { return selectedCell; }
  }; })();`), context);
  const api = context.api;
  function play() { api.state.introduced = true; document.getElementById('homeScreen').classList.add('hidden'); }
  return { api, play, nodes, document, storage };
}


const KEY = 'nightMarketMergeSave_cozy_v1';
function stockOrder(api, slot=0) {
  const order = api.state.orders[slot];
  api.state.board = api.state.board.map(p => p?.type === 'generator' ? p : null);
  order.items.forEach(item => {
    const cell=api.state.board.findIndex(p => !p);
    api.state.board[cell]={type:'item',...item};
  });
}

test('orders never expire, supplies are free, and home/dialog pause producer cooldowns', () => {
  const {api,play,document}=boot(); play();
  const orderId=api.state.orders[0].id;
  assert.equal('remaining' in api.state.orders[0],false);
  api.state.orders[0].remaining=.01; // Even stale timer fields must not punish the player.
  api.updateTimers(86400);
  assert.equal(api.state.orders[0].id,orderId);
  assert.notEqual(api.state.gameOver,true);
  const i=api.state.board.findIndex(p=>p?.type==='generator');
  api.state.discovered['rice:1']=true;
  const coins=api.state.coins;
  api.produce(i);
  assert.equal(api.state.coins,coins);
  assert.equal(api.state.board[i].cooldown,.55);
  document.getElementById('homeScreen').classList.remove('hidden');
  api.updateTimers(10); assert.equal(api.state.board[i].cooldown,.55);
  play(); document.getElementById('helpDialog').showModal();
  api.updateTimers(10); assert.equal(api.state.board[i].cooldown,.55);
  document.getElementById('helpDialog').close();
  api.updateTimers(1); assert.equal(api.state.board[i].cooldown,0);
});

test('expansion needs both real deliveries and money, preserves board, and unlocks tea', () => {
  const {api}=boot();
  api.state.coins=10000;
  api.expandShop(); assert.equal(api.state.shopLevel,1);
  api.state.totalOrders=8; api.state.coins=279;
  api.expandShop(); assert.equal(api.state.shopLevel,1);
  api.state.coins=1000;
  const board=api.state.board;
  api.expandShop(); assert.equal(api.state.shopLevel,2); assert.equal(api.state.coins,720);
  assert.equal(api.state.board,board);
  api.expandShop(); assert.equal(api.state.shopLevel,2);
  api.state.totalOrders=22; api.expandShop();
  assert.equal(api.state.shopLevel,3); assert.equal(api.state.coins,20);
  assert.ok(api.state.board.some(p=>p?.type==='generator'&&p.chain==='sweet'));
});

test('decorations obey level and cost, are not double charged, and survive reload', () => {
  const {api,storage}=boot();
  api.state.coins=1000;
  api.buyDecoration('cat'); assert.equal(api.state.coins,1000);
  api.buyDecoration('lantern'); assert.equal(api.state.coins,880);
  api.buyDecoration('lantern'); assert.equal(api.state.coins,880);
  api.buyDecoration('unknown'); assert.equal(api.state.coins,880);
  api.save();
  const reload=boot(JSON.parse(storage.get(KEY)));
  assert.equal(reload.api.state.decorations.lantern,true);
  assert.equal(reload.api.state.coins,880);
});

test('legacy victory, round choices, inventory, upgrades, collections and music migrate safely', () => {
  const old={...JSON.parse(JSON.stringify(boot().api.state)),mode:undefined,level:3,
    coins:4321,gameOver:true,offers:['speed'],perks:['speed'],stage:2,shift:2,served:3,
    stageWins:{1:2,2:1},totalServed:10,records:{1:{stars:3,score:1000}},
    upgrades:{stove:2,service:1,supply:3},musicOn:false,effectsOn:true,musicVolume:.23};
  old.board[0]={type:'trash'};
  old.board[1]={type:'item',chain:'rice',level:4};
  old.orders[0].remaining=0;
  const {api,play,storage}=boot(old);
  assert.equal(api.state.mode,'cozy'); assert.equal(api.state.gameOver,false);
  assert.equal(api.state.offers.length,0); assert.equal(api.state.coins,4321);
  assert.equal(api.state.totalOrders,22);
  assert.equal(api.state.board[1].level,4);
  assert.equal(api.state.discovered['rice:4'],true);
  assert.equal(api.state.upgrades.stove,2);
  assert.equal(api.state.records[1].stars,3);
  assert.ok(!api.state.board.some(p=>p?.type==='trash'));
  assert.equal('remaining' in api.state.orders[0],false);
  assert.equal(api.state.musicOn,false); assert.equal(api.state.effectsOn,true);
  assert.equal(api.state.musicVolume,.23);
  assert.ok(storage.has('nightMarketMergeSave_v3'));
  assert.equal(JSON.parse(storage.get('nightMarketMergeSave_v3')).coins,4321);
  play(); assert.equal(api.activePlay(),true);
  const reload=boot(JSON.parse(storage.get(KEY)));
  assert.equal(reload.api.state.coins,4321);
  assert.equal(reload.api.state.totalOrders,22);
});

test('a real first merge completes an order and the twelfth delivery does not end the game', () => {
  const {api,play}=boot(); play();
  api.movePiece(50,51);
  assert.equal(api.canComplete(api.state.orders[0]),true);
  api.fulfill(0);
  for(let n=1;n<12;n++){stockOrder(api);api.fulfill(0);}
  assert.equal(api.state.totalOrders,12);
  assert.equal(api.state.orders.length,3);
  assert.equal(api.activePlay(),true);
  assert.notEqual(api.state.gameOver,true);
});

test('more than 600 deliveries allow ten shop ranks and max rank continues earning', () => {
  const {api,play}=boot();play();
  for(let n=0;n<1000;n++){
    stockOrder(api,n%3); api.fulfill(n%3);
    if(api.expansionReady())api.expandShop();
  }
  assert.equal(api.state.shopLevel,10);
  assert.equal(api.state.totalOrders,1000);
  assert.equal(api.expansionReady(),false);
  const coins=api.state.coins;stockOrder(api);api.fulfill(0);
  assert.ok(api.state.coins>coins);
  assert.equal(api.state.totalOrders,1001);
  assert.equal(api.activePlay(),true);
});

test('regular affection and automatic ten-order gifts cannot be reclaimed after reload', () => {
  const {api,play,storage}=boot();play();
  api.state.totalOrders=9;
  api.state.regulars[0]=4;
  api.state.orders[0].customer=0;
  stockOrder(api);
  const expected=api.state.coins+api.orderReward(api.state.orders[0])+80+120;
  api.fulfill(0);
  assert.equal(api.state.coins,expected);
  assert.equal(api.state.regulars[0],5);
  const reload=boot(JSON.parse(storage.get(KEY)));
  assert.equal(reload.api.state.coins,expected);
  assert.equal(reload.api.state.regulars[0],5);
  assert.equal(reload.api.state.totalOrders,10);
});

test('free swapping changes only the selected order and never awards money or progress', () => {
  const {api,play}=boot();play();
  const coins=api.state.coins;
  const second=api.state.orders[1].id;
  api.fulfill(1); // Not ready: track it.
  const first=api.state.orders[0].id;
  api.swapOrder();
  assert.notEqual(api.state.orders[1].id,second);
  assert.equal(api.state.orders[0].id,first);
  assert.equal(api.state.totalOrders,0);
  assert.equal(api.state.coins,coins);
  stockOrder(api,1);
  const readyId=api.state.orders[1].id;
  api.swapOrder();
  assert.equal(api.state.orders[1].id,readyId);
});

test('menus always use available producers, vary cuisine, and retain a quick order at high rank', () => {
  const {api}=boot();
  const seen=new Set();
  for(let rank=1;rank<=10;rank++){
    api.state.shopLevel=rank;
    api.state.teaUnlocked=rank>=3;api.ensureProducers();
    for(let n=0;n<100;n++){
      api.state.totalOrders=n;
      const slot=n%3, order=api.makeOrder(0,0,slot);
      for(const item of order.items){
        seen.add(item.chain);
        assert.ok(api.state.board.some(p=>p?.type==='generator'&&p.chain===item.chain));
        if(slot===0)assert.ok(item.level<=2);
      }
      assert.equal('remaining' in order,false);
    }
  }
  assert.equal(seen.size,4);
});

test('tap merge, tap move and mismatched pointers cannot lose inventory', () => {
  const {api,play,nodes}=boot();play();
  const canvas=nodes.get('gameCanvas');
  const first={clientX:88,clientY:412},second={clientX:141,clientY:412};
  canvas.fire('pointerdown',first);canvas.fire('pointerup',first);
  canvas.fire('pointerdown',second);canvas.fire('pointerup',{...second,pointerId:2});
  assert.equal(api.state.board[51].level,0);
  canvas.fire('pointerup',second);
  assert.equal(api.state.board[50],null);assert.equal(api.state.board[51].level,1);
  canvas.fire('pointerdown',first);
  assert.equal(api.state.board[50].level,1);assert.equal(api.state.board[51],null);
  canvas.fire('pointerdown',first);canvas.fire('pointercancel');canvas.fire('pointerup',second);
  assert.equal(api.state.board[50].level,1);
});

test('duplicate order items require separate inventory; hints ignore max-rank items', () => {
  const {api,play}=boot();play();
  api.state.board[0]={type:'item',chain:'rice',level:1};
  const order={items:[{chain:'rice',level:1},{chain:'rice',level:1}]};
  assert.equal(api.canComplete(order),false);
  api.state.board[1]={type:'item',chain:'rice',level:1};
  assert.equal(api.canComplete(order),true);
  assert.equal(api.canMergePieces({type:'item',chain:'rice',level:5},{type:'item',chain:'rice',level:5}),false);
  api.findMerge();assert.equal(api.selected,0);
});

test('sale undo and one-time discoveries preserve the economy', () => {
  const {api,play}=boot();play();
  api.state.board[0]={type:'item',chain:'grill',level:3};
  api.select(0);const coins=api.state.coins;
  api.sellSelected();assert.equal(api.state.coins,coins+4);
  api.sellSelected();assert.equal(api.state.coins,coins);assert.equal(api.state.board[0].level,3);
  api.discover({type:'item',chain:'rice',level:4});assert.equal(api.state.coins,coins+50);
  api.discover({type:'item',chain:'rice',level:4});assert.equal(api.state.coins,coins+50);
});

test('old workshop seats now improve payouts; supply and stove levels remain purchasable', () => {
  const {api}=boot();api.state.coins=2000;
  const reward=api.orderReward(api.state.orders[0]);
  api.buyUpgrade('service');
  assert.equal(api.state.upgrades.service,1);
  assert.equal(api.orderReward(api.state.orders[0]),Math.round(reward*1.05));
  api.buyUpgrade('stove');assert.equal(api.state.upgrades.stove,1);
  api.buyUpgrade('supply');assert.equal(api.state.upgrades.supply,1);
});

test('full-board production neither overwrites food nor loses unlocks', () => {
  const {api,play}=boot();play();
  api.state.board=api.state.board.map(p=>p||{type:'item',chain:'rice',level:0});
  const before=JSON.stringify(api.state.board), coins=api.state.coins;
  const generator=api.state.board.findIndex(p=>p.type==='generator');
  api.produce(generator);
  assert.equal(JSON.stringify(api.state.board),before);assert.equal(api.state.coins,coins);
  api.state.teaUnlocked=true;api.ensureProducers();
  api.state.board[0]=null;api.ensureProducers();
  assert.equal(api.state.board[0].chain,'sweet');
});
