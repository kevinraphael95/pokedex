/**
 * pokédex.js — Pokédex Pro
 * Architecture : data → fetch → render pipeline
 * Zero dependencies, vanilla ES2020+
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */

const TYPE_COLOR = {
  fire: '#e25822', water: '#2980b9', grass: '#27ae60', electric: '#f39c12',
  ice: '#74b9ff', fighting: '#c0392b', poison: '#8e44ad', ground: '#d35400',
  flying: '#81ecec', psychic: '#e91e96', bug: '#558b2f', rock: '#795548',
  ghost: '#4527a0', dragon: '#1565c0', dark: '#263238', steel: '#607d8b',
  fairy: '#e91e8c', normal: '#78909c',
};

const TYPE_FR = {
  normal: 'Normal', fire: 'Feu', water: 'Eau', grass: 'Plante',
  electric: 'Électrik', ice: 'Glace', fighting: 'Combat', poison: 'Poison',
  ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte',
  rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres',
  steel: 'Acier', fairy: 'Fée',
};

const STAT_LABEL = {
  hp: 'HP', attack: 'ATK', defense: 'DEF',
  'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'VIT',
};

const TIER_COLOR = {
  OU: '#e63946', UU: '#f4a261', RU: '#48cae4', NU: '#74b9ff',
  PU: '#a29bfe', Uber: '#ff6b6b', AG: '#ff6b6b', LC: '#55efc4', Unknown: '#888',
};

/** Defensive type chart — value = multiplier attacking type deals to defending type */
const DEF_CHART = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/** Offensive coverage — types hit super-effectively by attacking type */
const OFF_CHART = {
  fire:     ['grass', 'ice', 'bug', 'steel'],
  water:    ['fire', 'ground', 'rock'],
  grass:    ['water', 'ground', 'rock'],
  electric: ['water', 'flying'],
  ice:      ['grass', 'ground', 'flying', 'dragon'],
  fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
  poison:   ['grass', 'fairy'],
  ground:   ['fire', 'electric', 'poison', 'rock', 'steel'],
  flying:   ['grass', 'fighting', 'bug'],
  psychic:  ['fighting', 'poison'],
  bug:      ['grass', 'psychic', 'dark'],
  rock:     ['fire', 'ice', 'flying', 'bug'],
  ghost:    ['psychic', 'ghost'],
  dragon:   ['dragon'],
  dark:     ['psychic', 'ghost'],
  steel:    ['ice', 'rock', 'fairy'],
  fairy:    ['fighting', 'dragon', 'dark'],
};

const SMOGON_TIERS = [
  { id: 'gen9ou',   name: 'OU'   },
  { id: 'gen9uu',   name: 'UU'   },
  { id: 'gen9ru',   name: 'RU'   },
  { id: 'gen9nu',   name: 'NU'   },
  { id: 'gen9pu',   name: 'PU'   },
  { id: 'gen9uber', name: 'Uber' },
  { id: 'gen9lc',   name: 'LC'   },
];

const POKE_API  = 'https://pokeapi.co/api/v2';
const SMOGON_RAW = 'https://raw.githubusercontent.com/pkmn/smogon/main/data/sets';


/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */

const state = {
  activeTab : 'info',
  frMap     : {},
  frMapReady: false,
};


/* ─────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────── */

/** Unique values from array */
const uniq = (arr) => [...new Set(arr)];

/** html-escape for safety when injecting user-facing strings */
const esc = (str) => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Compute defensive matchup multipliers for a set of types */
function defMatchups(types) {
  const result = {};
  for (const t of types) {
    const row = DEF_CHART[t] || {};
    for (const [def, mult] of Object.entries(row)) {
      result[def] = (result[def] ?? 1) * mult;
    }
  }
  return result;
}

/** Compute offensive coverage (all types hit ×2 by at least one STAB) */
function offCoverage(types) {
  const covered = new Set();
  for (const t of types) {
    for (const def of (OFF_CHART[t] ?? [])) covered.add(def);
  }
  return [...covered];
}

