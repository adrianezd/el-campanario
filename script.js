'use strict';

/* =========================================================================
   El campanario — deducción social con narrador automático
   Un demonio y sus esbirros se esconden en el pueblo. Cada noche el móvil
   despierta a cada uno para que use su habilidad (casi todos los del
   pueblo reciben información, que puede ser falsa si están envenenados
   o borrachos). De día se debate y se vota: hace falta al menos la mitad
   de los vivos para ejecutar. Los muertos siguen jugando como fantasmas
   y les queda un único voto para el resto de la partida.
   Gana el pueblo si muere el demonio; gana el mal si quedan dos vivos.

   Un único motor para «Mismo móvil» (mesa.js) y «Con código de sala»
   (sala.js). La partida vive solo en memoria.
   ========================================================================= */

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 16;
const TIMER_OPTIONS = [0, 2, 3, 4, 5, 6, 8, 10, 12, 15];
const TIMER_STEP = 30;
const SETTINGS_KEY = 'campanario-settings-v1';

const ROLES = {
  lavandera: { t: 'pueblo', name: 'Lavandera', emoji: '🧺', goal: 'La primera noche ves a dos jugadores y sabes que uno de ellos tiene un papel concreto del pueblo.' },
  archivero: { t: 'pueblo', name: 'Archivero', emoji: '📚', goal: 'La primera noche ves a dos jugadores y sabes que uno es un forastero concreto (o que no hay forasteros).' },
  alguacil: { t: 'pueblo', name: 'Alguacil', emoji: '🕵️', goal: 'La primera noche ves a dos jugadores y sabes que uno es un esbirro concreto.' },
  cocinera: { t: 'pueblo', name: 'Cocinera', emoji: '🍲', goal: 'La primera noche sabes cuántas parejas de malvados están sentadas una al lado de la otra.' },
  boticaria: { t: 'pueblo', name: 'Boticaria', emoji: '⚗️', goal: 'Cada noche sabes cuántos de tus dos vecinos vivos son malvados.' },
  adivina: { t: 'pueblo', name: 'Adivina', emoji: '🔮', goal: 'Cada noche eliges a dos jugadores y sabes si alguno es el demonio. Ojo: hay un inocente que te sale como demonio.' },
  sonadora: { t: 'pueblo', name: 'Soñadora', emoji: '💭', goal: 'Cada noche eliges a alguien y ves dos papeles: uno de ellos es el suyo.' },
  sepulturero: { t: 'pueblo', name: 'Sepulturero', emoji: '⚰️', goal: 'Cada noche, desde la segunda, sabes qué papel tenía quien fue ejecutado ese día.' },
  medium: { t: 'pueblo', name: 'Médium', emoji: '🕯️', goal: 'Cada noche, desde la segunda, sabes cuántos de los muertos son malvados.' },
  monje: { t: 'pueblo', name: 'Monje', emoji: '🙏', goal: 'Cada noche, desde la segunda, proteges a otro jugador del demonio.' },
  cazadora: { t: 'pueblo', name: 'Cazadora', emoji: '🏹', goal: 'Una vez por partida, de día, disparas a alguien delante de todos: si es el demonio, muere.' },
  soldado: { t: 'pueblo', name: 'Soldado', emoji: '🛡️', goal: 'El demonio no puede matarte.' },
  alcaldesa: { t: 'pueblo', name: 'Alcaldesa', emoji: '🎖️', goal: 'Si solo quedan tres vivos y ese día no se ejecuta a nadie, gana el pueblo.' },
  borracho: { t: 'forastero', name: 'Borracho', emoji: '🍺', goal: 'Crees que eres del pueblo, pero tu habilidad no funciona y tu información es falsa.' },
  santo: { t: 'forastero', name: 'Santo', emoji: '😇', goal: 'Si el pueblo te ejecuta, gana el mal. Que no te voten.' },
  recluso: { t: 'forastero', name: 'Recluso', emoji: '🏚️', goal: 'Eres del pueblo, pero a las habilidades puedes parecerles malvado o incluso el demonio.' },
  envenenador: { t: 'esbirro', name: 'Envenenador', emoji: '🧪', goal: 'Cada noche envenenas a alguien: hasta el amanecer siguiente su habilidad falla y su información puede ser falsa.' },
  espia: { t: 'esbirro', name: 'Espía', emoji: '🗝️', goal: 'Cada noche ves el papel de todos. A las habilidades puedes parecerles del pueblo.' },
  heredera: { t: 'esbirro', name: 'Heredera', emoji: '💋', goal: 'Si muere el demonio cuando quedan cinco o más vivos, tú pasas a ser el demonio.' },
  baron: { t: 'esbirro', name: 'Barón', emoji: '🏰', goal: 'Por estar tú, hay dos forasteros más en la partida.' },
  demonio: { t: 'demonio', name: 'Demonio', emoji: '😈', goal: 'Cada noche, desde la segunda, matas a alguien. Si mueres, el pueblo gana.' }
};
const TYPE = { pueblo: 'del pueblo', forastero: 'forastero', esbirro: 'esbirro', demonio: 'demonio' };
const byType = (t) => Object.keys(ROLES).filter((k) => ROLES[k].t === t);
const isEvil = (r) => ROLES[r].t === 'esbirro' || ROLES[r].t === 'demonio';

// pueblo, forasteros, esbirros (y un demonio) según los jugadores
const SETUP = { 5: [3, 0, 1], 6: [3, 1, 1], 7: [5, 0, 1], 8: [5, 1, 1], 9: [5, 2, 1], 10: [7, 0, 2], 11: [7, 1, 2], 12: [7, 2, 2], 13: [9, 0, 3], 14: [9, 1, 3], 15: [9, 2, 3], 16: [10, 2, 3] };

/* --------------------------------- Ajustes --------------------------------- */

let settings = { playerCount: 8, timerMinutes: 5, secretVote: false };

