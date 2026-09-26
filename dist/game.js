(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const COLS = 7;
  const ROWS = 8;
  const SAVE_KEY = "nightMarketMergeSave_v3";
  const OLD_SAVE_KEYS = ["nightMarketMergeSave_v2", "nightMarketMergeSave_v1"];
  const stageDefs = {
    1: { name: "长街初灯", desc: "节奏舒缓，熟悉摊位与连击", target: 6, timeRate: 1.12, vipBonus: 0, lives: 3, trash: 0, rewardRate: 1 },
    2: { name: "雨夜客潮", desc: "订单更快，开局已有杂物", target: 7, timeRate: .82, vipBonus: .1, lives: 3, trash: 2, rewardRate: 1.18 },
    3: { name: "灯会之夜", desc: "极限客流，两颗耐心守住全场", target: 8, timeRate: .66, vipBonus: .2, lives: 2, trash: 4, rewardRate: 1.42 },
  };

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
  let audioOn = true;
  let musicTimer = null;
  let lastTime = performance.now();
  let uiClock = 0;
  let saveClock = 0;
  let selectedCell = -1;
  const perkDefs = {
    speed: { name: "快火主厨", text: "本局所有摊位备料时间减少 35%" },
    calm: { name: "茶水待客", text: "下一轮每位食客多等 25 秒" },
    combo: { name: "连单达人", text: "本局连击窗口从 18 秒延长到 35 秒" },
    quality: { name: "精选食材", text: "本局直接产出二级食材的概率增加 25%" },
    tips: { name: "招牌营销", text: "本局订单金币额外增加 30%" },
  };
  const upgradeDefs = {
    stove: { name: "高效炉灶", text: "每级缩短 10% 备料时间", cost: 180 },
    service: { name: "舒适座席", text: "每级让食客多等 8 秒", cost: 160 },
    supply: { name: "补给推车", text: "每级交单额外恢复 2 体力", cost: 140 },
  };

  function normalizeProgress() {
    state.upgrades ||= { stove: 0, service: 0, supply: 0 };
    state.records ||= {};
    state.discovered ||= {};
    state.perks ||= [];
    state.offers ||= [];
    state.mistakes ||= 0;
    state.runCombo ||= 0;
    state.elapsed ||= 0;
    state.energyClock ||= 0;
    state.rescues ||= 0;
    state.splits ??= 2;
    state.discards ??= 1;
    state.board.forEach(p => {
      if (p?.type === "item") {
        p.level = Math.min(p.level, 5);
        state.discovered[`${p.chain}:${p.level}`] = true;
      }
    });
  }

  function activePlay() {
    return state.introduced && !state.gameOver && !state.offers.length && !document.hidden &&
      $("homeScreen").classList.contains("hidden") && !document.querySelector("dialog[open]");
  }

  function hasPerk(key) { return state?.perks?.includes(key); }

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
    for (const chain of ["rice", "noodle", "grill", ...(state.level >= 3 ? ["sweet"] : [])]) {
      if (state.board.some(p => p?.type === "generator" && p.chain === chain)) continue;
      const open = state.board.findIndex(p => !p);
      if (open >= 0) state.board[open] = { type: "generator", chain, cooldown: 0 };
    }
  }

  function beginRun(stageNumber) {
    const previous = state;
    state = freshState();
    for (const key of ["coins", "level", "xp", "bestCombo", "unlockedStage", "stageWins", "musicOn", "records", "upgrades", "discovered"])
      state[key] = previous[key];
    state.stage = stageNumber;
    state.introduced = true;
    normalizeProgress();
    ensureProducers();
    state.lives = currentStage().lives;
    state.orders = makeOrders(state.level, 1, stageNumber);
    for (let n = 0; n < currentStage().trash; n++) addTrash();
    selectedCell = -1;
    drag = null;
    $("guide").classList.add("hidden");
    afterChange();
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
      board, coins: 80, energy: 100, level: 1, xp: 0,
      orders: makeOrders(1, 1, 1), introduced: false,
      lives: 3, combo: 0, comboTime: 0, bestCombo: 0,
      served: 0, shift: 1, score: 0, mergeMeter: 0, gameOver: false,
      stage: 1, unlockedStage: 1, stageWins: { 1: 0, 2: 0, 3: 0 }, musicOn: true,
    };
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (saved && Array.isArray(saved.board) && saved.board.length === COLS * ROWS) {
        saved.stage ||= 1;
        saved.unlockedStage ||= saved.level >= 3 ? 2 : 1;
        saved.stageWins ||= { 1: 0, 2: 0, 3: 0 };
        if (saved.musicOn === undefined) saved.musicOn = true;
        const needsStageOrders = saved.orders?.some(order => !Number.isFinite(order.remaining));
        if (needsStageOrders) saved.orders = makeOrders(saved.level || 1, saved.shift || 1, saved.stage);
        return saved;
      }
      for (const key of OLD_SAVE_KEYS) {
        const old = JSON.parse(localStorage.getItem(key));
        if (!old || !Array.isArray(old.board) || old.board.length !== COLS * ROWS) continue;
        old.board = old.board.map(piece => {
          if (!piece) return null;
          if (!piece.chain) return { ...piece, chain: "rice" };
          return piece;
        });
        const empties = old.board.map((v, i) => v ? -1 : i).filter(i => i >= 0);
        for (const chain of ["noodle", "grill"]) {
          if (!old.board.some(p => p?.type === "generator" && p.chain === chain) && empties.length) {
            old.board[empties.shift()] = { type: "generator", chain, cooldown: 0 };
          }
        }
        Object.assign(old, { lives: 3, combo: 0, comboTime: 0, bestCombo: 0, served: 0, shift: 1, score: 0, mergeMeter: 0, gameOver: false, stage: 1, unlockedStage: (old.level || 1) >= 3 ? 2 : 1, stageWins: { 1: 0, 2: 0, 3: 0 }, musicOn: true });
        old.orders = makeOrders(old.level || 1, 1, 1);
        return old;
      }
    } catch (_) {}
    return freshState();
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch (_) { $("homeTip").textContent = "浏览器未能保存进度，请保留当前页面。"; }
  }

  function index(c, r) { return r * COLS + c; }
  function cellOf(i) { return { c: i % COLS, r: Math.floor(i / COLS) }; }

  function currentStage() { return stageDefs[state?.stage || 1]; }
  function shiftTarget() { return currentStage().target; }

  function makeOrder(level, shift, slot = 0, stageNumber = state?.stage || 1) {
    const stage = stageDefs[stageNumber];
    const present = state?.board?.filter(p => p?.type === "generator").map(p => p.chain);
    const availableChains = present?.length ? [...new Set(present)] : ["rice", "noodle", "grill"];
    const maxLevel = Math.min(4, stageNumber + (shift > 1 ? 1 : 0));
    const vip = Math.random() < Math.min(.52, .08 + shift * .035 + stage.vipBonus);
    const count = slot === 2 ? 2 : 1;
    const items = Array.from({ length: count }, () => ({
      chain: availableChains[Math.floor(Math.random() * availableChains.length)],
      level: Math.max(1, Math.floor(Math.random() * (maxLevel + 1))),
    }));
    const work = items.reduce((sum, item) => sum + 2 ** item.level, 0);
    const baseTime = Math.max(work * 3.2 + 25, (100 - shift * 5 - (vip ? 24 : 0) + count * 20) * stage.timeRate)
      + (state?.upgrades?.service || 0) * 8 + (hasPerk("calm") ? 25 : 0);
    const reward = Math.round((items.reduce((s, item) => s + (item.level + 1) * 17, 0) + count * 10) * (vip ? 1.8 : 1) * stage.rewardRate);
    return { id: `${Date.now()}-${slot}-${Math.random()}`, items, reward, remaining: baseTime, maxTime: baseTime, vip };
  }

  function makeOrders(level, shift, stageNumber = state?.stage || 1) {
    return Array.from({ length: 3 }, (_, i) => makeOrder(level, shift, i, stageNumber));
  }

  function xpNeeded() { return 60 + (state.level - 1) * 30; }

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
    grd.addColorStop(0, "rgba(16,66,69,.94)");
    grd.addColorStop(1, "rgba(7,38,45,.97)");
    roundedRect(geom.x - 5, geom.y - 5, bw + 10, bh + 10, 22);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,208,112,.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = index(c, r);
        const x = geom.x + c * geom.cell;
        const y = geom.y + r * geom.cell;
        const gap = 3;
        roundedRect(x + gap, y + gap, geom.cell - gap * 2, geom.cell - gap * 2, Math.max(7, geom.cell * .14));
        const even = (r + c) % 2 === 0;
        ctx.fillStyle = even ? "rgba(117,178,148,.19)" : "rgba(82,143,130,.16)";
        ctx.fill();
        ctx.strokeStyle = "rgba(209,235,193,.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (i === selectedCell) {
          ctx.strokeStyle = "#fff29d"; ctx.lineWidth = 3; ctx.stroke();
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
      ctx.fillText("清理 15", 0, size * .31);
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
    drawBoard();
    requestAnimationFrame(animate);
  }

  function updateTimers(dt) {
    if (!activePlay()) return;
    state.elapsed += dt;
    state.energyClock += dt;
    if (state.energyClock >= 3) {
      state.energy = Math.min(120, state.energy + Math.floor(state.energyClock / 3));
      state.energyClock %= 3;
    }
    state.board.forEach(piece => {
      if (piece?.type === "generator" && piece.cooldown > 0) piece.cooldown = Math.max(0, piece.cooldown - dt);
    });
    if (state.comboTime > 0) {
      state.comboTime = Math.max(0, state.comboTime - dt);
      if (state.comboTime === 0) state.combo = 0;
    }
    let expired = -1;
    state.orders.forEach((order, i) => {
      order.remaining -= dt;
      if (order.remaining <= 0 && expired < 0) expired = i;
    });
    if (expired >= 0) expireOrder(expired);
    uiClock += dt;
    saveClock += dt;
    if (uiClock >= .2) {
      uiClock = 0;
      renderTimers();
    }
    if (saveClock >= 5) {
      saveClock = 0;
      save();
    }
  }

  function expireOrder(orderIndex) {
    state.lives--;
    state.mistakes++;
    state.combo = 0;
    state.comboTime = 0;
    addTrash();
    if (state.lives <= 0) {
      finishRun(false);
      return;
    }
    state.orders[orderIndex] = makeOrder(state.level, state.shift, orderIndex);
    showToast("食客等不及走了，棋盘多了一袋垃圾");
    softTick(90);
    afterChange();
  }

  function addTrash() {
    const empties = state.board.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    if (empties.length) state.board[empties[Math.floor(Math.random() * empties.length)]] = { type: "trash" };
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
    if (!activePlay()) return;
    const p = point(e);
    const i = hitCell(p.x, p.y);
    if (i < 0 || !state.board[i]) return;
    selectedCell = i;
    renderTools();
    canvas.setPointerCapture(e.pointerId);
    drag = { from: i, piece: state.board[i], x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = point(e);
    drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) drag.moved = true;
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const p = point(e);
    const target = hitCell(p.x, p.y);
    const source = drag.from;
    const piece = drag.piece;
    const moved = drag.moved;
    drag = null;
    if (!activePlay()) return;
    if (!moved && piece.type === "trash") {
      if (state.coins < 15) { showToast("需要 15 金币才能清理垃圾"); return; }
      state.coins -= 15;
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
    if (target < 0 || target === source) return;
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
      state.xp += 5 + base.level * 2;
      state.mergeMeter = (state.mergeMeter || 0) + 1;
      burstAt(target);
      softTick(620);
      if (state.mergeMeter >= 7) {
        state.mergeMeter = 0;
        spawnWild(Math.min(2, base.level));
      } else {
        showToast(`合成 ${chains[base.chain][base.level + 1].name} · 百搭酱 ${state.mergeMeter}/7`);
      }
      checkLevel();
      discover(state.board[target]);
    } else {
      state.board[source] = there; state.board[target] = piece;
      softTick(240);
    }
    afterChange();
  });

  canvas.addEventListener("pointercancel", () => { drag = null; });

  function canMergePieces(a, b) {
    if (a.type === "item" && b.type === "item") return a.chain === b.chain && a.level === b.level;
    if (a.type === "wild" && b.type === "item") return a.level === b.level;
    if (a.type === "item" && b.type === "wild") return a.level === b.level;
    return false;
  }

  function spawnWild(level) {
    const open = state.board.findIndex(p => !p);
    if (open < 0) { showToast("百搭酱已就绪，但棋盘没有空位"); return; }
    state.board[open] = { type: "wild", level };
    burstAt(open, "#e9a7ff");
    showToast("七连合成！获得一份百搭酱");
  }

  function produce(generatorIndex) {
    const generator = state.board[generatorIndex];
    if ((generator.cooldown || 0) > 0) { showToast(`摊位备料中，还要 ${generator.cooldown.toFixed(1)} 秒`); softTick(110); return; }
    if (state.energy <= 0) { showToast("体力不够啦，完成订单或稍后再来"); softTick(100); return; }
    const empties = state.board.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    if (!empties.length) { showToast("棋盘满了，先合成或完成订单吧"); return; }
    const { c: gc, r: gr } = cellOf(generatorIndex);
    empties.sort((a, b) => {
      const aa = cellOf(a), bb = cellOf(b);
      return Math.abs(aa.c - gc) + Math.abs(aa.r - gr) - Math.abs(bb.c - gc) - Math.abs(bb.r - gr);
    });
    const target = empties[0];
    const level = Math.random() < Math.min(.6, .08 + (hasPerk("quality") ? .25 : 0)) ? 1 : 0;
    state.board[target] = { type: "item", chain: generator.chain, level };
    state.energy--;
    generator.cooldown = 2 * (1 - state.upgrades.stove * .1) * (hasPerk("speed") ? .65 : 1);
    discover(state.board[target]);
    burstAt(target, "#ff9f57");
    softTick(440);
    afterChange();
  }

  function canComplete(order) {
    const counts = {};
    state.board.forEach(p => {
      if (p?.type === "item") {
        const key = `${p.chain}:${p.level}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return order.items.every(item => counts[`${item.chain}:${item.level}`]-- > 0);
  }

  function fulfill(orderIndex) {
    if (!activePlay()) return;
    const order = state.orders[orderIndex];
    if (!canComplete(order)) {
      showToast(order.items.map(p => `${generatorDefs[p.chain].name} → ${chains[p.chain][p.level].name} L${p.level + 1}`).join("；"));
      return;
    }
    order.items.forEach(item => {
      const i = state.board.findIndex(p => p?.type === "item" && p.chain === item.chain && p.level === item.level);
      state.board[i] = null;
      burstAt(i, "#7df1a4");
    });
    state.combo = state.comboTime > 0 ? Math.min(8, state.combo + 1) : 1;
    state.comboTime = hasPerk("combo") ? 35 : 18;
    state.runCombo = Math.max(state.runCombo, state.combo);
    state.bestCombo = Math.max(state.bestCombo || 0, state.combo);
    const multiplier = 1 + Math.max(0, state.combo - 1) * .2;
    const earned = Math.round(order.reward * multiplier * (hasPerk("tips") ? 1.3 : 1));
    state.coins += earned;
    state.score += earned + (order.vip ? 80 : 0);
    state.xp += 18 + order.items.length * 8;
    state.energy = Math.min(120, state.energy + 6 + state.upgrades.supply * 2);
    state.served++;
    state.orders[orderIndex] = makeOrder(state.level, state.shift, orderIndex);
    showToast(`${order.vip ? "贵客满意！" : "上菜成功"} +${earned} · ${state.combo} 连击`);
    softTick(760);
    checkLevel();
    if (state.served >= shiftTarget()) completeShift();
    afterChange();
  }

  function completeShift() {
    const bonus = 100 + state.shift * 45;
    state.coins += bonus;
    state.score += bonus * 2;
    state.stageWins[state.stage] = (state.stageWins[state.stage] || 0) + 1;
    if (state.shift >= 2) { finishRun(true); return; }
    state.shift++;
    state.served = 0;
    state.lives = Math.min(currentStage().lives, state.lives + 1);
    state.energy = Math.min(120, state.energy + 18);
    const pool = Object.keys(perkDefs).filter(key => !hasPerk(key));
    state.offers = [];
    while (state.offers.length < 3 && pool.length) state.offers.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    showPerks();
    for (let n = 0; n < Math.min(2, state.shift - 1); n++) addTrash();
  }

  function selectStage(stageNumber) {
    if (stageNumber > state.unlockedStage) {
      $("homeTip").textContent = "先在上一关完成两轮营业，才能解锁这里。";
      return;
    }
    if (state.stage === stageNumber && !state.gameOver) return;
    if (!state.gameOver && (state.elapsed > 0 || state.served > 0)) {
      if (!confirm("切换关卡将开始新一局。金币、升级和收藏会保留，当前棋盘与本局得分会重置。")) return;
    }
    beginRun(stageNumber);
    $("homeTip").textContent = `${currentStage().desc}。订单倒计时在主页暂停。`;
    afterChange();
  }

  function checkLevel() {
    let needed = xpNeeded();
    while (state.xp >= needed) {
      state.xp -= needed;
      state.level++;
      state.energy = Math.min(120, state.energy + 25);
      state.coins += state.level * 20;
      if (state.level === 3 && !state.board.some(p => p?.type === "generator" && p.chain === "sweet")) {
        const open = state.board.findIndex(p => !p);
        if (open >= 0) state.board[open] = { type: "generator", chain: "sweet" };
        showToast("茶饮铺解锁！新的甜品菜系加入夜市");
      }
      showToast(`夜市升到 ${state.level} 级！体力 +25`);
      needed = xpNeeded();
    }
  }

  function afterChange() {
    ensureProducers();
    renderUI();
    save();
  }

  function renderUI() {
    const atHome = !$("homeScreen").classList.contains("hidden");
    document.querySelectorAll(".game-shell > header, .game-shell > .orders-wrap, .game-shell > .board-wrap, .game-shell > .tool-tray, .game-shell > footer").forEach(el => { el.inert = atHome; });
    $("coinValue").textContent = state.coins;
    $("energyValue").textContent = state.energy;
    $("levelValue").textContent = state.level;
    $("livesValue").textContent = "♥".repeat(Math.max(0, state.lives)) + "♡".repeat(Math.max(0, 3 - state.lives));
    $("shiftValue").textContent = `${currentStage().name} · ${state.served}/${shiftTarget()}`;
    $("comboValue").textContent = state.combo > 1 ? `${state.combo} 连击 · ${Math.ceil(state.comboTime)}s` : `百搭酱 ${state.mergeMeter}/7`;
    $("comboValue").classList.toggle("hot", state.combo > 1);
    $("homeLevel").textContent = state.level;
    $("homeCoins").textContent = state.coins;
    $("homeCombo").textContent = state.bestCombo || 0;
    $("homeProgress").textContent = state.gameOver ? `本局得分 ${state.score}` : `${currentStage().name} · ${state.served}/${shiftTarget()} 单`;
    $("startGameBtn").querySelector("span").textContent = state.gameOver ? "查看结算" : (state.introduced ? "继续营业" : "开始营业");
    $("homeGreeting").textContent = state.gameOver ? "今晚已经打烊，来看看经营成绩" : (state.shift > 1 ? `已经守到第 ${state.shift} 轮，街上越来越热闹` : "掌柜，今晚也要准时开张");
    document.querySelectorAll(".level-card").forEach(card => {
      const n = Number(card.dataset.stage);
      const locked = n > state.unlockedStage;
      card.classList.toggle("selected", n === state.stage);
      card.classList.toggle("locked", locked);
      const stars = state.records[n]?.stars || 0;
      card.querySelector("span small").textContent = `${stageDefs[n].target} 单/轮 · ${stageDefs[n].lives} 耐心${state.records[n] ? ` · 最高 ${state.records[n].score} 分` : ""}`;
      card.querySelector("em").textContent = locked ? "未解锁" : (stars ? "★".repeat(stars) : (n === state.stage ? "已选择" : "可挑战"));
      card.setAttribute("aria-label", `${stageDefs[n].name}，${stageDefs[n].desc}，${locked ? "未解锁" : n === state.stage ? "已选择" : "可挑战"}`);
    });
    syncSoundUI();
    renderTools();
    $("xpCopy").textContent = `${state.xp} / ${xpNeeded()}`;
    $("xpBar").style.width = `${Math.min(100, state.xp / xpNeeded() * 100)}%`;
    const orders = $("orders");
    orders.innerHTML = "";
    state.orders.forEach((order, i) => {
      const ready = canComplete(order);
      const btn = document.createElement("button");
      const urgent = order.remaining / order.maxTime < .28;
      btn.className = `order-card${ready ? " ready" : ""}${order.vip ? " vip" : ""}${urgent ? " urgent" : ""}`;
      const names = order.items.map(item => chains[item.chain][item.level].name);
      btn.setAttribute("aria-label", `${order.vip ? "贵客，" : ""}${names.join("、")}，剩余${Math.ceil(order.remaining)}秒，奖励${order.reward}金币${ready ? "，可以交付" : ""}`);
      btn.innerHTML = `${order.vip ? '<span class="vip-tag">贵客</span>' : ''}<span class="order-check">✓</span><div class="order-items">${order.items.map(item => { const def = chains[item.chain][item.level]; return `<span title="${def.name}">${def.emoji}<small>${def.name}</small></span>`; }).join("")}</div><div class="order-reward"><span>●</span>${order.reward}<em>${Math.ceil(order.remaining)}s</em></div><div class="timer-track"><i style="width:${Math.max(0, order.remaining / order.maxTime * 100)}%"></i></div>`;
      btn.addEventListener("click", () => fulfill(i));
      orders.appendChild(btn);
    });
  }

  function renderTimers() {
    $("energyValue").textContent = state.energy;
    $("comboValue").textContent = state.combo > 1 ? `${state.combo} 连击 · ${Math.ceil(state.comboTime)}s` : `百搭酱 ${state.mergeMeter}/7`;
    document.querySelectorAll(".order-card").forEach((card, i) => {
      const order = state.orders[i];
      card.querySelector("em").textContent = `${Math.max(0, Math.ceil(order.remaining))}s`;
      card.setAttribute("aria-label", `${order.items.map(p => chains[p.chain][p.level].name).join("、")}，剩余${Math.max(0, Math.ceil(order.remaining))}秒，奖励${order.reward}金币${canComplete(order) ? "，可以交付" : ""}`);
      card.querySelector(".timer-track i").style.width = `${Math.max(0, order.remaining / order.maxTime * 100)}%`;
      card.classList.toggle("urgent", order.remaining / order.maxTime < .28);
    });
  }

  function showPerks() {
    $("perkChoices").innerHTML = state.offers.map(key => `<button data-perk="${key}"><b>${perkDefs[key].name}</b><small>${perkDefs[key].text}</small></button>`).join("");
    $("perkChoices").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => choosePerk(btn.dataset.perk)));
    if (!$("perkDialog").open) $("perkDialog").showModal();
  }

  function choosePerk(key) {
    if (!state.offers.includes(key)) return;
    state.perks.push(key);
    state.offers = [];
    state.orders = makeOrders(state.level, state.shift, state.stage);
    state.combo = 0;
    state.comboTime = 0;
    $("perkDialog").close();
    afterChange();
  }

  function finishRun(won) {
    state.gameOver = true;
    state.won = won;
    state.offers = [];
    drag = null;
    const stars = won ? 1 + Number(state.mistakes === 0) + Number(state.mistakes === 0 && state.runCombo >= 3) : 0;
    if (won) {
      state.unlockedStage = Math.min(3, Math.max(state.unlockedStage, state.stage + 1));
      const record = state.records[state.stage] || { stars: 0, score: 0 };
      state.records[state.stage] = { stars: Math.max(stars, record.stars), score: Math.max(state.score, record.score) };
    }
    state.resultStars = stars;
    showResult();
    afterChange();
  }

  function showResult() {
    $("endTitle").textContent = state.won ? "夜市挑战通关！" : "今晚打烊了";
    $("endText").textContent = state.won ? `${"★".repeat(state.resultStars || 1)} · 通关得一星；零失误再一星；零失误且三连单得三星。` : "金币、升级与收藏已保留。调整经营路线，再试一次。";
    $("finalScore").textContent = state.score;
    $("finalShift").textContent = state.shift;
    if (!$("endDialog").open) $("endDialog").showModal();
  }

  function renderTools() {
    const piece = state.board[selectedCell];
    $("selectionInfo").textContent = piece?.type === "item" ? `${chains[piece.chain][piece.level].name} · L${piece.level + 1}` : "点选食材，可出售或拆分";
    $("sellBtn").disabled = piece?.type !== "item" || !activePlay();
    $("splitBtn").disabled = piece?.type !== "item" || piece.level === 0 || state.splits <= 0 || !activePlay();
    $("splitBtn").textContent = `拆分 (${state.splits})`;
    $("skipBtn").textContent = `换急单 (${state.discards})`;
    $("skipBtn").disabled = state.discards <= 0 || !activePlay();
    $("rescueBtn").title = `全场 +12 秒 · ${30 + state.rescues * 20} 金币`;
    $("runSummary").textContent = `第 ${state.shift}/2 轮 · ${state.served}/${shiftTarget()} 单 · ${state.score} 分`;
    $("perkSummary").textContent = state.perks.length ? state.perks.map(key => perkDefs[key].name).join(" · ") : "通过首轮，选择一项经营能力";
  }

  function sellSelected() {
    const piece = state.board[selectedCell];
    if (!activePlay() || piece?.type !== "item") return;
    state.coins += piece.level + 1;
    state.board[selectedCell] = null;
    afterChange();
  }

  function splitSelected() {
    const piece = state.board[selectedCell];
    const open = state.board.findIndex(p => !p);
    if (!activePlay() || piece?.type !== "item" || piece.level < 1 || state.splits <= 0) return;
    if (open < 0) { showToast("拆分需要一个空格"); return; }
    piece.level--;
    state.board[open] = { ...piece };
    state.splits--;
    afterChange();
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

  function getAudioContext() {
    const A = window.AudioContext || window.webkitAudioContext;
    return getAudioContext.ac || (getAudioContext.ac = new A());
  }

  function playTone(freq, duration = .1, volume = .035, type = "sine") {
    try {
      const ac = getAudioContext();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = freq;
      osc.type = type;
      gain.gain.setValueAtTime(volume, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + duration);
      osc.connect(gain).connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + duration);
    } catch (_) {}
  }

  function softTick(freq) {
    if (!audioOn) return;
    playTone(freq);
  }

  function startMusic() {
    if (!audioOn || musicTimer) return;
    const notes = [220, 277, 330, 415, 330, 277, 247, 330];
    let note = 0;
    const play = () => {
      if (!audioOn || document.hidden) return;
      playTone(notes[note++ % notes.length], .55, .012, "triangle");
    };
    play();
    musicTimer = setInterval(play, 920);
  }

  function stopMusic() {
    clearInterval(musicTimer);
    musicTimer = null;
  }

  function syncSoundUI() {
    $("soundBtn").textContent = audioOn ? "♪" : "×";
    $("homeSoundBtn").classList.toggle("off", !audioOn);
    $("homeSoundBtn").querySelector("span").textContent = audioOn ? "♫" : "×";
    $("homeSoundBtn").querySelector("small").textContent = audioOn ? "音乐开" : "音乐关";
  }

  function toggleAudio() {
    audioOn = !audioOn;
    state.musicOn = audioOn;
    if (audioOn) startMusic(); else stopMusic();
    syncSoundUI();
    $("homeTip").textContent = audioOn ? "音乐与操作音效已开启。" : "音乐与操作音效已关闭。";
    save();
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
    if (state.gameOver) { showResult(); return; }
    $("homeScreen").classList.add("hidden");
    $("homeScreen").inert = true;
    if (state.offers.length) showPerks();
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
  $("soundBtn").addEventListener("click", toggleAudio);
  $("homeSoundBtn").addEventListener("click", toggleAudio);
  document.querySelectorAll(".level-card").forEach(card => card.addEventListener("click", () => selectStage(Number(card.dataset.stage))));
  $("rescueBtn").addEventListener("click", () => {
    if (!activePlay()) return;
    const cost = 30 + state.rescues * 20;
    if (state.coins < cost) { showToast(`救场需要 ${cost} 金币`); softTick(100); return; }
    state.coins -= cost;
    state.rescues++;
    state.orders.forEach(order => {
      order.remaining += 12;
      order.maxTime = Math.max(order.maxTime, order.remaining);
    });
    state.board.forEach(piece => { if (piece?.type === "generator") piece.cooldown = 0; });
    showToast("全场订单 +12 秒，摊位立即备好");
    softTick(520);
    afterChange();
  });
  $("resetBtn").addEventListener("click", () => {
    if (!confirm("重新挑战本关？当前棋盘会重置，金币、永久升级和收藏保留。")) return;
    beginRun(state.stage);
    showToast("夜市重新开张啦");
  });
  $("restartBtn").addEventListener("click", () => {
    const retryStage = state.stage;
    $("endDialog").close();
    beginRun(retryStage);
    $("homeScreen").classList.add("hidden");
    $("homeScreen").inert = true;
    renderUI();
    showToast("新的一晚开始了");
  });

  $("workshopBtn").addEventListener("click", () => { renderWorkshop(); $("workshopDialog").showModal(); });
  $("workshopClose").addEventListener("click", () => $("workshopDialog").close());
  $("sellBtn").addEventListener("click", sellSelected);
  $("splitBtn").addEventListener("click", splitSelected);
  $("skipBtn").addEventListener("click", () => {
    if (!activePlay() || state.discards <= 0) return;
    const i = state.orders.reduce((best, order, n) => order.remaining < state.orders[best].remaining ? n : best, 0);
    state.orders[i] = makeOrder(state.level, state.shift, i);
    state.discards--;
    showToast("已更换最紧急订单，不扣耐心");
    afterChange();
  });
  $("endHomeBtn").addEventListener("click", () => {
    $("endDialog").close();
    $("homeScreen").classList.remove("hidden");
    $("homeScreen").inert = false;
    renderUI();
  });
  $("perkDialog").addEventListener("cancel", e => e.preventDefault());
  $("endDialog").addEventListener("cancel", e => { e.preventDefault(); $("endHomeBtn").click(); });
  document.addEventListener("visibilitychange", () => { drag = null; lastTime = performance.now(); save(); });
  window.addEventListener("pagehide", save);

  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(canvas.parentElement);
  state = load();
  normalizeProgress();
  ensureProducers();
  audioOn = state.musicOn !== false;
  if (state.introduced) $("guide").classList.add("hidden");
  resize();
  renderUI();
  requestAnimationFrame(animate);
})();