/** Return bg/text color for matchup multiplier */
function multColors(m) {
  if (m === 0)    return { bg: 'rgba(0,0,0,0.5)',    text: '#555' };
  if (m === 0.25) return { bg: 'rgba(5,30,5,0.55)',  text: '#00cc55' };
  if (m === 0.5)  return { bg: 'rgba(8,25,8,0.5)',   text: '#27ae60' };
  if (m === 2)    return { bg: 'rgba(35,8,8,0.55)',  text: '#e67e22' };
  if (m === 4)    return { bg: 'rgba(55,3,3,0.6)',   text: '#e63946' };
  return { bg: 'rgba(0,0,0,0.3)', text: '#777' };
}


/* ─────────────────────────────────────────────────────────────
   API FETCHERS
───────────────────────────────────────────────────────────── */

/** Build French name → English slug map (runs in background) */
async function buildFrMap() {
  if (state.frMapReady) return;
  try {
    const res  = await fetch(`${POKE_API}/pokemon-species?limit=1025`);
    const data = await res.json();
    const chunks = [];
    for (let i = 0; i < data.results.length; i += 50) {
      chunks.push(data.results.slice(i, i + 50));
    }
    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (s) => {
        try {
          const sr = await fetch(s.url);
          const sd = await sr.json();
          const fr = sd.names.find((n) => n.language.name === 'fr');
          if (fr) state.frMap[fr.name.toLowerCase()] = s.name;
        } catch (_) {}
      }));
    }
    state.frMapReady = true;
  } catch (_) {}
}

/** Fetch Pokémon data + species data in parallel */
async function fetchPokemon(slug) {
  const [pokeRes, ] = await Promise.all([
    fetch(`${POKE_API}/pokemon/${slug}`),
  ]);
  if (!pokeRes.ok) throw new Error(`Not found: ${slug}`);
  const pokeData = await pokeRes.json();
  const specRes  = await fetch(pokeData.species.url);
  const specData = await specRes.json();
  return { pokeData, specData };
}

/** Fetch Smogon sets — tries each tier in order until a match is found */
async function fetchSmogon(name) {
  for (const { id, name: tierName } of SMOGON_TIERS) {
    try {
      const res = await fetch(`${SMOGON_RAW}/${id}.json`);
      if (!res.ok) continue;
      const data = await res.json();
      const key  = Object.keys(data).find((k) => k.toLowerCase() === name.toLowerCase());
      if (!key) continue;

      const sets = Object.entries(data[key]);
      const allMoves = [], allItems = [], allAbils = [], allNats = [];
      for (const [, s] of sets) {
        if (s.moves)     allMoves.push(...s.moves.flat());
        if (s.items)     allItems.push(...s.items);
        if (s.abilities) allAbils.push(...s.abilities);
        if (s.natures)   allNats.push(...s.natures);
      }

      return {
        tier    : tierName,
        sets    : sets.map(([n, s]) => ({ name: n, s })).slice(0, 4),
        moves   : uniq(allMoves).slice(0, 10),
        items   : uniq(allItems).slice(0, 6),
        abilities: uniq(allAbils).slice(0, 4),
        natures : uniq(allNats).slice(0, 4),
      };
    } catch (_) {}
  }
  return { tier: 'Unknown', sets: [], moves: [], items: [], abilities: [], natures: [] };
}

/** Fetch ability description (FR preferred, EN fallback) */
async function fetchAbilDesc(url) {
  try {
    const res  = await fetch(url);
    const data = await res.json();
    const entry = data.flavor_text_entries.find((e) => e.language.name === 'fr')
                ?? data.flavor_text_entries.find((e) => e.language.name === 'en');
    return entry ? entry.flavor_text.replace(/[\n\f]/g, ' ') : '';
  } catch (_) { return ''; }
}

/** Fetch evolution chain as ordered array of slugs */
async function fetchEvolution(specData) {
  try {
    const res  = await fetch(specData.evolution_chain.url);
    const data = await res.json();
    const chain = [];
    let node = data.chain;
    while (node) { chain.push(node.species.name); node = node.evolves_to[0] ?? null; }
    return chain;
  } catch (_) { return []; }
}