function loadSettings() {
  const p = Kit.load(SETTINGS_KEY, {}) || {};
  if (typeof p.playerCount === 'number') settings.playerCount = Kit.clamp(Math.round(p.playerCount), MIN_PLAYERS, MAX_PLAYERS);
  if (typeof p.secretVote === 'boolean') settings.secretVote = p.secretVote;
  if (TIMER_OPTIONS.includes(p.timerMinutes)) settings.timerMinutes = p.timerMinutes;
}
function saveSettings() { Kit.save(SETTINGS_KEY, salaBackup ? Object.assign({}, settings, salaBackup) : settings); }

/* ---------------------------------- Motor ----------------------------------- */
// p: [{ r: papel, a: vivo, gv: voto fantasma gastado, d: papel que cree tener el borracho }]
// Fases: reveal → night → dawn → day → vote → verdict → night… y end.

function newGame(n, cfg, local) {
  let [town, out, min] = SETUP[n];
  const minions = Kit.shuffled(byType('esbirro')).slice(0, min);
  if (minions.includes('baron')) { const add = Math.min(2, town - 1, 3 - out); out += add; town -= add; }
  const outs = Kit.shuffled(byType('forastero')).slice(0, out);
  const towns = Kit.shuffled(byType('pueblo')).slice(0, town);
  const roles = Kit.shuffled(['demonio'].concat(minions, outs, towns));
  const notIn = Kit.shuffled(byType('pueblo').filter((r) => !towns.includes(r)));
  const p = roles.map((r) => ({ r, a: true, gv: false }));
  const drunk = p.find((x) => x.r === 'borracho');
  if (drunk) drunk.d = notIn.shift();
  const good = p.map((x, i) => (isEvil(x.r) ? -1 : i)).filter((i) => i >= 0);
  return {
    cfg: { seconds: cfg.timerMinutes * 60, local: Boolean(local), open: Boolean(local && !cfg.secretVote) },
    p, bluffs: notIn.slice(0, 3), red: Kit.pick(good),
    day: 1, phase: 'reveal', ready: {}, night: null, info: {}, poison: null,
    exec: null, dawn: null, shot: null, slay: false, votes: {}, verdict: null, winner: null
  };
}

const roleOf = (g, i) => g.p[i].r;
const seemsRole = (g, i) => (g.p[i].r === 'borracho' ? g.p[i].d : g.p[i].r); // lo que cree ser
const alive = (g) => g.p.map((x, i) => (x.a ? i : -1)).filter((i) => i >= 0);
const all = (g) => g.p.map((_, i) => i);
const broken = (g, i) => g.p[i].r === 'borracho' || g.poison === i;
const demonIdx = (g) => g.p.findIndex((x) => x.r === 'demonio' && x.a);
const coin = () => Math.random() < 0.5;

// cómo «parece» alguien a las habilidades: el recluso puede parecer malo y el espía bueno
const regEvil = (g, i) => (roleOf(g, i) === 'recluso' ? coin() : roleOf(g, i) === 'espia' ? coin() : isEvil(roleOf(g, i)));
const regDemon = (g, i) => roleOf(g, i) === 'demonio' || i === g.red || (roleOf(g, i) === 'recluso' && coin());

function checkWin(g) {
  if (demonIdx(g) === -1) return 'pueblo';
  if (alive(g).length <= 2) return 'mal';
  return null;
}

function startNight(g) {
  g.phase = 'night';
  g.night = { acts: {}, sel: {}, pick: {}, kill: null, poison: null, monk: null };
  g.info = {};
  g.votes = {};
  g.verdict = null;
  g.shot = null;
}

// vecinos vivos (en el orden en que estáis sentados, en círculo)
function neighbours(g, i) {
  const n = g.p.length;
  const out = [];
  for (const dir of [-1, 1]) {
    for (let k = 1; k < n; k++) {
      const j = (i + dir * k + n * n) % n;
      if (j !== i && g.p[j].a) { if (!out.includes(j)) out.push(j); break; }
    }
  }
  return out;
}

function otherThan(g, i, keep) {
  return Kit.pick(all(g).filter((k) => k !== i && k !== keep));
}

// «uno de estos dos es X»: con información buena o falsa
function pairInfo(g, i, type, bad) {
  const cands = all(g).filter((k) => k !== i && ROLES[roleOf(g, k)].t === type);
  if (bad || !cands.length) {
    if (!bad && type === 'forastero') return 'No hay forasteros en la partida.';
    const a = otherThan(g, i, -1);
    const b = otherThan(g, i, a);
    if (bad && type === 'forastero' && coin()) return 'No hay forasteros en la partida.';
    return `Uno de estos dos es ${art(Kit.pick(byType(type)))}: <strong>@${a}</strong> o <strong>@${b}</strong>.`;
  }
  const who = Kit.pick(cands);
  const other = otherThan(g, i, who);
  const [a, b] = coin() ? [who, other] : [other, who];
  return `Uno de estos dos es ${art(roleOf(g, who))}: <strong>@${a}</strong> o <strong>@${b}</strong>.`;
}
const art = (r) => `${/a$/.test(ROLES[r].name) ? 'la' : 'el'} ${ROLES[r].emoji} ${ROLES[r].name}`;
const fakeNum = (truth, max) => { const opts = []; for (let k = 0; k <= Math.max(1, max); k++) if (k !== truth) opts.push(k); return Kit.pick(opts); };

