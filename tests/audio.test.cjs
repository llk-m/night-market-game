const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../dist/audio.js'), 'utf8');

function boot(supported = true) {
  const timers = new Set();
  const notes = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; },
    setTargetAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    async resume() { this.state = 'running'; }
    createGain() { return {gain:param(), connect() {return this;}, disconnect() {}}; }
    createOscillator() {
      const note = {frequency:param(), connect() {return this;}, disconnect() {},
        start(t) { this.startTime=t; }, stop(t) { this.stopTime=t; if (t === undefined) this.onended?.(); }};
      notes.push(note); return note;
    }
  }
  const ctx = vm.createContext({window: supported ? {AudioContext} : {},
    setInterval(fn) {timers.add(fn); return fn;}, clearInterval(id) {timers.delete(id);} });
  vm.runInContext(source,ctx);
  return {audio:new ctx.window.NightMarketAudio(), timers, notes};
}

test('audio starts after unlock, schedules multiple instruments and does not duplicate timers', async () => {
  const {audio,timers,notes}=boot();
  assert.equal(audio.context,null); assert.equal(audio.playing,false);
  await Promise.all([audio.start(),audio.start()]);
  assert.equal(audio.playing,true); assert.equal(timers.size,1);
  assert.ok(notes.length >= 3);
  assert.ok(notes.every(n => n.startTime >= 0 && n.stopTime > n.startTime));
  audio.stop(); assert.equal(timers.size,0); assert.equal(audio.playing,false);
  assert.equal(audio.voices.size,0);
});

test('music and effects are independent; volume clamps and stopping cancels scheduled music', async () => {
  const {audio,notes,timers}=boot(); await audio.start();
  audio.configure({music:false,effects:true,volume:.25});
  assert.equal(audio.musicGain.gain.value,0); assert.equal(timers.size,0);
  const before=notes.length; audio.effect(760); assert.equal(notes.length,before+2);
  audio.configure({music:true,effects:false,volume:3}); await audio.start();
  assert.equal(audio.musicGain.gain.value,1); assert.equal(audio.effectsGain.gain.value,0);
  const muted=notes.length; audio.effect(760); assert.equal(notes.length,muted);
});

test('unsupported audio stays silent without breaking the game', async () => {
  const {audio}=boot(false);
  assert.equal(await audio.start(),false);
  audio.effect(500); audio.stop(); assert.equal(audio.playing,false);
});
