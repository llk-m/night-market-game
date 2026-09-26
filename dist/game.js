(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const COLS = 7;
  const ROWS = 8;
  const SAVE_KEY = "nightMarketMergeSave_cozy_v1";
  const OLD_SAVE_KEYS = ["nightMarketMergeSave_v3", "nightMarketMergeSave_v2", "nightMarketMergeSave_v1"];
  const shopDefs = [
    {name:"街角小摊", orders:0, cost:0, unlock:"米食、面点、烧烤，从一张小食单开始"},
    {name:"灯下食铺", orders:8, cost:280, unlock:"换上暖色棚顶，解锁三级菜品订单与新常客"},
    {name:"巷口茶食", orders:22, cost:700, unlock:"解锁茶饮铺和甜品菜系"},
    {name:"邻里小馆", orders:45, cost:1400, unlock:"添上窗台，解锁四级菜品订单"},
    {name:"花间食堂", orders:80, cost:2400, unlock:"解锁花架和新的常客"},
    {name:"庭院餐馆", orders:130, cost:3800, unlock:"扩建庭院，解锁五级招牌菜订单"},
    {name:"长街名店", orders:200, cost:5800, unlock:"解锁庭院灯串和夜市招牌"},
    {name:"烟火老字号", orders:300, cost:9000, unlock:"解锁最高级宴席订单与纪念装饰"},
    {name:"四季食府", orders:430, cost:14000, unlock:"四季灯火，让小店成为街坊的回忆"},
    {name:"夜市地标", orders:600, cost:21000, unlock:"最高店铺等级，仍可持续经营、收集菜谱和培养常客"},
  ];
  const decorDefs = {
    lantern: {name:"小红灯笼", icon:"🏮", level:1, cost:120},
    plant: {name:"窗边绿植", icon:"🪴", level:2, cost:220},
    cat: {name:"招财小猫", icon:"🐈", level:3, cost:380},
    flowers: {name:"四季花架", icon:"🌸", level:5, cost:650},
    tea: {name:"庭院茶桌", icon:"🍵", level:6, cost:950},
    lights: {name:"长街灯串", icon:"✨", level:7, cost:1400},
    trophy: {name:"老字号牌匾", icon:"🏆", level:8, cost:2000},
    moon: {name:"月下庭灯", icon:"🌙", level:9, cost:2800},
  };
  const regularDefs = [
    {name:"林奶奶", icon:"👵", chain:"rice", level:1, line:"热乎乎的饭菜，慢慢做就好。"},
    {name:"阿远", icon:"🧑", chain:"noodle", level:2, line:"下班后来碗面，今天也辛苦了。"},
    {name:"小桃", icon:"👩", chain:"sweet", level:3, line:"想喝你家的茶，也想看小店长大。"},
    {name:"老周", icon:"👨", chain:"grill", level:5, line:"闻着炭火香就过来了！"},
  ];

  const chains = {
    rice: [
      { name: "稻米", emoji: "🌾", color: "#f4d77c" },
      { name: "饭团", emoji: "🍙", color: "#f4eee1" },
      { name: "热粥", emoji: "🥣", color: "#f5c782" },
      { name: "黄金炒饭", emoji: "🍚", color: "#edb849" },
      { name: "招牌便当", emoji: "🍱", color: "#db765b" },
      { name: "海鲜御膳", emoji: "🦞", color: "#d94842" },
    ],
    noodle: [
      { name: "面粉", emoji: "🫘", color: "#e7c98e" },
      { name: "面团", emoji: "🥟", color: "#f4dfb3" },
      { name: "阳春面", emoji: "🍜", color: "#efb34f" },
      { name: "云吞面", emoji: "🥡", color: "#e58543" },
      { name: "海鲜拉面", emoji: "🍲", color: "#e35f48" },
      { name: "龙王面宴", emoji: "🐉", color: "#c8413c" },
    ],
    grill: [
      { name: "鲜肉", emoji: "🥩", color: "#df776d" },
      { name: "肉串", emoji: "🍢", color: "#e58b52" },
      { name: "炭烤串", emoji: "🍡", color: "#d66a42" },
      { name: "香辣烤肉", emoji: "🍖", color: "#b94a35" },
      { name: "烤全鸡", emoji: "🍗", color: "#c97b34" },
      { name: "夜市烧烤王", emoji: "🔥", color: "#e84632" },
    ],
    sweet: [
      { name: "茶叶", emoji: "🍃", color: "#72b978" },
      { name: "清茶", emoji: "🍵", color: "#83c68d" },
      { name: "珍珠奶茶", emoji: "🧋", color: "#b98065" },
      { name: "甜点拼盘", emoji: "🍰", color: "#e582a2" },
      { name: "冰淇淋塔", emoji: "🍨", color: "#cf8ec9" },
      { name: "月宫甜宴", emoji: "🌙", color: "#9177ce" },
    ],
  };

  const generatorDefs = {
    rice: { name: "蒸笼铺", emoji: "🧺", colorA: "#ef6750", colorB: "#9f3030" },
    noodle: { name: "面点铺", emoji: "🥢", colorA: "#e09a3d", colorB: "#9b5528" },
    grill: { name: "烧烤炉", emoji: "♨️", colorA: "#d74e45", colorB: "#762a31" },
    sweet: { name: "茶饮铺", emoji: "🫖", colorA: "#5b9d78", colorB: "#286355" },
  };

  const $ = (id) => document.getElementById(id);
  let state;
  let geom = {};
  let drag = null;
  let particles = [];
  let toastTimer;
  const audio = new window.NightMarketAudio();
  let lastTime = performance.now();
  let saveClock = 0;
  let selectedCell = -1;
  let trackedOrder = null;
  let hintedCells = [];
  let hintTime = 0;
  let undoSale = null;
  const upgradeDefs = {
    stove: { name: "高效炉灶", text: "每级缩短 10% 备料时间", cost: 180 },
    service: { name: "舒适座席", text: "每级让订单收入增加 5%", cost: 160 },
    supply: { name: "精选原料", text: "每级增加 5% 直接产出二级食材的概率", cost: 140 },
  };

  function normalizeProgress() {
    state.upgrades ||= {stove:0, service:0, supply:0};
    for (const key of Object.keys(upgradeDefs)) state.upgrades[key] = Math.max(0, Math.min(3, Number(state.upgrades[key]) || 0));
    state.discovered ||= {};
    state.elapsed ||= 0;
    state.merges ||= 0;
    state.effectsOn ??= state.musicOn !== false;
    state.musicOn ??= true;
    state.musicVolume = Number.isFinite(state.musicVolume) ? Math.max(0, Math.min(1, state.musicVolume)) : .55;
    state.shopLevel = Math.max(1, Math.min(shopDefs.length, Math.floor(state.shopLevel || 1)));
    state.decorations ||= {};
    state.regulars ||= {};
    if (state.mode !== "cozy") {
      const legacyCompleted = Object.entries(state.stageWins || {}).reduce((sum, [stage, rounds]) => sum + rounds * ({1:6,2:7,3:8}[stage] || 6), 0) + (state.served || 0);
      state.totalOrders = Math.max(0, state.totalServed || 0, legacyCompleted);
      state.mode = "cozy";
      state.teaUnlocked = state.level >= 3 || state.board.some(p => p?.type === "generator" && p.chain === "sweet");
      state.board = state.board.map(p => p?.type === "trash" ? null : p);
      state.gameOver = false;
      state.offers = [];
      state.perks = [];
    }
    state.totalOrders ||= 0;
    state.teaUnlocked ||= state.shopLevel >= 3;
    state.board.forEach(p => {
      if (p?.type === "item") {
        p.level = Math.max(0, Math.min(p.level, 5));
        state.discovered[`${p.chain}:${p.level}`] = true;
      }
    });
  }

  function activePlay() {
    return state.introduced && !document.hidden &&
      $("homeScreen").classList.contains("hidden") && !document.querySelector("dialog[open]");
  }

  function currentShop() { return shopDefs[state.shopLevel - 1]; }
  function nextShop() { return shopDefs[state.shopLevel]; }
  function expansionReady() {
    const next = nextShop();
    return Boolean(next && state.totalOrders >= next.orders && state.coins >= next.cost);
  }


  function discover(piece) {
    if (piece?.type !== "item") return;
    const key = `${piece.chain}:${piece.level}`;
    if (state.discovered[key]) return;
    state.discovered[key] = true;
    const bonus = (piece.level + 1) * 10;
    state.coins += bonus;
    showToast(`新菜谱：${chains[piece.chain][piece.level].name} · 收藏奖励 +${bonus}`);
  }

  function ensureProducers() {
    for (const chain of ["rice", "noodle", "grill", ...(state.teaUnlocked ? ["sweet"] : [])]) {
      if (state.board.some(p => p?.type === "generator" && p.chain === chain)) continue;
      const open = state.board.findIndex(p => !p);
      if (open >= 0) state.board[open] = { type: "generator", chain, cooldown: 0 };
    }
  }

  function expandShop() {
    if (!expansionReady()) return;
    const next = nextShop();
    state.coins -= next.cost;
    state.shopLevel++;
    state.teaUnlocked ||= state.shopLevel >= 3;
    afterChange();
    $("growthNotice").textContent = `扩建完成！${next.name} · ${next.unlock}`;
    softTick(880);
  }

  function buyDecoration(key) {
    const def = decorDefs[key];
    if (!def || state.decorations[key] || state.shopLevel < def.level || state.coins < def.cost) return;
    state.coins -= def.cost;
    state.decorations[key] = true;
    afterChange();
    $("growthNotice").textContent = `已摆放「${def.name}」，回到首页看看你的小店。`;
    softTick(620);
  }

  function swapOrder() {
    if (!activePlay()) return;
    let i = state.orders.findIndex(order => order.id === trackedOrder);
    if (i < 0) i = 0;
    if (canComplete(state.orders[i])) { showToast("这份已经做好了，先交单领金币吧"); return; }
    state.orders[i] = makeOrder(0, 0, i);
    trackedOrder = state.orders[i].id;
    afterChange();
    showToast("已免费更换选中的订单，不扣金币和成长进度");
  }

  function freshState() {
    const board = Array(COLS * ROWS).fill(null);
    board[index(1, 5)] = { type: "generator", chain: "rice" };
    board[index(3, 5)] = { type: "generator", chain: "noodle" };
    board[index(5, 5)] = { type: "generator", chain: "grill" };
    board[index(1, 7)] = { type: "item", chain: "rice", level: 0 };
    board[index(2, 7)] = { type: "item", chain: "rice", level: 0 };
    board[index(4, 7)] = { type: "item", chain: "noodle", level: 0 };
    board[index(5, 7)] = { type: "item", chain: "grill", level: 0 };
    return {
      board, coins:80, level:1, xp:0, introduced:false,
      orders:[], musicOn:true, shopLevel:1, totalOrders:0,
      mode:"cozy", decorations:{}, regulars:{}, teaUnlocked:false,
    };
  }

  function load() {
    for (const key of [SAVE_KEY, ...OLD_SAVE_KEYS]) {
      try {
        const raw = localStorage.getItem(key);
        const saved = JSON.parse(raw);
        if (!saved || !Array.isArray(saved.board) || saved.board.length !== COLS * ROWS) continue;
        saved.board = saved.board.map(p => p && !p.chain && ["item","generator"].includes(p.type) ? {...p, chain:"rice"} : p);
        // The old key is retained untouched as a rollback copy.
        return saved;
      } catch (_) {}
    }
    return freshState();
  }


  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch (_) { $("homeTip").textContent = "浏览器未能保存进度，请保留当前页面。"; }
  }

  function index(c, r) { return r * COLS + c; }
  function cellOf(i) { return { c: i % COLS, r: Math.floor(i / COLS) }; }

  function makeOrder(_level, _shift, slot = 0) {
    const available = [...new Set((state?.board || []).filter(p => p?.type === "generator").map(p => p.chain))];
    const pool = available.length ? available : ["rice", "noodle", "grill"];
    const rank = state?.shopLevel || 1;
    const maxLevel = rank >= 8 ? 5 : rank >= 6 ? 4 : rank >= 4 ? 3 : rank >= 2 ? 2 : 1;
    // Keep one quick order even in the late game; the third slot is a larger menu.
    const cap = slot === 0 ? Math.min(2, maxLevel) : maxLevel;
    const count = slot === 2 && rank >= 2 ? 2 : 1;
    const visitors = regularDefs.map((person, i) => person.level <= rank && pool.includes(person.chain) ? i : -1).filter(i => i >= 0);
    const customer = visitors.length && slot === 1 && state?.totalOrders > 0 ? visitors[((state.totalOrders || 0) + slot) % visitors.length] : -1;
    const items = Array.from({length:count}, (_, n) => ({
      chain: n === 0 && customer >= 0 ? regularDefs[customer].chain : pool[(slot + n + (state?.totalOrders || 0)) % pool.length],
      level: 1 + Math.floor(Math.random() * cap),
    }));
    // First orders teach all three producers; regulars join after the first delivery.
    if (!(state?.totalOrders || 0)) items[0].chain = pool[slot % pool.length];
    const work = items.reduce((sum, item) => sum + 2 ** item.level, 0);
    const reward = Math.round(24 + work * 10 + count * 8);
    return {id:`${Date.now()}-${slot}-${Math.random()}`, items, reward, customer};
  }

  function makeOrders() {
    return Array.from({length:3}, (_, i) => makeOrder(0, 0, i));
  }

  function orderReward(order) {
    return Math.round(order.reward * (1 + state.upgrades.service * .05));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 8;
    const cell = Math.min((rect.width - pad * 2) / COLS, (rect.height - pad * 2) / ROWS);
    geom = { w: rect.width, h: rect.height, cell, x: (rect.width - cell * COLS) / 2, y: (rect.height - cell * ROWS) / 2 };
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawBoard() {
    ctx.clearRect(0, 0, geom.w, geom.h);
    const bw = geom.cell * COLS;
    const bh = geom.cell * ROWS;
    const grd = ctx.createLinearGradient(0, geom.y, 0, geom.y + bh);
    grd.addColorStop(0, "#286461");
    grd.addColorStop(1, "#103f43");
    roundedRect(geom.x - 5, geom.y - 5, bw + 10, bh + 10, 22);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = "#be975d";
    ctx.lineWidth = 3;
    ctx.stroke();
    roundedRect(geom.x - 1, geom.y - 1, bw + 2, bh + 2, 18);
    ctx.strokeStyle = "#efd8a633"; ctx.lineWidth = 1; ctx.stroke();

    const tracked = state.orders.find(order => order.id === trackedOrder);
    const neededChains = tracked ? orderInventory(tracked).filter(item => !item.ready).map(item => item.chain) : [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = index(c, r);
        const x = geom.x + c * geom.cell;
        const y = geom.y + r * geom.cell;
        const gap = 3;
        roundedRect(x + gap, y + gap, geom.cell - gap * 2, geom.cell - gap * 2, Math.max(7, geom.cell * .14));
        const even = (r + c) % 2 === 0;
        ctx.fillStyle = even ? "rgba(180,219,190,.12)" : "rgba(4,31,35,.21)";
        ctx.fill();
        ctx.strokeStyle = "rgba(209,235,193,.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (i === selectedCell) {
          ctx.strokeStyle = "#fff29d"; ctx.lineWidth = 3; ctx.stroke();
        }
        const piece = state.board[i];
        const selected = state.board[selectedCell];
        if ((i !== selectedCell && canMergePieces(selected, piece)) || (hintTime > 0 && hintedCells.includes(i))) {
          ctx.strokeStyle = "#ffce64"; ctx.lineWidth = 2.5; ctx.stroke();
        } else if (piece?.type === "generator" && neededChains.includes(piece.chain)) {
          ctx.strokeStyle = "#7ee5e2"; ctx.lineWidth = 2.5; ctx.stroke();
        }
        if (state.board[i] && (!drag || drag.from !== i)) drawPiece(state.board[i], x + geom.cell / 2, y + geom.cell / 2, geom.cell, 1);
      }
    }

    if (drag) drawPiece(drag.piece, drag.x, drag.y, geom.cell, 1.14);
    drawParticles();
  }

  function drawPiece(piece, cx, cy, size, scale) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    const s = size * .79;
    ctx.shadowColor = "rgba(0,0,0,.38)";
    ctx.shadowBlur = size * .12;
    ctx.shadowOffsetY = size * .07;
    roundedRect(-s / 2, -s / 2, s, s, size * .18);
    if (piece.type === "generator") {
      const gen = generatorDefs[piece.chain] || generatorDefs.rice;
      const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
      g.addColorStop(0, gen.colorA); g.addColorStop(1, gen.colorB);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#ffd27a"; ctx.lineWidth = Math.max(2, size * .035); ctx.stroke();
      ctx.font = `${size * .4}px "Apple Color Emoji", "Segoe UI Emoji", serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(gen.emoji, 0, -size * .04);
      ctx.fillStyle = "#ffd86c";
      ctx.beginPath(); ctx.arc(s * .3, -s * .3, size * .115, 0, Math.PI * 2); ctx.fill();
      ctx.font = `900 ${size * .16}px system-ui`;
      ctx.fillStyle = "#693022"; ctx.fillText("火", s * .3, -s * .3 + 1);
      ctx.fillStyle = "#fff5cf";
      ctx.font = `800 ${Math.max(8, size * .11)}px "Microsoft YaHei", sans-serif`;
      ctx.shadowColor = "#001"; ctx.shadowBlur = 3;
      ctx.fillText(gen.name, 0, size * .31);
      if ((piece.cooldown || 0) > 0) {
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "rgba(3,18,23,.73)";
        roundedRect(-s / 2, -s / 2, s, s, size * .18);
        ctx.fill();
        ctx.fillStyle = "#ffe083";
        ctx.font = `900 ${size * .23}px system-ui`;
        ctx.fillText(`${piece.cooldown.toFixed(1)}s`, 0, 0);
      }
    } else if (piece.type === "trash") {
      ctx.fillStyle = "#31434a"; ctx.fill();
      ctx.strokeStyle = "#789096"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.font = `${size * .44}px "Apple Color Emoji", "Segoe UI Emoji"`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🗑️", 0, -size * .04);
      ctx.fillStyle = "#ffd078";
      ctx.font = `800 ${Math.max(8, size * .11)}px sans-serif`;
      ctx.fillText("免费清理", 0, size * .31);
    } else if (piece.type === "wild") {
      const g = ctx.createRadialGradient(-s * .15, -s * .2, 1, 0, 0, s * .72);
      g.addColorStop(0, "#fff5a8"); g.addColorStop(1, "#8b4cc5");
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "#fff3a6"; ctx.lineWidth = 2; ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.font = `${size * .46}px "Apple Color Emoji", "Segoe UI Emoji"`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("✨", 0, -size * .05);
      ctx.fillStyle = "#fff8d5";
      ctx.font = `800 ${Math.max(8, size * .11)}px sans-serif`;
      ctx.fillText(`百搭酱 L${piece.level + 1}`, 0, size * .31);
    } else {
      const def = chains[piece.chain]?.[piece.level] || chains.rice[0];
      const g = ctx.createRadialGradient(-s * .15, -s * .2, 1, 0, 0, s * .72);
      g.addColorStop(0, `${def.color}ee`); g.addColorStop(1, "#173f42");
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(255,238,176,.56)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = `${size * .49}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(def.emoji, 0, -size * .025);
      ctx.fillStyle = "#fff7d8";
      ctx.font = `800 ${Math.max(9, size * .12)}px "Microsoft YaHei", sans-serif`;
      ctx.shadowColor = "#001"; ctx.shadowBlur = 3;
      ctx.fillText(def.name, 0, size * .31);
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#092d35";
      ctx.beginPath(); ctx.arc(-s * .33, -s * .33, size * .1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe4a2";
      ctx.font = `800 ${Math.max(8, size * .13)}px system-ui`;
      ctx.fillText(piece.level + 1, -s * .33, -s * .33 + .5);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function burstAt(i, color = "#ffd76b") {
    const { c, r } = cellOf(i);
    const x = geom.x + (c + .5) * geom.cell;
    const y = geom.y + (r + .5) * geom.cell;
    for (let n = 0; n < 12; n++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 55;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 18, life: 1, size: 2 + Math.random() * 3, color });
    }
  }

  function animate(t) {
    const dt = Math.min(.25, (t - lastTime) / 1000);
    lastTime = t;
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 70 * dt; p.life -= 1.7 * dt; });
    particles = particles.filter(p => p.life > 0);
    updateTimers(dt);
    if (!document.hidden && $("homeScreen").classList.contains("hidden")) drawBoard();
    requestAnimationFrame(animate);
  }

  function updateTimers(dt) {
    if (!activePlay()) return;
    state.elapsed += dt;
    hintTime = Math.max(0, hintTime - dt);
    state.board.forEach(p => {
      if (p?.type === "generator" && p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
    });
    saveClock += dt;
    if (saveClock >= 5) { saveClock = 0; save(); }
  }

  function point(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitCell(x, y) {
    const c = Math.floor((x - geom.x) / geom.cell);
    const r = Math.floor((y - geom.y) / geom.cell);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS ? index(c, r) : -1;
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!activePlay() || drag) return;
    const p = point(e);
    const i = hitCell(p.x, p.y);
    if (i < 0) return;
    const previousSelection = selectedCell;
    if (!state.board[i]) {
      if (state.board[selectedCell] && ["item", "wild"].includes(state.board[selectedCell].type)) movePiece(selectedCell, i);
      return;
    }
    selectedCell = i;
    renderTools();
    canvas.setPointerCapture(e.pointerId);
    drag = { from: i, piece: state.board[i], x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, previousSelection, pointerId: e.pointerId };
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const p = point(e);
    drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) drag.moved = true;
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const p = point(e);
    const target = hitCell(p.x, p.y);
    const source = drag.from;
    const piece = drag.piece;
    const moved = drag.moved;
    const previousSelection = drag.previousSelection;
    drag = null;
    if (!activePlay()) return;
    if (!moved && piece.type === "trash") {
      state.board[source] = null;
      burstAt(source, "#9ad8cf");
      showToast("垃圾清理完毕");
      afterChange();
      return;
    }
    if (!moved && piece.type === "generator") {
      produce(source);
      return;
    }
    if (!moved) {
      if (previousSelection !== source && canMergePieces(state.board[previousSelection], piece)) movePiece(previousSelection, source);
      return;
    }
    movePiece(source, target);
  });

  function movePiece(source, target) {
    if (!activePlay() || target < 0 || target >= state.board.length || target === source) return;
    const piece = state.board[source];
    if (!piece) return;
    const there = state.board[target];
    if (!there) {
      state.board[target] = piece; state.board[source] = null;
      softTick(300);
    } else if (canMergePieces(piece, there)) {
      const base = piece.type === "item" ? piece : there;
      if (base.level >= chains[base.chain].length - 1) { showToast("已经是这条菜系的招牌美食啦"); return; }
      state.board[source] = null;
      state.board[target] = { type: "item", chain: base.chain, level: base.level + 1 };
      selectedCell = target;
      state.merges++;
      burstAt(target);
      softTick(620);
      discover(state.board[target]);

    } else {
      state.board[source] = there; state.board[target] = piece;
      softTick(240);
    }
    selectedCell = target;
    afterChange();
  }

  canvas.addEventListener("pointercancel", () => { drag = null; });

  function canMergePieces(a, b) {
    if (!a || !b || a.level >= 5 || b.level >= 5) return false;
    if (a.type === "item" && b.type === "item") return a.chain === b.chain && a.level === b.level;
    if (a.type === "wild" && b.type === "item") return a.level === b.level;
    if (a.type === "item" && b.type === "wild") return a.level === b.level;
    return false;
  }



  function produce(generatorIndex) {
    const generator = state.board[generatorIndex];
    if (!activePlay() || generator?.type !== "generator") return;
    if ((generator.cooldown || 0) > 0) { showToast(`摊位备料中，还要 ${generator.cooldown.toFixed(1)} 秒`); softTick(110); return; }
    const empties = state.board.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    if (!empties.length) { showToast("棋盘满了，先合成或完成订单吧"); return; }
    const { c: gc, r: gr } = cellOf(generatorIndex);
    empties.sort((a, b) => {
      const aa = cellOf(a), bb = cellOf(b);
      return Math.abs(aa.c - gc) + Math.abs(aa.r - gr) - Math.abs(bb.c - gc) - Math.abs(bb.r - gr);
    });
    const target = empties[0];
    const level = Math.random() < .08 + state.upgrades.supply * .05 ? 1 : 0;
    state.board[target] = { type: "item", chain: generator.chain, level };
    generator.cooldown = .55 * (1 - state.upgrades.stove * .1);
    discover(state.board[target]);
    burstAt(target, "#ff9f57");
    softTick(440);
    afterChange();
  }

  function canComplete(order) {
    return orderInventory(order).every(item => item.ready);
  }

  function orderInventory(order) {
    const counts = {};
    state.board.forEach(p => {
      if (p?.type === "item") {
        const key = `${p.chain}:${p.level}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return order.items.map(item => ({ ...item, ready: counts[`${item.chain}:${item.level}`]-- > 0 }));
  }



  function findMerge() {
    if (!activePlay()) return;
    for (let i = 0; i < state.board.length; i++) {
      for (let j = i + 1; j < state.board.length; j++) {
        if (!canMergePieces(state.board[i], state.board[j])) continue;
        selectedCell = i;
        hintedCells = [i, j];
        hintTime = 4;
        renderTools();
        showToast("已选中第一份，点另一个金色格子合成");
        return;
      }
    }
    showToast("还没有可合成的一对，点击蓝色摊位继续备菜");
  }

  function renderGuidance() {
    if (!state.orders.some(order => order.id === trackedOrder)) {
      trackedOrder = state.orders.find(canComplete)?.id || state.orders[0]?.id;
    }
    const order = state.orders.find(order => order.id === trackedOrder);
    if (!order) return;
    const missing = orderInventory(order).filter(item => !item.ready);
    if (!missing.length) {
      $("orderHint").textContent = "✓ 追踪订单已备齐，点击对应订单立即出餐！";
    } else {
      const item = missing[0];
      const available = state.board.filter(p => p?.type === "item" && p.chain === item.chain && p.level < item.level)
        .reduce((sum, p) => sum + 2 ** p.level, 0);
      const deficit = Math.max(0, 2 ** item.level - available);
      $("orderHint").textContent = `${generatorDefs[item.chain].emoji} ${generatorDefs[item.chain].name} → ${chains[item.chain][item.level].name} · ${deficit ? `约缺 ${deficit} 份基础食材` : "材料够了，合成即可"}`;
    }
    const free = state.board.filter(p => !p).length;
    $("spaceCopy").textContent = `空位 ${free}`;
    $("spaceCopy").classList.toggle("low-space", free < 7);
    const next = nextShop();
    $("shiftBar").style.width = `${next ? Math.min(100, state.totalOrders / next.orders * 100) : 100}%`;
  }

  function fulfill(orderIndex) {
    if (!activePlay()) return;
    const order = state.orders[orderIndex];
    if (!order) return;
    if (!canComplete(order)) {
      trackedOrder = order.id;
      renderUI();
      showToast("已追踪订单，按蓝色摊位的备菜路线制作");
      return;
    }
    order.items.forEach(item => {
      const i = state.board.findIndex(p => p?.type === "item" && p.chain === item.chain && p.level === item.level);
      state.board[i] = null;
      burstAt(i, "#7df1a4");
    });
    const earned = orderReward(order);
    state.coins += earned;
    state.totalOrders++;
    state.totalServed = state.totalOrders;
    let message = `上菜啦！+${earned} 金币 · 累计招待 ${state.totalOrders} 位食客`;
    const person = regularDefs[order.customer];
    if (person) {
      state.regulars[order.customer] = (state.regulars[order.customer] || 0) + 1;
      if (state.regulars[order.customer] % 5 === 0) {
        state.coins += 80;
        message = `${person.name}送来谢礼 +80 金币：“${person.line}”`;
      }
    }
    if (state.totalOrders % 10 === 0) {
      state.coins += 120;
      message += " · 十单心意 +120";
    }
    state.orders[orderIndex] = makeOrder(0, 0, orderIndex);
    showToast(message);
    softTick(760);
    afterChange();
  }


  function afterChange(keepSale = false) {
    if (!keepSale) undoSale = null;
    ensureProducers();
    renderUI();
    save();
  }

  function renderUI() {
    const atHome = !$("homeScreen").classList.contains("hidden");
    $("gameShell").classList.toggle("at-home", atHome);
    document.querySelectorAll(".game-shell > header, .game-shell > .orders-wrap, .game-shell > .board-wrap, .game-shell > .tool-tray, .game-shell > footer").forEach(el => { el.inert = atHome; });
    $("coinValue").textContent = state.coins;
    $("levelValue").textContent = state.shopLevel;
    $("shiftValue").textContent = "不催单 · 慢慢做";
    $("homeLevel").textContent = state.shopLevel;
    $("homeCoins").textContent = state.coins;
    $("homeServed").textContent = state.totalOrders;
    $("homeProgress").textContent = `${currentShop().name} · 已招待 ${state.totalOrders} 位食客`;
    $("startGameBtn").querySelector("span").textContent = state.introduced ? "去小店做菜" : "开张，做第一道菜";
    $("homeGreeting").textContent = "不用赶时间，小店会陪你慢慢长大";
    $("shopName").textContent = currentShop().name;
    $("shopScene").dataset.rank = String(state.shopLevel);
    $("shopScene").classList.toggle("has-windows", state.shopLevel >= 4);
    $("shopScene").classList.toggle("has-courtyard", state.shopLevel >= 6);
    $("shopDecor").innerHTML = Object.entries(decorDefs).filter(([key]) => state.decorations[key])
      .map(([,def]) => `<span title="${def.name}" aria-label="${def.name}">${def.icon}</span>`).join("");
    $("shopDecor").classList.toggle("empty", !Object.keys(state.decorations).length);
    const next = nextShop();
    $("growthGoal").textContent = next ? `下一步：${next.name}` : "夜市地标 · 把小店经营成回忆";
    $("growthCopy").textContent = next ? `累计招待 ${Math.min(state.totalOrders,next.orders)}/${next.orders} 位食客 · 扩建 ${next.cost} 金币` : `已招待 ${state.totalOrders} 位食客，菜谱和常客故事继续积累。`;
    $("growthBar").style.width = `${next ? Math.min(100,state.totalOrders / next.orders * 100) : 100}%`;
    $("openGrowthBtn").textContent = expansionReady() ? "可以扩建啦 →" : "查看成长与装修 →";
    $("openGrowthBtn").classList.toggle("can-expand", expansionReady());
    $("xpCopy").textContent = next ? `${Math.min(state.totalOrders,next.orders)} / ${next.orders} 位` : `${state.totalOrders} 位`;
    $("xpBar").style.width = `${next ? Math.min(100,state.totalOrders / next.orders * 100) : 100}%`;
    syncSoundUI();
    renderTools();
    renderGuidance();
    renderGrowth();

    const orders = $("orders");
    orders.innerHTML = "";
    state.orders.forEach((order, i) => {
      const ready = canComplete(order);
      const btn = document.createElement("button");
      btn.className = `order-card${ready ? " ready" : ""}${order.id === trackedOrder ? " tracked" : ""}`;
      const names = order.items.map(item => chains[item.chain][item.level].name);
      const person = regularDefs[order.customer];
      btn.setAttribute("aria-label", `${person?.name || "街坊"}：${names.join("、")}，奖励${orderReward(order)}金币${ready ? "，可以交付" : "，不限时"}`);
      btn.innerHTML = `<div class="customer-name">${person?.icon || "🙂"} ${person?.name || "街坊"}</div><span class="order-check">✓</span><div class="order-items">${orderInventory(order).map(item => { const def = chains[item.chain][item.level]; return `<span class="${item.ready ? "ingredient-ready" : ""}" title="${def.name}">${def.emoji}<small>${item.ready ? "✓ " : ""}${def.name}</small></span>`; }).join("")}</div><div class="order-reward"><span>●</span>${orderReward(order)}</div><div class="order-action">${ready ? "做好了，交给食客" : order.id === trackedOrder ? "正在备菜" : "点我看做法"}</div>`;

      btn.addEventListener("click", () => fulfill(i));
      orders.appendChild(btn);
    });
  }

  function renderGrowth() {
    const next = nextShop();
    $("growthWallet").textContent = `持有 ${state.coins} 金币 · 店铺 Lv.${state.shopLevel}`;
    $("expansionName").textContent = next ? `扩建为「${next.name}」` : "你的小店已成为夜市地标";
    $("expansionDesc").textContent = next?.unlock || "没有强制结局，继续招待食客、装点小店、收集所有菜谱。";
    $("expansionRequirements").textContent = next ? `食客 ${state.totalOrders}/${next.orders} 位 · 金币 ${state.coins}/${next.cost}` : `累计招待 ${state.totalOrders} 位食客`;
    $("expandBtn").disabled = !expansionReady();
    $("expandBtn").textContent = !next ? "店铺已满级，继续经营" : expansionReady() ? `花 ${next.cost} 金币扩建` : state.totalOrders < next.orders ? `再招待 ${next.orders-state.totalOrders} 位食客` : `还差 ${next.cost-state.coins} 金币`;
    $("growthRoad").innerHTML = shopDefs.map((shop,i) => `<li class="${i+1 <= state.shopLevel ? "reached" : ""}"><b>${i+1}. ${shop.name}</b><small>${i+1 === state.shopLevel ? "现在的小店" : i+1 < state.shopLevel ? "已完成" : `${shop.orders} 位食客 · ${shop.cost} 金币`}</small></li>`).join("");
    $("decorationList").innerHTML = Object.entries(decorDefs).map(([key,def]) => {
      const owned = state.decorations[key], locked = state.shopLevel < def.level;
      return `<button data-decor="${key}" ${owned || locked || state.coins < def.cost ? "disabled" : ""}><span>${def.icon}</span><b>${def.name}</b><small>${owned ? "已摆放" : locked ? `店铺 Lv.${def.level} 解锁` : `${def.cost} 金币`}</small></button>`;
    }).join("");
    $("decorationList").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => buyDecoration(btn.dataset.decor)));
    $("regularList").innerHTML = regularDefs.map((person,i) => {
      const visits = state.regulars[i] || 0, unlocked = state.shopLevel >= person.level;
      return `<section class="regular-card"><span>${person.icon}</span><div><b>${person.name}</b><small>${unlocked ? `已招待 ${visits} 次 · 每 5 次送 80 金币谢礼` : `店铺 Lv.${person.level} 来访`}</small><p>${unlocked ? person.line : "期待与你的小店相遇"}</p><em>${"♥".repeat(Math.min(5,Math.floor(visits/5)))}${"♡".repeat(5-Math.min(5,Math.floor(visits/5)))}</em></div></section>`;
    }).join("");
  }

  function openGrowth() {
    $("growthNotice").textContent = "";
    renderGrowth();
    $("growthDialog").showModal();
  }

  function renderTools() {
    const piece = state.board[selectedCell];
    $("selectionInfo").textContent = piece?.type === "item" ? `${chains[piece.chain][piece.level].name} · L${piece.level + 1} · 点金色同类合成 / 点空格移动` : piece?.type === "wild" ? `百搭酱 L${piece.level + 1} · 点同等级食材合成` : "点订单看路线 · 点两份相同食材合成";
    $("sellBtn").disabled = (!undoSale && piece?.type !== "item") || !activePlay();
    $("sellBtn").textContent = undoSale ? "撤销出售" : piece?.type === "item" ? `出售 +${piece.level + 1}` : "出售";
    $("skipBtn").textContent = "免费换单";
    $("skipBtn").disabled = !activePlay();
    $("hintBtn").disabled = !activePlay();
    const next = nextShop();
    $("runSummary").textContent = next ? `扩建目标 · 食客 ${Math.min(state.totalOrders,next.orders)}/${next.orders}` : `累计招待 ${state.totalOrders} 位食客`;
    $("perkSummary").textContent = expansionReady() ? "回小店就能扩建啦" : `每 10 单送心意 · ${state.totalOrders % 10}/10`;
  }

  function sellSelected() {
    if (!activePlay()) return;
    if (undoSale) {
      const { index: slot, piece, coins } = undoSale;
      if (!state.board[slot] && state.coins >= coins) {
        state.board[slot] = piece;
        state.coins -= coins;
        selectedCell = slot;
        afterChange();
        showToast("已撤销出售");
      }
      return;
    }
    const piece = state.board[selectedCell];
    if (!activePlay() || piece?.type !== "item") return;
    state.coins += piece.level + 1;
    undoSale = { index: selectedCell, piece: { ...piece }, coins: piece.level + 1 };
    state.board[selectedCell] = null;
    afterChange(true);
    showToast("已出售，下一次棋盘操作前可以撤销");
  }



  function renderWorkshop() {
    $("workshopCoins").textContent = `持有 ${state.coins} 金币 · 永久生效，最高 3 级`;
    $("upgradeList").innerHTML = Object.entries(upgradeDefs).map(([key, def]) => {
      const level = state.upgrades[key], cost = def.cost * (level + 1);
      return `<button data-upgrade="${key}" ${level >= 3 || state.coins < cost ? "disabled" : ""}><b>${def.name} · Lv.${level}</b><small>${def.text}</small><strong>${level >= 3 ? "已满级" : `${cost} 金币升级`}</strong></button>`;
    }).join("");
    $("upgradeList").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => buyUpgrade(btn.dataset.upgrade)));
  }

  function buyUpgrade(key) {
    const def = upgradeDefs[key];
    if (!def) return;
    const cost = def.cost * (state.upgrades[key] + 1);
    if (state.upgrades[key] >= 3 || state.coins < cost) return;
    state.coins -= cost;
    state.upgrades[key]++;
    afterChange();
    renderWorkshop();
  }

  function renderCollection() {
    $("collectionCount").textContent = `已发现 ${Object.keys(state.discovered).length}/24 · 首次发现自动获得金币`;
    $("collectionList").innerHTML = Object.entries(chains).map(([chain, items]) => `<section><b>${generatorDefs[chain].name}</b><div class="collection-grid">${items.map((item, level) => `<span class="${state.discovered[`${chain}:${level}`] ? "found" : "unknown"}">${item.emoji}<small>${item.name}</small><small>${state.discovered[`${chain}:${level}`] ? "已收藏" : `发现 +${(level + 1) * 10}币`}</small></span>`).join("")}</div></section>`).join("");
  }

  function showToast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1500);
  }

  function softTick(freq) {
    audio.effect(freq);
  }

  async function startMusic() {
    audio.configure({ music: state.musicOn !== false, effects: state.effectsOn, volume: state.musicVolume });
    const unlocked = await audio.start();
    if (document.hidden) audio.stop();
    syncSoundUI();
    $("audioStatus").textContent = !unlocked ? "声音尚未启动，请点试听重试，并检查设备音量。" :
      audio.playing && state.musicVolume > 0 ? "正在播放：夜市小调 · 原创循环配乐" : state.musicVolume === 0 && state.musicOn ? "音乐音量为 0，向右拖动滑块即可听到。" : "背景音乐已关闭，操作音效可独立开启。";
  }

  function syncSoundUI() {
    const audible = audio.playing && state.musicVolume > 0;
    $("soundBtn").textContent = audible ? "♫" : "♪";
    $("homeSoundBtn").classList.toggle("off", !state.musicOn);
    $("homeSoundBtn").classList.toggle("playing", audible);
    $("homeSoundBtn").querySelector("span").textContent = audible ? "♫" : "♪";
    $("homeSoundBtn").querySelector("small").textContent = !state.musicOn ? "音乐关" : state.musicVolume === 0 ? "音量 0" : audible ? "播放中" : "点我听";
    $("musicToggle").textContent = state.musicOn ? "已开启" : "已关闭";
    $("musicToggle").setAttribute("aria-pressed", String(state.musicOn !== false));
    $("effectsToggle").textContent = state.effectsOn ? "已开启" : "已关闭";
    $("effectsToggle").setAttribute("aria-pressed", String(state.effectsOn));
    $("musicVolume").value = Math.round(state.musicVolume * 100);
    $("volumeValue").textContent = `${Math.round(state.musicVolume * 100)}%`;
  }

  function openSound() {
    $("soundDialog").showModal();
    startMusic();
  }

  $("guideBtn").addEventListener("click", () => {
    $("guide").classList.add("hidden");
    state.introduced = true; renderTools(); save();
  });
  $("helpBtn").addEventListener("click", () => $("helpDialog").showModal());
  $("homeHelpBtn").addEventListener("click", () => $("helpDialog").showModal());
  $("helpDialog").querySelectorAll(".dialog-close,.dialog-ok").forEach(b => b.addEventListener("click", () => $("helpDialog").close()));
  $("recipeBtn").addEventListener("click", () => { renderCollection(); $("recipeDialog").showModal(); });
  $("recipeDialog").querySelectorAll(".recipe-close,.recipe-ok").forEach(b => b.addEventListener("click", () => $("recipeDialog").close()));
  $("startGameBtn").addEventListener("click", () => {
    $("homeScreen").classList.add("hidden");
    $("homeScreen").inert = true;
    renderUI();
    startMusic();
    softTick(540);
  });
  $("homeBtn").addEventListener("click", () => {
    $("homeScreen").classList.remove("hidden");
    $("homeScreen").inert = false;
    drag = null;
    renderUI();
    save();
  });
  $("soundBtn").addEventListener("click", openSound);
  $("homeSoundBtn").addEventListener("click", openSound);
  $("soundClose").addEventListener("click", () => $("soundDialog").close());
  $("musicToggle").addEventListener("click", () => { state.musicOn = !state.musicOn; startMusic(); save(); });
  $("effectsToggle").addEventListener("click", () => { state.effectsOn = !state.effectsOn; startMusic().then(() => softTick(620)); save(); });
  $("musicVolume").addEventListener("input", e => { state.musicVolume = Number(e.target.value) / 100; startMusic(); save(); });
  $("audioPreview").addEventListener("click", () => { startMusic().then(() => softTick(760)); });
  $("openGrowthBtn").addEventListener("click", openGrowth);
  $("growthGameBtn").addEventListener("click", openGrowth);
  $("expandBtn").addEventListener("click", expandShop);
  $("growthClose").addEventListener("click", () => $("growthDialog").close());

  $("workshopBtn").addEventListener("click", () => { renderWorkshop(); $("workshopDialog").showModal(); });
  $("workshopClose").addEventListener("click", () => $("workshopDialog").close());
  $("sellBtn").addEventListener("click", sellSelected);
  $("hintBtn").addEventListener("click", findMerge);
  $("skipBtn").addEventListener("click", swapOrder);

  document.addEventListener("visibilitychange", () => {
    drag = null; lastTime = performance.now(); save();
    if (document.hidden) audio.stop();
    else if (audio.context) startMusic();
    syncSoundUI();
  });
  window.addEventListener("pagehide", () => { audio.stop(); save(); });

  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(canvas.parentElement);
  state = load();
  normalizeProgress();
  ensureProducers();
  if (!Array.isArray(state.orders) || state.orders.length !== 3 || state.orders.some(order => "remaining" in order)) state.orders = makeOrders();
  if (state.introduced) $("guide").classList.add("hidden");
  resize();
  renderUI();
  save();
  requestAnimationFrame(animate);
})();