// La información de cada papel. Se guarda con @índice en vez del nombre (el estado viaja por la red).
function computeInfo(g, i, targets) {
  const r = seemsRole(g, i);
  const bad = broken(g, i);
  const n = g.day;
  switch (r) {
    case 'lavandera': return pairInfo(g, i, 'pueblo', bad);
    case 'archivero': return pairInfo(g, i, 'forastero', bad);
    case 'alguacil': return pairInfo(g, i, 'esbirro', bad);
    case 'cocinera': {
      let pairs = 0;
      const N = g.p.length;
      for (let k = 0; k < N; k++) if (isEvil(roleOf(g, k)) && isEvil(roleOf(g, (k + 1) % N))) pairs += 1;
      const v = bad ? fakeNum(pairs, 2) : pairs;
      return `Hay <strong>${v}</strong> pareja${v === 1 ? '' : 's'} de malvados sentados juntos.`;
    }
    case 'boticaria': {
      const nb = neighbours(g, i);
      const truth = nb.filter((k) => regEvil(g, k)).length;
      const v = bad ? fakeNum(truth, 2) : truth;
      return `Tus vecinos vivos son ${nb.map((k) => `<strong>@${k}</strong>`).join(' y ')}: <strong>${v}</strong> malvado${v === 1 ? '' : 's'}.`;
    }
    case 'adivina': {
      const [a, b] = targets;
      const truth = regDemon(g, a) || regDemon(g, b);
      const yes = bad ? !truth : truth;
      return `<strong>@${a}</strong> y <strong>@${b}</strong>: ${yes ? '<strong>¡sí, uno es el demonio!</strong>' : 'ninguno es el demonio.'}`;
    }
    case 'sonadora': {
      const t = targets[0];
      const real = roleOf(g, t);
      const other = Kit.pick(Object.keys(ROLES).filter((k) => k !== real && isEvil(k) !== isEvil(real)));
      const pairRoles = bad ? Kit.shuffled(Object.keys(ROLES).filter((k) => k !== real)).slice(0, 2) : Kit.shuffled([real, other]);
      return `<strong>@${t}</strong> es ${pairRoles.map((k) => `${ROLES[k].emoji} ${ROLES[k].name}`).join(' o ')}.`;
    }
    case 'sepulturero': {
      if (n < 2) return null;
      if (g.exec == null) return 'Hoy no se ha ejecutado a nadie.';
      const role = bad ? Kit.pick(Object.keys(ROLES)) : roleOf(g, g.exec);
      return `<strong>@${g.exec}</strong> era ${ROLES[role].emoji} <strong>${ROLES[role].name}</strong>.`;
    }
    case 'medium': {
      if (n < 2) return null;
      const dead = all(g).filter((k) => !g.p[k].a);
      const truth = dead.filter((k) => regEvil(g, k)).length;
      const v = bad ? fakeNum(truth, dead.length) : truth;
      return `De los ${dead.length} muertos, <strong>${v}</strong> ${v === 1 ? 'es malvado' : 'son malvados'}.`;
    }
    default: return null;
  }
}

// Qué hace cada uno de noche: 'look' (ver su información), 'one' (elegir a alguien), 'two' (a dos) o 'tap' (disimular)
function nightMode(g, i) {
  const r = seemsRole(g, i);
  const first = g.day === 1;
  if (r === 'demonio') return first ? 'look' : 'kill';
  if (r === 'envenenador') return 'one';
  if (r === 'espia') return 'look';
  if (['lavandera', 'archivero', 'alguacil', 'cocinera'].includes(r)) return first ? 'look' : 'tap';
  if (r === 'boticaria') return 'look';
  if (r === 'adivina') return 'two';
  if (r === 'sonadora') return 'one';
  if (['sepulturero', 'medium'].includes(r)) return first ? 'tap' : 'look';
  if (r === 'monje') return first ? 'tap' : 'one';
  return 'tap';
}

function resolveNight(g) {
  const acts = g.night.acts;
  const oldPoison = g.poison;
  // el demonio mata (desde la segunda noche)
  const dem = demonIdx(g);
  let died = null;
  if (g.day > 1 && dem !== -1 && g.night.kill != null && oldPoison !== dem) {
    const t = g.night.kill;
    const monk = g.p.findIndex((x) => x.r === 'monje' && x.a);
    const prot = monk !== -1 && oldPoison !== monk && acts[monk] != null ? g.night.monk : null;
    const soldier = roleOf(g, t) === 'soldado' && oldPoison !== t;
    if (g.p[t].a && t !== prot && !soldier) { g.p[t].a = false; died = t; }
  }
  // el veneno de esta noche dura hasta el próximo amanecer
  const env = g.p.findIndex((x) => x.r === 'envenenador' && x.a);
  g.poison = env !== -1 && g.night.poison != null ? g.night.poison : null;
  g.dawn = { died };
  g.exec = null;
  g.phase = 'dawn';
  g.winner = checkWin(g);
}

// Muere el demonio: si la heredera vive y quedaban cinco o más, ella pasa a ser el demonio
function demonDies(g, i, aliveBefore) {
  g.p[i].a = false;
  const heir = g.p.findIndex((x) => x.r === 'heredera' && x.a);
  if (heir !== -1 && aliveBefore >= 5 && g.poison !== heir) { g.p[heir].r = 'demonio'; g.p[heir].heir = true; }
}

function kill(g, i) {
  const before = alive(g).length;
  if (roleOf(g, i) === 'demonio') demonDies(g, i, before); else g.p[i].a = false;
}

function resolveCounts(g, counts, none) {
  const n = alive(g).length;
  const need = Math.ceil(n / 2);
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((k) => counts[k] === max).map(Number);
  let out = null;
  let reason = 'few';
  if (top.length > 1 && max >= need) reason = 'tie';
  else if (top.length === 1 && max >= need) { out = top[0]; reason = 'out'; }
  else if (!top.length) reason = 'novote';
  g.verdict = { out, reason, counts, none, need };
  g.phase = 'verdict';
  if (out != null) {
    const saint = roleOf(g, out) === 'santo' && g.poison !== out;
    kill(g, out);
    g.exec = out;
    if (saint) { g.winner = 'mal'; g.verdict.saint = true; return; }
  } else {
    // la alcaldesa: tres vivos y nadie ejecutado
    const mayor = g.p.findIndex((x) => x.r === 'alcaldesa' && x.a);
    if (n === 3 && mayor !== -1 && g.poison !== mayor) { g.winner = 'pueblo'; g.verdict.mayor = true; return; }
  }
  g.winner = checkWin(g);
}