/** Fetch official artwork URL for a given Pokémon slug */
async function fetchSprite(slug) {
  try {
    const res  = await fetch(`${POKE_API}/pokemon/${slug}`);
    const data = await res.json();
    return data.sprites?.other?.['official-artwork']?.front_default ?? data.sprites?.front_default ?? '';
  } catch (_) { return ''; }
}


/* ─────────────────────────────────────────────────────────────
   RENDER HELPERS
───────────────────────────────────────────────────────────── */

function renderStatBar(stat, value) {
  const pct  = Math.round(value / 255 * 100);
  const color = value >= 100 ? '#69f0ae' : value >= 70 ? '#ffd54f' : '#e63946';
  return /* html */`
    <div class="stat-row">
      <div class="stat-lbl">${STAT_LABEL[stat] ?? stat}</div>
      <div class="stat-bar">
        <div class="stat-fill" style="width:0%;background:${color}" data-target="${pct}"></div>
      </div>
      <div class="stat-val">${value}</div>
    </div>
  `;
}

function renderMatchupTile(type, mult) {
  const { bg, text } = multColors(mult);
  return /* html */`
    <div class="matchup-tile" style="background:${bg}">
      <span class="matchup-mult" style="color:${text}">×${mult}</span>
      <span class="matchup-type">${TYPE_FR[type] ?? type}</span>
    </div>
  `;
}

function renderCoverageTile(type) {
  const col = TYPE_COLOR[type] ?? '#555';
  return /* html */`
    <div class="coverage-tile" style="background:${col}22;border-color:${col}44">
      <span class="coverage-eff" style="color:${col}">×2</span>
      <span class="coverage-type" style="color:rgba(255,255,255,.75)">${TYPE_FR[type] ?? type}</span>
    </div>
  `;
}

function renderSetCard({ name, s }) {
  const itemsHtml  = s.items    ? `<span style="color:rgba(255,255,255,.35)">Objet :</span> <span style="color:#f4a261">${esc(s.items.join(' / '))}</span><br>` : '';
  const abilsHtml  = s.abilities ? `<span style="color:rgba(255,255,255,.35)">Talent :</span> <span style="color:#ce93d8">${esc(s.abilities.join(' / '))}</span><br>` : '';
  const natsHtml   = s.natures  ? `<span style="color:rgba(255,255,255,.35)">Nature :</span> <span style="color:#ffd54f">${esc(s.natures.join(' / '))}</span>` : '';
  const movesHtml  = s.moves
    ? `<div class="badge-list">${s.moves.flat().slice(0, 8).map((m) => `<span class="badge badge--move">${esc(m)}</span>`).join('')}</div>`
    : '';
  return /* html */`
    <div class="set-card">
      <div class="set-name">${esc(name)}</div>
      <div class="set-details">${itemsHtml}${abilsHtml}${natsHtml}</div>
      ${movesHtml}
    </div>
  `;
}


/* ─────────────────────────────────────────────────────────────
   PANE RENDERERS
───────────────────────────────────────────────────────────── */