function resolveVote(g) {
  const counts = {};
  let none = 0;
  Object.keys(g.votes).forEach((k) => {
    const t = g.votes[k];
    if (t === 'none') none += 1;
    else { counts[t] = (counts[t] || 0) + 1; if (!g.p[k].a) g.p[k].gv = true; }
  });
  resolveCounts(g, counts, none);
}

const canVote = (g, i) => g.p[i].a || !g.p[i].gv;

function act(g, i, a, host) {
  const me = g.p[i];
  const n = g.p.length;
  const valid = (t) => t >= 0 && t < n;
  switch (a.t) {
    case 'ready':
      if (g.phase !== 'reveal' || !me) return null;
      g.ready[i] = true;
      return {};
    case 'night-start':
      if (!host || (g.phase !== 'reveal' && g.phase !== 'verdict') || g.winner) return null;
      if (g.phase === 'verdict') g.day += 1;
      startNight(g);
      return { timer: null };
    case 'night': {
      if (g.phase !== 'night' || !me || !me.a || g.night.acts[i] != null) return null;
      const mode = nightMode(g, i);
      const r = seemsRole(g, i);
      const t = a.target;
      if (mode === 'look') {
        if (r !== 'demonio' && r !== 'espia') g.info[i] = computeInfo(g, i, []);
      } else if (mode === 'two') {
        if (!valid(t) || t === i) return null;
        const sel = g.night.sel[i] || [];
        if (sel.includes(t)) return null;
        sel.push(t);
        g.night.sel[i] = sel;
        if (sel.length < 2) return {};
        g.info[i] = computeInfo(g, i, sel);
      } else {
        if (!valid(t) || t === i || !g.p[t].a) return null;
        g.night.pick[i] = t;
        if (mode === 'kill' && me.r === 'demonio') g.night.kill = t;
        if (mode === 'one' && me.r === 'envenenador') g.night.poison = t;
        if (mode === 'one' && me.r === 'monje') g.night.monk = t;
        if (mode === 'one' && r === 'sonadora') g.info[i] = computeInfo(g, i, [t]);
      }
      g.night.acts[i] = 1;
      return {};
    }
    case 'dawn':
      if (!host || g.phase !== 'night') return null;
      resolveNight(g);
      return {};
    case 'day':
      if (!host || g.phase !== 'dawn' || g.winner) return null;
      g.phase = 'day';
      return { timer: g.cfg.seconds || null };
    case 'shoot': {
      const by = host && a.by != null ? a.by : i;
      const sh = g.p[by];
      if (g.phase !== 'day' || g.shot || !sh || !sh.a || !valid(a.target) || !g.p[a.target].a || a.target === by) return null;
      const real = sh.r === 'cazadora' && !g.slay && g.poison !== by;
      if (seemsRole(g, by) === 'cazadora') g.slay = true;
      const hit = real && roleOf(g, a.target) === 'demonio';
      if (hit) kill(g, a.target);
      g.shot = { by, target: a.target, hit };
      g.winner = checkWin(g);
      if (g.winner) { g.phase = 'verdict'; g.verdict = { out: null, reason: 'shot', counts: {}, none: 0, need: 0 }; }
      return {};
    }
    case 'to-vote':
      if (!host || g.phase !== 'day') return null;
      g.phase = 'vote';
      g.votes = {};
      return { timer: null };
    case 'vote':
      if (g.phase !== 'vote' || !me || !canVote(g, i)) return null;
      if (a.target !== 'none' && (!valid(a.target) || !g.p[a.target].a)) return null;
      g.votes[i] = a.target;
      return {};
    case 'tally':
      if (!host || g.phase !== 'vote') return null;
      resolveVote(g);
      return {};
    case 'end':
      if (!host || !g.winner) return null;
      g.phase = 'end';
      return { timer: null };
    default:
      return null;
  }
}

function privateTurn(g) {
  if (g.phase === 'reveal') return { key: 'reveal', order: all(g), done: (gg, k) => g.cfg.local || Boolean(gg.ready[k]), lastLabel: 'Listo, ¡cae la noche!' };
  if (g.phase === 'night') return { key: `night-${g.day}`, order: alive(g), done: (gg, k) => gg.night.acts[k] != null, lastLabel: 'Listo, ¡que amanezca!', intro: `🌙 Noche ${g.day}. Las campanas callan y el pueblo duerme.` };
  if (g.phase === 'vote' && !g.cfg.open) {
    const order = all(g).filter((k) => canVote(g, k));
    return { key: `vote-${g.day}`, order, done: (gg, k) => gg.votes[k] != null, lastLabel: 'Ver el recuento', intro: '🗳️ Votación secreta.' };
  }
  return null;
}

function advance(g) {
  if (g.phase === 'reveal') { startNight(g); return {}; }
  if (g.phase === 'night') { resolveNight(g); return {}; }
  if (g.phase === 'vote') { resolveVote(g); return {}; }
  return null;
}

/* ------------------------------ Lo que se pinta ------------------------------ */

const esc = Kit.esc;
const actAttr = (a) => `data-act="${esc(JSON.stringify(a))}"`;
const hostBtn = (a, label) => `<button type="button" class="btn btn-primary btn-large" ${actAttr(a)}>${label}</button>`;
const waitHost = (ctx, text) => `<p class="setup-hint sala-center">⏳ ${esc(text || `Esperando a ${ctx.hostName}`)}</p>`;
const tag = (r) => `${ROLES[r].emoji} ${ROLES[r].name}`;
const withNames = (txt, names) => String(txt).replace(/@(\d+)/g, (_, k) => esc(names[Number(k)] || '?'));
const list = (ids, names) => ids.map((k) => `<strong>${esc(names[k])}</strong>`).join(', ').replace(/, ([^,]*)$/, ' y $1');