function renderPaneInfo({ pokeData, specData, abilDetails, frName, frDesc }) {
  const cat          = specData.genera?.find((g) => g.language.name === 'fr')?.genus ?? '';
  const genderRate   = specData.gender_rate;
  const captureRate  = specData.capture_rate;
  const happiness    = specData.base_happiness;
  const growthRate   = specData.growth_rate?.name ?? '—';
  const isLegendary  = specData.is_legendary;
  const isMythical   = specData.is_mythical;
  const isBaby       = specData.is_baby;

  let genderHtml = `<span style="color:rgba(255,255,255,.5)">Asexué</span>`;
  if (genderRate >= 0 && genderRate <= 8) {
    const f = Math.round(genderRate / 8 * 100);
    genderHtml = `<span class="gender-male">♂ ${100 - f}%</span>&nbsp;<span class="gender-female">♀ ${f}%</span>`;
  }

  const specialTag = isLegendary
    ? `<span class="special-tag special-tag--legendary">★ Légendaire</span>`
    : isMythical
      ? `<span class="special-tag special-tag--mythical">★ Fabuleux</span>`
      : isBaby
        ? `<span class="special-tag special-tag--baby">Bébé</span>`
        : '';

  const abilHtml = abilDetails.map(({ name, hidden, desc }) => /* html */`
    <div class="ability-item">
      <span class="ability-name">${esc(name)}</span>
      ${hidden ? '<span class="ability-hidden">CACHÉ</span>' : ''}
      ${desc ? `<div class="ability-desc">${esc(desc)}</div>` : ''}
    </div>
  `).join('');

  return /* html */`
    ${specialTag ? `<div>${specialTag}</div>` : ''}
    <div class="info-grid">
      <div class="info-tile"><div class="info-tile__lbl">TAILLE</div><div class="info-tile__val">${(pokeData.height / 10).toFixed(1)} m</div></div>
      <div class="info-tile"><div class="info-tile__lbl">POIDS</div><div class="info-tile__val">${(pokeData.weight / 10).toFixed(1)} kg</div></div>
      <div class="info-tile"><div class="info-tile__lbl">CAPTURE</div><div class="info-tile__val">${captureRate}</div></div>
      <div class="info-tile"><div class="info-tile__lbl">BONHEUR</div><div class="info-tile__val">${happiness ?? '—'}</div></div>
      <div class="info-tile"><div class="info-tile__lbl">CROISSANCE</div><div class="info-tile__val" style="font-size:var(--fz-pixel-xs)">${growthRate}</div></div>
      <div class="info-tile"><div class="info-tile__lbl">GENRE</div><div class="info-tile__val">${genderHtml}</div></div>
    </div>
    ${frDesc ? `<div class="section-title">Description</div><div class="desc-box">${esc(frDesc)}</div>` : ''}
    <div class="section-title">Talents</div>
    ${abilHtml}
  `;
}

function renderPaneCombat({ types }) {
  const defM   = defMatchups(types);
  const weakE  = Object.entries(defM).filter(([, m]) => m > 1).sort((a, b) => b[1] - a[1]);
  const resistE= Object.entries(defM).filter(([, m]) => m > 0 && m < 1).sort((a, b) => a[1] - b[1]);
  const immuneE= Object.entries(defM).filter(([, m]) => m === 0);
  const covTypes = offCoverage(types);
  const typeNames = types.map((t) => TYPE_FR[t] ?? t).join(' + ');

  return /* html */`
    ${weakE.length ? `
      <div class="section-title">Faiblesses</div>
      <div class="matchup-grid">${weakE.map(([t, m]) => renderMatchupTile(t, m)).join('')}</div>
    ` : ''}
    ${resistE.length ? `
      <div class="section-title">Résistances</div>
      <div class="matchup-grid">${resistE.map(([t, m]) => renderMatchupTile(t, m)).join('')}</div>
    ` : ''}
    ${immuneE.length ? `
      <div class="section-title">Immunités</div>
      <div class="matchup-grid">${immuneE.map(([t]) => renderMatchupTile(t, 0)).join('')}</div>
    ` : ''}
    <div class="section-title">Couverture offensive — STAB ${typeNames}</div>
    <div class="coverage-grid">
      ${covTypes.length
        ? covTypes.map(renderCoverageTile).join('')
        : `<span style="color:rgba(255,255,255,.3);font-size:var(--fz-ui-sm)">—</span>`}
    </div>
  `;
}

function renderPaneStrat({ smogonData }) {
  const { tier, sets, items, moves, natures } = smogonData;
  const tierColor = TIER_COLOR[tier] ?? '#888';

  return /* html */`
    <div class="tier-box">
      <div class="tier-letter" style="color:${tierColor}">${esc(tier)}</div>
      <div>
        <div class="tier-info-name">Tier Smogon</div>
        <div class="tier-info-sub">Format compétitif Gen 9</div>
      </div>
    </div>

    ${sets.length ? `
      <div class="section-title">Sets recommandés</div>
      ${sets.map(renderSetCard).join('')}
    ` : `<div class="desc-box">Aucune donnée Smogon pour ce Pokémon.</div>`}

    ${items.length ? `
      <div class="section-title">Objets populaires</div>
      <div class="badge-list">${items.map((i) => `<span class="badge badge--item">${esc(i)}</span>`).join('')}</div>
    ` : ''}

    ${moves.length ? `
      <div class="section-title">Moves clés</div>
      <div class="badge-list">${moves.map((m) => `<span class="badge badge--move">${esc(m)}</span>`).join('')}</div>
    ` : ''}

    ${natures.length ? `
      <div class="section-title">Natures</div>
      <div class="badge-list">${natures.map((n) => `<span class="badge badge--nature">${esc(n)}</span>`).join('')}</div>
    ` : ''}
  `;
}

async function renderPaneEvo({ specData }) {
  const chain = await fetchEvolution(specData);
  if (chain.length <= 1) {
    return `<div class="desc-box">Pas de chaîne d'évolution.</div>`;
  }
  const sprites = await Promise.all(chain.map(fetchSprite));
  const items = chain.map((slug, i) => /* html */`
    ${i > 0 ? '<span class="evo-arrow">→</span>' : ''}
    <div class="evo-mon" onclick="window.__dex.load('${slug}')">
      <img src="${sprites[i] ?? ''}" alt="${esc(slug)}" loading="lazy">
      <div class="evo-name">${esc(slug)}</div>
    </div>
  `).join('');

  return /* html */`
    <div class="section-title">Chaîne d'évolution</div>
    <div class="evo-chain">${items}</div>
  `;
}


/* ─────────────────────────────────────────────────────────────
   TAB CONTROLLER
───────────────────────────────────────────────────────────── */

function setTab(id) {
  state.activeTab = id;
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === id));
  document.querySelectorAll('.pane').forEach((el) => el.classList.toggle('active', el.id === `pane-${id}`));
}


/* ─────────────────────────────────────────────────────────────
   MAIN LOADER
───────────────────────────────────────────────────────────── */