function evilTeam(g, i, names) {
  const dem = g.p.findIndex((x) => x.r === 'demonio');
  const mins = all(g).filter((k) => ROLES[roleOf(g, k)].t === 'esbirro' && k !== i);
  let s = dem !== i ? `El demonio es <strong>${esc(names[dem])}</strong>.` : '';
  if (mins.length) s += ` ${dem === i ? 'Tus esbirros' : 'Los otros esbirros'}: ${mins.map((k) => `<strong>${esc(names[k])}</strong> (${ROLES[roleOf(g, k)].name})`).join(', ')}.`;
  if (dem === i) s += `<br>Para disimular, estos papeles no están en juego: ${g.bluffs.map(tag).join(', ')}.`;
  return s.trim();
}

function grimoire(g, names) {
  return '<ul class="town-list">' + g.p.map((x, k) => `<li class="${isEvil(x.r) ? 'is-wolf' : ''}${x.a ? '' : ' is-dead'}"><span>${ROLES[x.r].emoji}</span><strong>${esc(names[k])}</strong><small>${ROLES[x.r].name}${x.d ? ` · cree ser ${ROLES[x.d].name}` : ''}${g.poison === k ? ' · 🧪' : ''}${k === g.red ? ' · señuelo' : ''}</small></li>`).join('') + '</ul>';
}

function roleCard(g, i, names) {
  const x = g.p[i];
  const r = seemsRole(g, i);
  const R = ROLES[r];
  let extra = esc(R.goal);
  if (x.heir) extra = 'El demonio ha muerto y tú has heredado su poder. ' + extra;
  if (isEvil(x.r)) extra += `<br>${evilTeam(g, i, names)}`;
  const evil = isEvil(x.r);
  return { label: evil ? 'Equipo del mal' : `Equipo del pueblo · ${TYPE[R.t]}`, emoji: R.emoji, content: R.name, extra, alert: evil, impostor: evil };
}

function pickButtons(g, i, names, ids, attr, disabledNote) {
  return '<div class="sala-votes">' + ids.map((k) => {
    const a = attr(k);
    return `<button type="button" class="sala-vote" ${a ? actAttr(a) : 'disabled'}>${esc(names[k])}${!a && disabledNote ? `<small>${disabledNote}</small>` : ''}</button>`;
  }).join('') + '</div>';
}

function infoBox(g, i, names) {
  const s = g.info[i];
  return s ? `<div class="night-result is-safe"><span>${ROLES[seemsRole(g, i)].emoji}</span><p>${withNames(s, names)}</p></div><p class="setup-hint">Apúntatelo de cabeza: no se vuelve a enseñar.</p>` : '';
}

function nightPanel(g, i, names) {
  const x = g.p[i];
  const r = seemsRole(g, i);
  const mode = nightMode(g, i);
  const done = g.night.acts[i] != null;
  const others = all(g).filter((k) => k !== i);
  const aliveOthers = alive(g).filter((k) => k !== i);
  const heir = x.heir ? '<div class="night-result is-wolf"><span>💋</span><p>El demonio ha muerto: <strong>ahora el demonio eres tú</strong>.</p></div>' : '';
  if (done) {
    const pk = names[g.night.pick[i]];
    if (r === 'demonio' && g.day > 1) return heir + `<p class="screen-help">😈 Has elegido a <strong>${esc(pk)}</strong>. Al amanecer se sabrá…</p>`;
    if (r === 'envenenador') return `<p class="screen-help">🧪 Has envenenado a <strong>${esc(pk)}</strong> hasta el próximo amanecer.</p>`;
    if (r === 'monje' && mode === 'one') return `<p class="screen-help">🙏 Esta noche proteges a <strong>${esc(pk)}</strong>.</p>`;
    if (r === 'espia') return '<p class="results-label">El libro del pueblo</p>' + grimoire(g, names);
    if (r === 'demonio') return `<p class="screen-help">😈 ${evilTeam(g, i, names)}</p>`;
    if (g.info[i]) return infoBox(g, i, names);
    return '<p class="screen-help">😴 Duermes… o eso parece.</p>';
  }
  if (mode === 'look') {
    const label = r === 'demonio' ? 'Ver a los tuyos' : r === 'espia' ? 'Abrir el libro' : 'Ver mi información';
    return `<h3 class="night-title">${ROLES[r].emoji} ${ROLES[r].name}</h3><p class="screen-help">${esc(ROLES[r].goal)}</p>` +
      `<button type="button" class="btn btn-primary btn-large" ${actAttr({ t: 'night', target: -1 })}>${label}</button>`;
  }
  if (mode === 'kill') return heir + '<h3 class="night-title">😈 ¿A quién matas esta noche?</h3>' + pickButtons(g, i, names, aliveOthers, (k) => ({ t: 'night', target: k }));
  if (mode === 'two') {
    const sel = g.night.sel[i] || [];
    return `<h3 class="night-title">🔮 Elige a dos jugadores ${sel.length ? '· falta uno' : ''}</h3><p class="screen-help">Sabrás si alguno de los dos es el demonio. Pueden estar vivos o muertos.</p>` +
      pickButtons(g, i, names, others, (k) => (sel.includes(k) ? null : { t: 'night', target: k }), 'elegido');
  }
  if (mode === 'one') {
    const q = r === 'envenenador' ? '🧪 ¿A quién envenenas?' : r === 'monje' ? '🙏 ¿A quién proteges del demonio?' : '💭 ¿Con quién sueñas esta noche?';
    return `<h3 class="night-title">${q}</h3>` + pickButtons(g, i, names, aliveOthers, (k) => ({ t: 'night', target: k }));
  }
  return `<h3 class="night-title">😴 ${ROLES[r].emoji} ${ROLES[r].name}: esta noche duermes</h3><p class="screen-help">Toca a quien te parece más sospechoso. No cambia nada: es para que nadie note quién tiene algo que hacer.</p>` +
    pickButtons(g, i, names, aliveOthers, (k) => ({ t: 'night', target: k }));
}

function newsHtml(g, names) {
  const d = g.dawn;
  if (d.died != null) return `<div class="verdict is-lose"><span class="verdict-emoji" aria-hidden="true">🔔</span><h2 class="verdict-title">${esc(names[d.died])} ha muerto esta noche</h2><p class="verdict-text">Las campanas doblan por su alma. Sigue jugando como fantasma.</p></div>`;
  return `<div class="verdict"><span class="verdict-emoji" aria-hidden="true">🌄</span><h2 class="verdict-title">${g.day === 1 ? 'Primer amanecer' : 'Nadie ha muerto'}</h2><p class="verdict-text">${g.day === 1 ? 'El demonio aún no ha atacado. Contad lo que sabéis… o lo que os interese.' : 'Esta noche no ha muerto nadie. ¿Suerte o protección?'}</p></div>`;
}

function shotHtml(g, names) {
  const s = g.shot;
  if (!s) return '';
  return `<div class="verdict ${s.hit ? 'is-win' : ''}"><span class="verdict-emoji" aria-hidden="true">🏹</span><h2 class="verdict-title">${esc(names[s.by])} dispara a ${esc(names[s.target])}</h2><p class="verdict-text">${s.hit ? `¡${esc(names[s.target])} cae fulminado!` : 'No pasa nada.'}</p></div>`;
}

function chips(g, names) {
  return `<ul class="town-chips">${g.p.map((x, k) => `<li class="${x.a ? '' : 'is-dead'}">${x.a ? '' : x.gv ? '💀 ' : '👻 '}${esc(names[k])}</li>`).join('')}</ul>` +
    '<p class="setup-hint sala-center">👻 fantasma con su voto · 💀 ya lo gastó · se vota en el orden en que estáis sentados</p>';
}

function verdictHtml(g, names) {
  const v = g.verdict;
  if (v.reason === 'shot') return shotHtml(g, names);
  if (v.out != null) {
    return `<div class="verdict ${v.saint ? 'is-lose' : ''}"><span class="verdict-emoji" aria-hidden="true">⚖️</span><h2 class="verdict-title">El pueblo ejecuta a ${esc(names[v.out])}</h2><p class="verdict-text">${v.saint ? '¡Era el santo! Su muerte condena al pueblo.' : 'Su papel queda en secreto. Sigue jugando como fantasma.'}</p></div>`;
  }
  if (v.mayor) return '<div class="verdict is-win"><span class="verdict-emoji" aria-hidden="true">🎖️</span><h2 class="verdict-title">La alcaldesa salva al pueblo</h2><p class="verdict-text">Quedaban tres y nadie fue ejecutado.</p></div>';
  const text = v.reason === 'tie' ? 'Empate entre los más votados: no se ejecuta a nadie.' : v.reason === 'few' ? `Nadie llegó a ${v.need} votos, la mitad de los vivos.` : 'Nadie votó.';
  return `<div class="verdict"><span class="verdict-emoji" aria-hidden="true">🤝</span><h2 class="verdict-title">Hoy no se ejecuta a nadie</h2><p class="verdict-text">${text}</p></div>`;
}

function voteSummary(g, names) {
  const v = g.verdict;
  const rows = Object.keys(v.counts).map(Number).sort((a, b) => v.counts[b] - v.counts[a]).map((k) => `${esc(names[k])} ${v.counts[k]}`);
  if (v.none) rows.push(`Nadie ${v.none}`);
  return rows.length ? `<p class="vote-summary">Votos: ${rows.join(' · ')} · hacían falta ${v.need}</p>` : '';
}

function endHtml(g, names) {
  const town = g.winner === 'pueblo';
  return `<div class="verdict ${town ? 'is-win' : 'is-lose'}"><span class="verdict-emoji" aria-hidden="true">${town ? '🔔' : '😈'}</span>` +
    `<h2 class="verdict-title">${town ? '¡Gana el pueblo!' : '¡Gana el mal!'}</h2>` +
    `<p class="verdict-text">${town ? 'El demonio ha caído y las campanas vuelven a sonar.' : 'El demonio se ha salido con la suya.'}</p></div>` +
    `<div class="card reveal-box"><p class="results-label">Quién era quién</p>${grimoire(g, names)}</div>`;
}

function voteButtons(g, i, names) {
  const mine = g.votes[i];
  return '<div class="sala-votes">' + alive(g).map((k) =>
    `<button type="button" class="sala-vote${mine === k ? ' is-selected' : ''}" ${actAttr({ t: 'vote', target: k })}>${esc(names[k])}</button>`).join('') +
    `<button type="button" class="sala-vote is-none${mine === 'none' ? ' is-selected' : ''}" ${actAttr({ t: 'vote', target: 'none' })}>🙅 No voto</button></div>`;
}

function shootPicker(g, names) {
  if (g.shot) return '';
  const al = alive(g);
  return '<details class="fold"><summary>🏹 Disparo de la cazadora</summary><p class="setup-hint">Cualquiera puede decir que es la cazadora. Elegid quién dispara y a quién. Si no lo es, no pasa nada.</p>' +
    al.map((by) => `<p class="results-label">${esc(names[by])} dispara a…</p><div class="sala-votes">` +
      al.filter((k) => k !== by).map((k) => `<button type="button" class="sala-vote" ${actAttr({ t: 'shoot', by, target: k })}>${esc(names[k])}</button>`).join('') + '</div>').join('') +
    '</details>';
}

function seatHtml(names) {
  return `<details class="fold"><summary>🪑 Orden en el que os sentáis</summary><p class="setup-hint">Los vecinos importan: sentaos en círculo en este orden.</p><ol class="seat-list">${names.map((n) => `<li>${esc(n)}</li>`).join('')}</ol></details>`;
}