async function loadPokemon(input) {
  const rawInput = input.trim();
  if (!rawInput) return;

  /* ── Resolve slug ── */
  let slug = rawInput.toLowerCase();
  if (!/^\d+$/.test(slug) && state.frMapReady) {
    slug = state.frMap[slug] ?? slug;
  }

  /* ── Reset UI ── */
  const sprite = document.getElementById('sprite');
  sprite.style.opacity = '0';
  sprite.src = '';
  document.getElementById('poke-id').textContent = '';
  document.getElementById('ms-name').textContent = '— — —';
  document.getElementById('ms-status').textContent = 'POKÉDEX';
  document.getElementById('ms-cat').textContent = '';
  document.getElementById('xp-fill').style.width = '0%';
  document.getElementById('type-row').innerHTML = '';
  document.getElementById('stats-section').innerHTML = '';
  ['info', 'combat', 'strat', 'evo'].forEach((t) => {
    document.getElementById(`pane-${t}`).innerHTML =
      `<div class="state-msg state-msg--loading">CHARGEMENT…</div>`;
  });
  document.getElementById('screen-wrap').classList.add('screen--loading');

  try {
    /* ── Fetch core data ── */
    const { pokeData, specData } = await fetchPokemon(slug);

    /* ── Extract common values ── */
    const frName = specData.names?.find((n) => n.language.name === 'fr')?.name ?? pokeData.name;
    const frDesc = (specData.flavor_text_entries?.find((e) => e.language.name === 'fr')?.flavor_text ?? '')
      .replace(/[\n\f]/g, ' ');
    const types  = pokeData.types.map((t) => t.type.name);
    const stats  = pokeData.stats;
    const total  = stats.reduce((acc, s) => acc + s.base_stat, 0);
    const spriteUrl = pokeData.sprites?.other?.['official-artwork']?.front_default
                   ?? pokeData.sprites?.front_default ?? '';

    /* ── Update mini-screen ── */
    document.getElementById('ms-status').textContent = `#${String(pokeData.id).padStart(4, '0')}`;
    document.getElementById('ms-name').textContent   = frName.toUpperCase();
    const cat = specData.genera?.find((g) => g.language.name === 'fr')?.genus ?? '';
    document.getElementById('ms-cat').textContent    = cat;
    document.getElementById('xp-fill').style.width  = `${Math.round(total / 720 * 100)}%`;

    /* ── Update left panel ── */
    document.getElementById('poke-id').textContent = `#${String(pokeData.id).padStart(4, '0')} — ${frName.toUpperCase()}`;

    document.getElementById('type-row').innerHTML = types
      .map((t) => `<span class="type-badge" style="background:${TYPE_COLOR[t] ?? '#555'}">${TYPE_FR[t] ?? t}</span>`)
      .join('');

    document.getElementById('stats-section').innerHTML =
      stats.map((s) => renderStatBar(s.stat.name, s.base_stat)).join('') +
      `<div class="stat-total">TOTAL ${total}</div>`;

    /* ── Sprite ── */
    sprite.src     = spriteUrl;
    sprite.onload  = () => {
      sprite.style.opacity = '1';
      document.getElementById('screen-wrap').classList.remove('screen--loading');
    };
    sprite.onerror = () => { document.getElementById('screen-wrap').classList.remove('screen--loading'); };

    /* ── Animate stat bars ── */
    requestAnimationFrame(() => {
      document.querySelectorAll('.stat-fill[data-target]').forEach((bar) => {
        bar.style.width = bar.dataset.target + '%';
      });
    });

    /* ── Parallel secondary fetches ── */
    const [smogonData, abilDetails] = await Promise.all([
      fetchSmogon(pokeData.name),
      Promise.all(pokeData.abilities.map(async (a) => ({
        name  : a.ability.name,
        hidden: a.is_hidden,
        desc  : await fetchAbilDesc(a.ability.url),
      }))),
    ]);

    /* ── Render panes ── */
    document.getElementById('pane-info').innerHTML = renderPaneInfo({
      pokeData, specData, abilDetails, frName, frDesc,
    });

    document.getElementById('pane-combat').innerHTML = renderPaneCombat({ types });

    document.getElementById('pane-strat').innerHTML = renderPaneStrat({ smogonData });

    /* Evo is async — render placeholder then fill */
    document.getElementById('pane-evo').innerHTML =
      `<div class="state-msg state-msg--loading">CHARGEMENT…</div>`;
    renderPaneEvo({ specData }).then((html) => {
      document.getElementById('pane-evo').innerHTML = html;
    });

    /* Re-trigger active tab so newly rendered pane is visible */
    setTab(state.activeTab);

  } catch (err) {
    console.error('[Pokédex]', err);
    document.getElementById('pane-info').innerHTML =
      `<div class="state-msg state-msg--error">INTROUVABLE<br><span style="font-size:var(--fz-pixel-xs);color:rgba(255,255,255,.3)">Essaie le nom anglais ou le #ID</span></div>`;
    document.getElementById('screen-wrap').classList.remove('screen--loading');
    const inp = document.getElementById('q');
    inp.classList.add('shake');
    inp.addEventListener('animationend', () => inp.classList.remove('shake'), { once: true });
  }
}


/* ─────────────────────────────────────────────────────────────
   PUBLIC API  (used by onclick handlers in HTML)
───────────────────────────────────────────────────────────── */

window.__dex = {
  load(slug) {
    document.getElementById('q').value = slug;
    loadPokemon(slug);
  },
  go() {
    loadPokemon(document.getElementById('q').value);
  },
  rand() {
    const id = Math.floor(Math.random() * 1010) + 1;
    document.getElementById('q').value = String(id);
    loadPokemon(String(id));
  },
  setTab,
};


/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  /* Start building FR name map in background */
  buildFrMap();

  /* Enter key on input */
  document.getElementById('q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.__dex.go();
  });

  /* Load default */
  loadPokemon('garchomp');
});