function render(ctx) {
  const { g, me, host, names } = ctx;
  const inGame = me >= 0 && me < g.p.length;
  const x = inGame ? g.p[me] : null;
  const count = (obj, ids) => ids.filter((k) => obj[k] != null).length;
  const spectator = '<p class="screen-help">👀 Has entrado con la partida empezada: mira y espera a la siguiente.</p>';
  const ghost = x && !x.a ? `<p class="setup-hint sala-center">👻 Has muerto, pero sigues jugando: hablas y ${x.gv ? 'ya gastaste tu voto' : 'te queda un voto para toda la partida'}.</p>` : '';

  switch (g.phase) {
    case 'reveal':
      if (ctx.local) return `<h2 class="reveal-player">${esc(names[me])}</h2>${ctx.card}`;
      return (inGame ? `<h2 class="reveal-player">${esc(names[me])}</h2><p class="reveal-warning">🤫 Que nadie más mire tu pantalla</p>${ctx.card}` +
          (g.ready[me] ? '<p class="screen-help">✅ Listo. Esperando a los demás…</p>' : `<button type="button" class="btn btn-secondary btn-large" ${actAttr({ t: 'ready' })}>Ya lo vi</button>`) : spectator) +
        seatHtml(names) +
        `<p class="sala-count">Listos <strong>${count(g.ready, all(g))}</strong> de ${g.p.length}</p>` +
        (host ? hostBtn({ t: 'night-start' }, 'Empezar la noche 🌙') : '');
    case 'night':
      return `<h2 class="screen-title">🌙 Noche ${g.day}</h2>` +
        (inGame ? (x.a ? nightPanel(g, me, names) : '<p class="screen-help">👻 Los fantasmas duermen de noche. No digas nada.</p>') : spectator) +
        (ctx.local ? '' : `<p class="sala-count">Han actuado <strong>${count(g.night.acts, alive(g))}</strong> de ${alive(g).length}</p>` +
          (host ? `<button type="button" class="btn btn-text" ${actAttr({ t: 'dawn' })}>Que amanezca ya</button>` : ''));
    case 'dawn': {
      const mine = inGame && g.info[me] ? `<p class="results-label">Lo que supiste anoche</p>${infoBox(g, me, names)}` : '';
      return `<h2 class="screen-title">☀️ Amanece · día ${g.day}</h2>${newsHtml(g, names)}${mine}${ghost}` +
        (host ? (g.winner ? hostBtn({ t: 'end' }, 'Ver el final') : hostBtn({ t: 'day' }, 'Empezar el día 🗣️')) : waitHost(ctx));
    }
    case 'day': {
      let shoot = '';
      if (ctx.local) shoot = shootPicker(g, names);
      else if (x && x.a && seemsRole(g, me) === 'cazadora' && !g.slay && !g.shot) {
        shoot = '<details class="fold"><summary>🏹 Disparar delante de todos</summary><div class="sala-votes">' +
          alive(g).filter((k) => k !== me).map((k) => `<button type="button" class="sala-vote" ${actAttr({ t: 'shoot', target: k })}>${esc(names[k])}</button>`).join('') + '</div></details>';
      }
      return `<h2 class="screen-title">🗣️ Día ${g.day}</h2><p class="screen-help">Hablad en grupo o a solas, mentid o decid la verdad. Para ejecutar hacen falta <strong>${Math.ceil(alive(g).length / 2)}</strong> votos.</p>${ghost}` +
        shotHtml(g, names) + chips(g, names) + ctx.timer + shoot +
        (host ? hostBtn({ t: 'to-vote' }, 'Votar 🗳️') : waitHost(ctx, `${ctx.hostName} abrirá la votación`));
    }
    case 'vote': {
      const need = Math.ceil(alive(g).length / 2);
      if (ctx.openVote) {
        const ghosts = all(g).filter((k) => !g.p[k].a && !g.p[k].gv);
        return `<h2 class="screen-title">¿A quién ejecuta el pueblo?</h2><p class="screen-help">Hacen falta <strong>${need}</strong> votos. Votan los vivos${ghosts.length ? ` y, si quieren gastar su único voto, los fantasmas (${list(ghosts, names)}). Quien lo gaste, que se acuerde` : ''}.</p>`;
      }
      let body;
      if (!inGame) body = spectator;
      else if (!canVote(g, me)) body = '<p class="screen-help">💀 Ya gastaste tu voto de fantasma.</p>';
      else body = `<p class="screen-help">${x.a ? `Vota desde tu móvil. Hacen falta ${need}.` : '👻 Si votas, gastas tu único voto de fantasma.'}</p>` + voteButtons(g, me, names);
      const voters = all(g).filter((k) => canVote(g, k));
      return '<h2 class="screen-title">¿A quién ejecuta el pueblo?</h2>' + body +
        (ctx.local ? '' : `<p class="sala-count">🗳️ Han votado <strong>${count(g.votes, voters)}</strong> de ${voters.length}</p>` +
          (host ? `<button type="button" class="btn btn-text" ${actAttr({ t: 'tally' })}>Hacer el recuento ya</button>` : ''));
    }
    case 'verdict':
      return verdictHtml(g, names) + voteSummary(g, names) +
        (host ? (g.winner ? hostBtn({ t: 'end' }, 'Ver el final') : hostBtn({ t: 'night-start' }, 'Llega la noche 🌙')) : waitHost(ctx));
    case 'end':
      return endHtml(g, names) + (host
        ? '<div class="results-actions"><button type="button" class="btn btn-primary btn-large" data-sala="again">Otra partida ▶</button>' +
          '<button type="button" class="btn btn-secondary btn-large" data-sala="lobby">Cambiar ajustes</button></div>'
        : waitHost(ctx, `Esperando a que ${ctx.hostName} empiece otra partida`));
    default:
      return '';
  }
}

const engine = {
  act, advance, privateTurn, render,
  card: (g, i, names) => (i >= 0 && i < g.p.length ? roleCard(g, i, names) : null),
  title: (g) => (g.phase === 'reveal' ? 'Reparto de papeles' : g.phase === 'end' ? 'Final' : `Día ${g.day}`),
  phaseKey: (g) => `${g.phase}-${g.day}`,
  fx: (g) => (g.phase === 'end' ? (g.winner === 'pueblo' ? 'win' : 'lose') : null),
  openVote: (g) => (g.phase === 'vote' && g.cfg.open ? {
    targets: alive(g), allowNone: true,
    onDone: ({ counts, none }) => resolveCounts(g, counts, none)
  } : null)
};

/* ------------------------------- Ajustes (DOM) ------------------------------- */

const el = {};
let game = null;

function cacheDom() {
  ['player-count-value', 'btn-player-minus', 'btn-player-plus', 'names-grid', 'btn-shuffle-names', 'role-summary',
    'time-value', 'timer-hint', 'btn-time-minus', 'btn-time-plus', 'opt-secret-vote', 'opt-sound', 'opt-vibrate',
    'btn-start-game', 'game-bar-title', 'btn-exit', 'play-root'
  ].forEach((id) => { el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id); });
}

function renderSetup() {
  const n = settings.playerCount;
  el.playerCountValue.textContent = String(n);
  el.btnPlayerMinus.disabled = n <= MIN_PLAYERS;
  el.btnPlayerPlus.disabled = n >= MAX_PLAYERS;
  Kit.renderNameInputs(el.namesGrid, n);
  el.optSecretVote.checked = settings.secretVote;
  const [t, o, m] = SETUP[n];
  el.roleSummary.textContent = `Pueblo ${t} · Forasteros ${o} · Esbirros ${m} · Demonio 1`;
  const idx = TIMER_OPTIONS.indexOf(settings.timerMinutes);
  el.timeValue.textContent = settings.timerMinutes ? `${settings.timerMinutes}′` : '—';
  el.timerHint.textContent = settings.timerMinutes ? 'Con cronómetro' : 'Sin cronómetro';
  el.btnTimeMinus.disabled = idx <= 0;
  el.btnTimePlus.disabled = idx >= TIMER_OPTIONS.length - 1;
}

function startLocalGame() {
  game = newGame(settings.playerCount, settings, true);
  Kit.keepAwake(true);
  Kit.showScreen('play');
  Mesa.start({
    root: el.playRoot, titleEl: el.gameBarTitle, engine, game, names: Kit.playerNames(settings.playerCount),
    secretVote: settings.secretVote, timerStep: TIMER_STEP, onAgain: startLocalGame, onSetup: backToSetup
  });
}

function backToSetup() {
  Mesa.stop();
  game = null;
  Kit.keepAwake(false);
  renderSetup();
  Kit.showScreen('setup');
}

/* --------------------------- Con código de sala ------------------------------ */

let salaBackup = null;

function salaHosting(on, players) {
  if (on) {
    if (!salaBackup) salaBackup = { playerCount: settings.playerCount };
    settings.playerCount = Kit.clamp(players, MIN_PLAYERS, MAX_PLAYERS);
  } else if (salaBackup) {
    settings.playerCount = salaBackup.playerCount;
    salaBackup = null;
  }
  renderSetup();
}

Sala.configure({
  id: 'campanario',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  timerStep: TIMER_STEP,
  holdPrompt: 'Mantén pulsado para ver tu papel',
  who: { one: 'demonio', many: 'demonios', One: 'Demonio', Many: 'Demonios', the: 'el demonio', The: 'El demonio' },
  hosting: salaHosting,
  custom: {
    start: (n) => newGame(n, settings, false),
    act: Mesa.autoAct(engine),
    render,
    card: engine.card,
    phaseKey: engine.phaseKey,
    phaseFx: (g, me) => {
      if (g.phase !== 'end') return null;
      const mine = me >= 0 && me < g.p.length ? (isEvil(roleOf(g, me)) ? 'mal' : 'pueblo') : 'pueblo';
      return mine === g.winner ? 'win' : 'lose';
    }
  }
});

/* --------------------------------- Eventos ----------------------------------- */

function bindEvents() {
  const change = (d) => { settings.playerCount = Kit.clamp(settings.playerCount + d, MIN_PLAYERS, MAX_PLAYERS); saveSettings(); renderSetup(); };
  el.btnPlayerMinus.addEventListener('click', () => change(-1));
  el.btnPlayerPlus.addEventListener('click', () => change(1));
  el.btnTimeMinus.addEventListener('click', () => { settings.timerMinutes = TIMER_OPTIONS[Math.max(0, TIMER_OPTIONS.indexOf(settings.timerMinutes) - 1)]; saveSettings(); renderSetup(); });
  el.btnTimePlus.addEventListener('click', () => { settings.timerMinutes = TIMER_OPTIONS[Math.min(TIMER_OPTIONS.length - 1, TIMER_OPTIONS.indexOf(settings.timerMinutes) + 1)]; saveSettings(); renderSetup(); });
  el.btnShuffleNames.addEventListener('click', () => { Kit.shuffleNames(el.namesGrid, settings.playerCount); Kit.toast('Orden mezclado 🔀'); });
  el.optSecretVote.addEventListener('change', () => { settings.secretVote = el.optSecretVote.checked; saveSettings(); });
  Kit.bindPrefToggle(el.optSound, 'sound');
  Kit.bindPrefToggle(el.optVibrate, 'vibrate');
  el.btnStartGame.addEventListener('click', () => {
    saveSettings();
    try { history.pushState({ inGame: true }, ''); } catch (err) { /* sin historial */ }
    startLocalGame();
  });
  el.btnExit.addEventListener('click', () => {
    if (!game || window.confirm('¿Salir de la partida? Se perderá la partida en curso.')) backToSetup();
  });
  window.addEventListener('popstate', () => {
    if (!game) return;
    if (window.confirm('¿Salir de la partida? Se perderá la partida en curso.')) backToSetup();
    else { try { history.pushState({ inGame: true }, ''); } catch (err) { /* sin historial */ } }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  loadSettings();
  bindEvents();
  renderSetup();
  Kit.showScreen('setup');
});
