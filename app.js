/* ═══════════════════════════════════════════════
   THE PUPPET SHED — Marketplace App Logic
   Bitcoin Puppets & O.P.I.U.M. Marketplace
   Data: Hiro (inscriptions) + Unisat (listings) + Ordiscan (stats)
   ═══════════════════════════════════════════════ */

// ═══ API CONFIG ═══
const HIRO_API = 'https://api.hiro.so/ordinals/v1';
const UNISAT_API = 'https://open-api.unisat.io';
const UNISAT_KEY = ''; // Get yours at developer.unisat.io
const ORDISCAN_API = 'https://api.ordiscan.com';
const ORDISCAN_KEY = ''; // Get yours at ordiscan.com/docs/api
const ORD_CONTENT = 'https://ordinals.com/content/';
const COLLECTIONS = {
  puppets: { slug: 'bitcoin-puppets', label: 'Puppets', insMin: 53105612, insMax: 55543825 },
  opium:   { slug: 'opium',           label: 'OPIUM',   insMin: 353182,   insMax: 671978 }
};

// ═══ STATE ═══
let ALL_NFTS = [];
let selectedNFT = null;
let walletConnected = false;
let sortBy = 'price-asc';
let filterCol = 'All';
let filterRarity = 'All';
let idleIdx = 0;
let bubbleTimer = null;
let typewriterTimer = null;
let introComplete = false;
let isLoading = true;
let loadError = null;
let btcUsd = 84000; // fallback, updated live

const RARITY_COLORS = {
  common: '#888', uncommon: '#4aa3ff', rare: '#a855f7',
  epic: '#F7931A', legendary: '#ff4488', mythic: '#ff6b2b',
  Common: '#888', Rare: '#4aa3ff', Epic: '#a855f7',
  Legendary: '#F7931A', Mythic: '#ff4488', Genesis: '#ff6b2b'
};

const RARITY_ORDER = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
  Common: 0, Rare: 1, Epic: 2, Legendary: 3, Mythic: 4, Genesis: 5
};

// ═══ PUPPET LORE DIALOGUE ═══
const IDLE_MSGS = [
  "Welcome to the Shed! Pick a puppet below...",
  "10,001 hand-drawn puppets. MS Paint. Inscribed forever.",
  "The Shed never closes. Community-powered forever.",
  "Every trade feeds the treasury. WE ALL RISE.",
  "O.P.I.U.M. — 777 hand puppets. The pink pipe calls...",
  "Two chairs. Coffee time. World peace. \u262e\ufe0f",
  "bj fren. That's how we say hello here.",
  "Le Puppeteer Fou drew these. Then vanished. Like Satoshi.",
  "Born in the Federal Wassies Discord. Inscribed on Bitcoin.",
  "All Rights Reversed. The Viral Public License lives here.",
  "From the fringes of the karmic grid...",
  "I was promised zero! And look at us now.",
  "$PUPS WORLD PEACE. A Rune born in this very shed.",
  "Culture > companies. Memes > roadmaps.",
  "The art and culture outlive the artist.",
  "Gran Autismo reporting for duty.",
  "Send them to zero! ...wait, they went up again.",
];

const NFT_MSGS = {
  Genesis: [
    "Only 777 O.P.I.U.M. exist. A true masterpiece.",
    "The pink pipe. Pure O.P.I.U.M. Inscribed March 2023.",
    "Ord Puppet Inu Undoxxed Millionaire. Say it with me.",
    "From the fringes of the karmic grid. Genesis holder."
  ],
  mythic: ["Among the rarest in the land!", "Few have owned a Mythic. Even fewer held."],
  legendary: ["Legendary. Changes a whole collection.", "Diamond hands required. Not financial advice."],
  epic: ["An epic find! *chef's kiss*", "THIS one has character. I can feel it."],
  rare: ["A rare gem. Smart collectors know.", "Not everyone sees it. But you do, fren."],
  uncommon: ["Uncommon vibes. You have taste, fren.", "The in-between. Not common, not rare. Just right."],
  common: ["Every collection starts somewhere. This is the way.", "Don't sleep on Commons. The floor is lava."]
};

// ═══ API HELPERS ═══
async function fetchJSON(url, opts = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429) {
        const wait = (attempt + 1) * 3000;
        console.warn(`Rate limited on ${url}, retrying in ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function fetchBTCPrice() {
  try {
    const data = await fetchJSON('https://api.coindesk.com/v1/bpi/currentprice/USD.json');
    btcUsd = data?.bpi?.USD?.rate_float || 84000;
  } catch { /* keep fallback */ }
}

function satsTobtc(sats) {
  return (sats / 1e8);
}

function formatBTC(sats) {
  const btc = sats / 1e8;
  if (btc >= 1) return btc.toFixed(3);
  if (btc >= 0.1) return btc.toFixed(4);
  return btc.toFixed(5);
}

// Map sat rarity to display label
function mapRarity(satRarity, col) {
  if (col === 'OPIUM') return 'Genesis';
  if (!satRarity) return 'common';
  return satRarity; // common, uncommon, rare, epic, legendary, mythic
}

// Get the image URL for an inscription
function getImageURL(inscriptionId) {
  return ORD_CONTENT + inscriptionId;
}

// ═══ FETCH REAL DATA ═══
async function fetchCollectionStats() {
  if (!ORDISCAN_KEY) {
    console.warn('Ordiscan API key not set — stats will show defaults. Get one at ordiscan.com/docs/api');
    return null;
  }

  const headers = { Authorization: `Bearer ${ORDISCAN_KEY}` };
  try {
    const [puppetStats, opiumStats] = await Promise.all([
      fetchJSON(`${ORDISCAN_API}/v1/collection/bitcoin-puppets/market`, { headers }),
      fetchJSON(`${ORDISCAN_API}/v1/collection/opium/market`, { headers })
    ]);

    const floorEl = document.getElementById('stat-floor');
    const opiumEl = document.getElementById('stat-opium');

    if (floorEl && puppetStats.floor_price_in_sats) {
      floorEl.textContent = formatBTC(puppetStats.floor_price_in_sats) + '\u20bf';
    }
    if (opiumEl && opiumStats.floor_price_in_sats) {
      opiumEl.textContent = formatBTC(opiumStats.floor_price_in_sats) + '\u20bf';
    }

    return { puppetStats, opiumStats };
  } catch (err) {
    console.warn('Failed to fetch collection stats from Ordiscan:', err);
    return null;
  }
}

// ═══ HIRO API — reliable, CORS-friendly, no key needed ═══
async function fetchPuppetsFromHiro(offset = 0, limit = 60) {
  try {
    const insMin = COLLECTIONS.puppets.insMin + offset;
    const url = `${HIRO_API}/inscriptions?from_number=${insMin}&to_number=${insMin + limit * 2}&limit=${limit}&mime_type=image/webp&order=asc`;
    const data = await fetchJSON(url);
    const results = data.results || [];

    return results.map(t => {
      const meta = t.metadata || {};
      return {
        id: t.id,
        inscriptionId: t.id,
        inscriptionNumber: t.number,
        name: meta.name || `Bitcoin Puppet #${t.number}`,
        price: 0,
        priceBTC: 0,
        rarity: t.sat_rarity || 'common',
        traits: (meta.attributes || []).map(a => a.value).filter(Boolean).slice(0, 6),
        col: 'Puppets',
        imageUrl: getImageURL(t.id),
        contentType: t.content_type || 'image/webp',
        owner: t.address || '',
        listed: false
      };
    });
  } catch (err) {
    console.warn('Hiro fetch failed:', err);
    return [];
  }
}

// ═══ UNISAT LISTINGS ═══
async function fetchUnisatListings(collectionId, label, limit = 80) {
  if (!UNISAT_KEY) return [];

  try {
    const data = await fetchJSON(`${UNISAT_API}/v3/market/collection/auction/list`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UNISAT_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        collectionId,
        limit,
        offset: 0,
        sort: 'price_asc'
      })
    });

    const items = data?.data?.list || [];
    return items.map(t => {
      const insId = t.inscriptionId || t.nftId || '';
      const priceSats = t.price || 0;
      return {
        id: insId,
        inscriptionId: insId,
        inscriptionNumber: t.inscriptionNumber || 0,
        name: t.name || `${label} #${t.inscriptionNumber || '?'}`,
        price: priceSats,
        priceBTC: satsTobtc(priceSats),
        rarity: mapRarity(t.satRarity || t.sat_rarity, label),
        traits: [],
        col: label,
        imageUrl: insId ? getImageURL(insId) : '',
        contentType: 'image/webp',
        owner: t.owner || t.address || '',
        listed: priceSats > 0
      };
    });
  } catch (err) {
    console.warn(`Unisat fetch failed for ${collectionId}:`, err);
    return [];
  }
}

async function upgradeWithPrices() {
  if (!UNISAT_KEY) {
    console.warn('Unisat API key not set — prices unavailable. Get one at developer.unisat.io');
    return;
  }

  try {
    // Fetch puppet listings from Unisat
    const puppetListings = await fetchUnisatListings('bitcoin-puppets', 'Puppets', 80);
    if (puppetListings.length > 0) {
      const existingIds = new Set(ALL_NFTS.map(n => n.id));
      const priceMap = new Map(puppetListings.map(n => [n.id, n]));

      // Merge prices into existing NFTs
      ALL_NFTS = ALL_NFTS.map(n => {
        const listed = priceMap.get(n.id);
        return listed ? { ...n, price: listed.price, priceBTC: listed.priceBTC, listed: true } : n;
      });

      // Add any new listed NFTs we didn't have
      const newListings = puppetListings.filter(n => !existingIds.has(n.id));
      ALL_NFTS = [...ALL_NFTS, ...newListings];
    }

    // Stagger to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));

    // Fetch OPIUM listings
    const opiumListings = await fetchUnisatListings('opium', 'OPIUM', 30);
    if (opiumListings.length > 0) {
      opiumListings.forEach(n => { n.rarity = 'Genesis'; });
      ALL_NFTS = [...ALL_NFTS, ...opiumListings];
    }

    console.log(`Upgraded with Unisat prices: ${puppetListings.length} puppets, ${opiumListings.length} OPIUM`);
    renderGrid();
  } catch (err) {
    console.log('Price upgrade skipped (Unisat unavailable):', err.message);
  }
}

async function loadAllNFTs() {
  isLoading = true;
  loadError = null;
  renderGrid(); // show skeleton loading state

  // Strategy 1: Load from Hiro first (reliable, always works)
  console.log('Loading puppets from Hiro...');
  const batch1 = await fetchPuppetsFromHiro(0, 60);

  if (batch1.length > 0) {
    ALL_NFTS = batch1;
    isLoading = false;
    loadError = null;
    renderGrid();
    console.log(`Hiro batch 1: ${batch1.length} puppets`);

    // Load more in the background
    (async () => {
      try {
        const batch2 = await fetchPuppetsFromHiro(120, 60);
        if (batch2.length > 0) {
          ALL_NFTS = [...ALL_NFTS, ...batch2];
          renderGrid();
          console.log(`Hiro batch 2: +${batch2.length} puppets (total: ${ALL_NFTS.length})`);
        }
      } catch (e) { /* ok */ }
    })();

    // Upgrade with Unisat prices in background
    setTimeout(() => upgradeWithPrices(), 3000);
    fetchCollectionStats();
    return;
  }

  // Hiro failed
  loadError = 'APIs are busy. Click retry or refresh in a moment.';
  isLoading = false;
  renderGrid();
}

// ═══ BUBBLE SYSTEM ═══
function showBubble(msg, duration = 5000, instant = false) {
  const b = document.getElementById('char-bubble');
  if (!b) return;

  clearTimeout(bubbleTimer);
  clearTimeout(typewriterTimer);

  if (instant) {
    b.textContent = msg;
    b.classList.add('show');
    bubbleTimer = setTimeout(() => b.classList.remove('show'), duration);
    return;
  }

  // Typewriter
  b.innerHTML = '<span class="bubble-cursor"></span>';
  b.classList.add('show');

  let idx = 0;
  const chars = [...msg];

  function typeNext() {
    if (idx >= chars.length) {
      setTimeout(() => { b.textContent = msg; }, 300);
      bubbleTimer = setTimeout(() => b.classList.remove('show'), duration);
      return;
    }
    const ch = chars[idx];
    const cursor = b.querySelector('.bubble-cursor');
    if (cursor) cursor.insertAdjacentText('beforebegin', ch);
    else b.textContent += ch;
    idx++;

    let delay = 28;
    if ('.!?'.includes(ch)) delay = 220;
    else if (',;:'.includes(ch)) delay = 110;

    typewriterTimer = setTimeout(typeNext, delay);
  }

  typewriterTimer = setTimeout(typeNext, 28);
}

function startIdleCycle() {
  setInterval(() => {
    if (!selectedNFT && introComplete) {
      showBubble(IDLE_MSGS[idleIdx], 7000);
      idleIdx = (idleIdx + 1) % IDLE_MSGS.length;
    }
  }, 12000);
}

// ═══ NFT CARD RENDERING ═══
function renderGrid() {
  const grid = document.getElementById('nft-grid');
  const empty = document.getElementById('nft-empty');
  const count = document.getElementById('filter-count');
  if (!grid) return;

  // Loading state
  if (isLoading) {
    grid.innerHTML = Array.from({ length: 12 }, (_, i) =>
      `<div class="nft-card skeleton" style="animation-delay:${i * 60}ms">
        <div class="nft-card-frame"><div class="nft-card-img-wrap"><div class="skeleton-img"></div></div></div>
        <div class="nft-card-info"><div class="skeleton-text"></div><div class="skeleton-text short"></div></div>
      </div>`
    ).join('');
    if (count) count.textContent = '...';
    if (empty) empty.style.display = 'none';
    return;
  }

  // Error state
  if (loadError && ALL_NFTS.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:60px 20px;">
        <div style="font-size:2rem; margin-bottom:12px;">\ud83c\udfad</div>
        <div style="color:rgba(255,255,255,0.5); font-family:var(--font-hand); font-size:1rem; margin-bottom:16px;">${loadError}</div>
        <button onclick="loadAllNFTs()" style="background:var(--orange); color:#000; border:none; padding:10px 28px; border-radius:8px; font-family:var(--font-display); font-size:0.85rem; cursor:pointer; letter-spacing:0.05em;">RETRY</button>
      </div>`;
    if (empty) empty.style.display = 'none';
    return;
  }

  let filtered = ALL_NFTS
    .filter(n => filterCol === 'All' || n.col === filterCol)
    .filter(n => {
      if (filterRarity === 'All') return true;
      return n.rarity.toLowerCase() === filterRarity.toLowerCase();
    });

  if (sortBy === 'price-asc') filtered.sort((a, b) => {
    const aListed = a.price > 0 ? 0 : 1;
    const bListed = b.price > 0 ? 0 : 1;
    if (aListed !== bListed) return aListed - bListed;
    return a.price - b.price;
  });
  else if (sortBy === 'price-desc') filtered.sort((a, b) => {
    const aListed = a.price > 0 ? 0 : 1;
    const bListed = b.price > 0 ? 0 : 1;
    if (aListed !== bListed) return aListed - bListed;
    return b.price - a.price;
  });
  else filtered.sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));

  if (count) count.textContent = filtered.length;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (empty) { empty.style.display = 'block'; empty.textContent = 'Nothing here. \ud83c\udfad'; }
    return;
  }

  if (empty) empty.style.display = 'none';

  grid.innerHTML = filtered.map((nft, i) => {
    const isGenesis = nft.col === 'OPIUM';
    const isActive = selectedNFT && selectedNFT.id === nft.id;
    const rc = RARITY_COLORS[nft.rarity] || '#888';
    const displayRarity = nft.rarity.charAt(0).toUpperCase() + nft.rarity.slice(1);
    const isListed = nft.price > 0;
    const displayPrice = isListed ? formatBTC(nft.price) + '\u20bf' : 'Unlisted';

    return `
      <div class="nft-card ${isActive ? 'active' : ''}" data-id="${nft.id}" style="animation-delay:${i * 30}ms; ${isActive ? `border-color:${rc}50; box-shadow: 0 0 20px ${rc}15` : ''}">
        <div class="nft-card-frame ${isGenesis ? 'gold' : ''}">
          <div class="nft-card-img-wrap">
            <img class="nft-card-img" src="${nft.imageUrl}" alt="${nft.name}" loading="lazy" onerror="this.style.display='none'">
            <div class="nft-card-dot" style="background:${rc}; box-shadow: 0 0 5px ${rc}66"></div>
            ${isListed ? '<div class="nft-card-listed">LISTED</div>' : ''}
          </div>
        </div>
        <div class="nft-card-info">
          <div class="nft-card-name">${nft.name}</div>
          <div class="nft-card-bottom">
            <span class="nft-card-price ${isListed ? '' : 'unlisted'}">${displayPrice}</span>
            <span class="nft-card-rarity" style="color:${rc}; border-color:${rc}25; background:${rc}08">${displayRarity}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach click handlers
  grid.querySelectorAll('.nft-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const nft = ALL_NFTS.find(n => n.id === id);
      if (nft) selectNFT(nft);
    });
  });
}

// ═══ RPG DIALOGUE SYSTEM ═══
let rpgTyping = false;
let rpgTypeTimer = null;

function buildShopkeeperDialogue(nft) {
  const displayRarity = nft.rarity.charAt(0).toUpperCase() + nft.rarity.slice(1);
  const isListed = nft.price > 0;
  const priceBtc = formatBTC(nft.price);
  const priceUsd = Math.round((nft.price / 1e8) * btcUsd).toLocaleString();

  // Rarity-based intro
  const intros = {
    common: ["Ah, a solid pick!", "Classic choice, fren.", "Every collection starts here."],
    uncommon: ["Ooh, not bad!", "You've got an eye for this.", "Uncommon vibes!"],
    rare: ["Now we're talking!", "A rare gem right here.", "Smart collectors know."],
    epic: ["Whoa, epic find!", "THIS one has character.", "Now that's a keeper!"],
    legendary: ["A LEGENDARY piece!", "Few have held one of these.", "Diamond hands required."],
    mythic: ["Among the rarest in the land!", "A mythic! *chef's kiss*", "You found something special."],
    Genesis: ["Pure O.P.I.U.M.!", "Only 777 exist. A masterpiece.", "From the fringes of the karmic grid."]
  };

  const rarKey = nft.col === 'OPIUM' ? 'Genesis' : nft.rarity;
  const introPool = intros[rarKey] || intros.common;
  const intro = introPool[Math.abs(hashStr(nft.id)) % introPool.length];

  let msg = `${intro} ${nft.name} — ${displayRarity}.`;

  if (isListed) {
    msg += ` Going for ${priceBtc}\u20bf — that's about $${priceUsd}.`;
  } else {
    msg += ` Not listed right now... but you could make an offer!`;
  }

  return msg;
}

function showRPGDialogue(nft) {
  const dialogue = document.getElementById('rpg-dialogue');
  const textEl = document.getElementById('rpg-text');
  const choicesEl = document.getElementById('rpg-choices');
  const advanceEl = document.getElementById('rpg-advance');
  if (!dialogue || !textEl) return;

  // Reset
  clearTimeout(rpgTypeTimer);
  textEl.innerHTML = '';
  choicesEl.classList.remove('show');
  choicesEl.innerHTML = '';
  advanceEl.classList.remove('show');
  dialogue.classList.add('show');
  rpgTyping = true;

  // Hide the idle speech bubble during RPG dialogue
  const bubble = document.getElementById('char-bubble');
  if (bubble) bubble.classList.remove('show');

  const msg = buildShopkeeperDialogue(nft);
  const chars = [...msg];
  let idx = 0;

  function typeNext() {
    if (idx >= chars.length) {
      rpgTyping = false;
      // Show choices after typing finishes
      setTimeout(() => showRPGChoices(nft), 200);
      return;
    }
    const ch = chars[idx];
    textEl.textContent += ch;
    idx++;

    let delay = 22;
    if ('.!?'.includes(ch)) delay = 180;
    else if (',;:—'.includes(ch)) delay = 90;

    rpgTypeTimer = setTimeout(typeNext, delay);
  }

  rpgTypeTimer = setTimeout(typeNext, 100);
}

function showRPGChoices(nft) {
  const choicesEl = document.getElementById('rpg-choices');
  if (!choicesEl) return;

  const isListed = nft.price > 0;
  const priceBtc = formatBTC(nft.price);

  let choicesHTML = '';

  if (isListed) {
    choicesHTML += `<button class="rpg-choice" data-action="buy">
      <span class="rpg-arrow">\u25b6</span>
      <span class="rpg-choice-label">Buy for ${priceBtc}\u20bf</span>
    </button>`;
  }

  choicesHTML += `<button class="rpg-choice" data-action="offer">
    <span class="rpg-arrow">\u25b6</span>
    <span class="rpg-choice-label">Make an Offer</span>
  </button>`;

  choicesHTML += `<button class="rpg-choice" data-action="look">
    <span class="rpg-arrow">\u25b6</span>
    <span class="rpg-choice-label">Just Looking</span>
  </button>`;

  choicesEl.innerHTML = choicesHTML;
  choicesEl.classList.add('show');

  // Wire up choice actions
  choicesEl.querySelectorAll('.rpg-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'buy') {
        hideRPGDialogue();
        if (!walletConnected) { openWalletModal(); return; }
        openBuyDrawer(nft);
      } else if (action === 'offer') {
        hideRPGDialogue();
        if (!walletConnected) { openWalletModal(); return; }
        showBubble("Offers coming soon, fren!", 2500, true);
      } else {
        hideRPGDialogue();
        deselectNFT();
        showBubble("Take your time! I'll be right here.", 3000, true);
      }
    });
  });
}

function hideRPGDialogue() {
  clearTimeout(rpgTypeTimer);
  rpgTyping = false;
  const dialogue = document.getElementById('rpg-dialogue');
  if (dialogue) dialogue.classList.remove('show');
}

// ═══ NFT SELECTION ═══
function selectNFT(nft) {
  if (selectedNFT && selectedNFT.id === nft.id) {
    deselectNFT();
    return;
  }

  selectedNFT = nft;

  // Update 3D scene — load real image onto CRT
  if (window._sceneManager) {
    window._sceneManager.setSelectedNFT(nft);
    window._sceneManager.loadNFTImage(nft.imageUrl);
  }

  // Show RPG dialogue (the shopkeeper speaks!)
  showRPGDialogue(nft);

  // Highlight active card
  updateActiveCard();

  // Scroll to top of scene on mobile
  if (window.innerWidth < 768) {
    document.getElementById('scene-container').scrollIntoView({ behavior: 'smooth' });
  }
}

function deselectNFT() {
  selectedNFT = null;
  hideRPGDialogue();

  if (window._sceneManager) {
    window._sceneManager.setSelectedNFT(null);
  }

  updateActiveCard();
}

// Toggle active card highlight without re-rendering the grid
function updateActiveCard() {
  const grid = document.getElementById('nft-grid');
  if (!grid) return;
  grid.querySelectorAll('.nft-card').forEach(card => {
    const isActive = selectedNFT && card.dataset.id === selectedNFT.id;
    card.classList.toggle('active', isActive);
    if (isActive) {
      const rc = RARITY_COLORS[selectedNFT.rarity] || '#888';
      card.style.borderColor = rc + '50';
      card.style.boxShadow = `0 0 20px ${rc}15`;
    } else {
      card.style.borderColor = '';
      card.style.boxShadow = '';
    }
  });
}

// Simple string hash for deterministic msg selection
function hashStr(s) {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

// ═══ FILTER LOGIC ═══
function initFilters() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;

  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    if (chip.dataset.sort) {
      sortBy = chip.dataset.sort;
      bar.querySelectorAll('[data-sort]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    } else if (chip.dataset.col) {
      filterCol = chip.dataset.col;
      bar.querySelectorAll('[data-col]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    } else if (chip.dataset.rarity) {
      filterRarity = chip.dataset.rarity;
      bar.querySelectorAll('[data-rarity]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    }

    renderGrid();
  });
}

// ═══ WALLET ═══
function openWalletModal() {
  const modal = document.getElementById('wallet-modal');
  const list = document.getElementById('wallet-modal-list');
  if (!modal || !list) return;

  const wallets = window._wallet.detect();
  list.innerHTML = wallets.map(w => {
    const isRec = w.recommended;
    const installed = w.installed;
    return `
    <div class="wallet-option ${installed ? '' : 'disabled'} ${isRec ? 'recommended' : ''}" data-wallet="${w.key}" style="${isRec && installed ? `border-color: ${w.accent}30` : ''}">
      ${isRec ? '<span class="wallet-rec-badge">RECOMMENDED</span>' : ''}
      <div class="wallet-option-icon" style="${isRec ? `background: ${w.accent}12` : ''}">${w.icon}</div>
      <div class="wallet-option-info">
        <div class="wallet-option-name" style="${isRec && installed ? `color: ${w.accent}` : ''}">${w.name}</div>
        <div class="wallet-option-status">${installed ? (isRec ? 'BTC + SOL + ETH in one wallet' : 'Ready to connect') : 'Not installed — click to get'}</div>
      </div>
      <div class="wallet-option-arrow">${installed ? '→' : '↗'}</div>
    </div>`;
  }).join('');

  // Click handlers
  list.querySelectorAll('.wallet-option:not(.disabled)').forEach(el => {
    el.addEventListener('click', async () => {
      const key = el.dataset.wallet;
      try {
        el.querySelector('.wallet-option-status').textContent = 'Connecting...';
        await window._wallet.connect(key);
        closeWalletModal();
        updateWalletUI();
        showBubble("Wallet connected! Let's go, fren.", 3000, true);
      } catch (err) {
        el.querySelector('.wallet-option-status').textContent = err.message || 'Connection failed';
      }
    });
  });

  // Install links for disabled wallets
  list.querySelectorAll('.wallet-option.disabled').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.wallet;
      const w = wallets.find(ww => ww.key === key);
      if (w && w.installUrl) window.open(w.installUrl, '_blank');
    });
  });

  modal.style.display = 'flex';
}

function closeWalletModal() {
  const modal = document.getElementById('wallet-modal');
  if (modal) modal.style.display = 'none';
}

function updateWalletUI() {
  const btn = document.getElementById('wallet-btn');
  if (!btn) return;

  walletConnected = window._wallet.isConnected();
  if (walletConnected) {
    const state = window._wallet.getState();
    btn.textContent = window._wallet.truncateAddress(state.address);
    btn.classList.add('connected');
  } else {
    btn.textContent = 'CONNECT';
    btn.classList.remove('connected');
  }

  // Enable/disable buy buttons
  const buyBtn = document.getElementById('btn-buy');
  const offerBtn = document.getElementById('btn-offer');
  if (buyBtn) buyBtn.disabled = !walletConnected;
  if (offerBtn) offerBtn.disabled = !walletConnected;
}

function initWallet() {
  const btn = document.getElementById('wallet-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (window._wallet.isConnected()) {
      window._wallet.disconnect();
      updateWalletUI();
      showBubble("See you soon, fren!", 2000, true);
    } else {
      openWalletModal();
    }
  });

  // Close modal
  const closeBtn = document.getElementById('wallet-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeWalletModal);

  const overlay = document.getElementById('wallet-modal');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeWalletModal();
    });
  }

  // Auto-reconnect
  if (window._wallet) {
    window._wallet.tryReconnect().then(() => updateWalletUI());
  }
}

// ═══ TX STATUS TOAST ═══
function showTxToast(msg, type = '', duration = 4000) {
  const toast = document.getElementById('tx-toast');
  const msgEl = document.getElementById('tx-toast-msg');
  const iconEl = document.getElementById('tx-toast-icon');
  if (!toast || !msgEl) return;

  toast.className = 'tx-toast' + (type ? ` ${type}` : '');
  msgEl.textContent = msg;
  if (iconEl) {
    if (type === 'success') iconEl.textContent = '\u2713';
    else if (type === 'error') iconEl.textContent = '\u2717';
    else iconEl.textContent = '\u23f3';
  }
  toast.style.display = 'flex';

  clearTimeout(toast._hideTimer);
  if (duration > 0) {
    toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
  }
}

// ═══ BUY DRAWER FLOW ═══
let drawerNFT = null;
let drawerStep = 'review'; // review | sign | done

function openBuyDrawer(nft) {
  if (!nft) return;
  drawerNFT = nft;
  drawerStep = 'review';

  const drawer = document.getElementById('buy-drawer');
  if (!drawer) return;

  // Populate NFT info
  const img = document.getElementById('drawer-nft-img');
  if (img) { img.src = nft.imageUrl; img.alt = nft.name; }
  document.getElementById('drawer-nft-name').textContent = nft.name;
  document.getElementById('drawer-nft-col').textContent = nft.col;

  const rc = RARITY_COLORS[nft.rarity] || '#888';
  const rarEl = document.getElementById('drawer-nft-rarity');
  const displayRarity = nft.rarity.charAt(0).toUpperCase() + nft.rarity.slice(1);
  rarEl.textContent = displayRarity;
  rarEl.style.color = rc;
  rarEl.style.borderColor = rc + '40';
  rarEl.style.background = rc + '15';

  // Populate price breakdown
  const priceBTC = nft.priceBTC || (nft.price / 1e8);
  const shedFee = priceBTC * 0.02;
  const netFee = 0.00015;
  const total = priceBTC + shedFee + netFee;

  document.getElementById('drawer-price').textContent = priceBTC.toFixed(5) + ' BTC';
  document.getElementById('drawer-shedfee').textContent = shedFee.toFixed(5) + ' BTC';
  document.getElementById('drawer-netfee').textContent = '~' + netFee.toFixed(5) + ' BTC';
  document.getElementById('drawer-total').textContent = total.toFixed(5) + ' BTC';
  document.getElementById('drawer-total-usd').textContent = '\u2248 $' + Math.round(total * btcUsd).toLocaleString();

  // Reset steps
  setDrawerStep('review');
  drawer.style.display = 'flex';
}

function closeBuyDrawer() {
  const drawer = document.getElementById('buy-drawer');
  if (drawer) drawer.style.display = 'none';
  drawerNFT = null;
  drawerStep = 'review';
}

function setDrawerStep(step) {
  drawerStep = step;

  // Update stepper dots
  const steps = ['review', 'sign', 'done'];
  const stepIdx = steps.indexOf(step);
  document.querySelectorAll('#tx-stepper .tx-step').forEach((el, i) => {
    el.classList.toggle('active', i === stepIdx);
    el.classList.toggle('done', i < stepIdx);
  });

  // Update stepper lines
  document.querySelectorAll('#tx-stepper .tx-step-line').forEach((el, i) => {
    el.classList.toggle('active', i === stepIdx - 1);
    el.classList.toggle('done', i < stepIdx - 1);
  });

  // Show/hide step panels
  document.getElementById('drawer-step-review').style.display = step === 'review' ? 'block' : 'none';
  document.getElementById('drawer-step-sign').style.display = step === 'sign' ? 'block' : 'none';
  document.getElementById('drawer-step-done').style.display = step === 'done' ? 'block' : 'none';
}

async function executeBuy() {
  if (!drawerNFT) return;

  const cta = document.getElementById('drawer-cta');
  cta.disabled = true;

  // Step: Signing
  setDrawerStep('sign');
  const walletName = window._wallet.getProviderName() || 'wallet';
  document.getElementById('signing-title').textContent = 'Confirm in ' + walletName.charAt(0).toUpperCase() + walletName.slice(1);

  try {
    if (window._marketAPI && window._marketAPI.hasApiKey()) {
      const result = await window._marketAPI.buyNow(drawerNFT.inscriptionId);
      showBuySuccess(result.txId);
    } else {
      // Demo mode — simulate signing delay then show success
      document.getElementById('signing-sub').textContent = 'Marketplace API key needed for live trades — demo mode';
      await new Promise(r => setTimeout(r, 2000));
      showBuySuccess(null);
    }
  } catch (err) {
    // Error — go back to review
    setDrawerStep('review');
    cta.disabled = false;
    showTxToast(err.message || 'Transaction failed', 'error', 4000);
    showBubble(err.message || "Transaction failed. Try again, fren.", 4000, true);
  }
}

function showBuySuccess(txId) {
  setDrawerStep('done');

  // Populate success info
  document.getElementById('success-name').textContent = drawerNFT?.name || '';

  const ordLink = document.getElementById('success-ordinals-link');
  if (drawerNFT?.inscriptionId) {
    ordLink.href = 'https://ordinals.com/inscription/' + drawerNFT.inscriptionId;
  }

  // Fire confetti
  fireConfetti();

  // Bubble
  showBubble((drawerNFT?.name || 'This puppet') + " is yours! World peace!", 5000, true);
}

// ═══ CONFETTI CELEBRATION ═══
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#F7931A', '#AB9FF2', '#22c55e', '#ff6b2b', '#FF69B4', '#4aa3ff', '#f5e6c8'];
  const particles = [];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.6,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 14 - 4,
      w: Math.random() * 8 + 3,
      h: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.18 + Math.random() * 0.08,
      opacity: 1,
      decay: 0.008 + Math.random() * 0.006
    });
  }

  let animId;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;

    for (const p of particles) {
      if (p.opacity <= 0) continue;
      alive++;

      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.opacity -= p.decay;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (alive > 0) {
      animId = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animId);
    }
  }

  animate();
}

// ═══ BUY PANEL BUTTONS ═══
function initBuyPanel() {
  // Wire up marketplace API status events
  if (window._marketAPI) {
    window._marketAPI.onStatus((status, data) => {
      const msgs = {
        preparing: 'Preparing transaction...',
        sign: 'Confirm in your wallet...',
        broadcasting: 'Broadcasting transaction...',
        confirmed: 'Transaction confirmed!',
        error: data?.message || 'Transaction failed'
      };
      const type = status === 'confirmed' ? 'success' : status === 'error' ? 'error' : '';
      showTxToast(msgs[status] || status, type, status === 'confirmed' ? 6000 : status === 'error' ? 5000 : 0);
    });
  }

  // Drawer: confirm purchase
  const drawerCta = document.getElementById('drawer-cta');
  if (drawerCta) drawerCta.addEventListener('click', () => executeBuy());

  // Drawer: close
  const drawerClose = document.getElementById('drawer-close');
  if (drawerClose) drawerClose.addEventListener('click', closeBuyDrawer);

  const drawerOverlay = document.getElementById('buy-drawer');
  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', (e) => {
      if (e.target === drawerOverlay) closeBuyDrawer();
    });
  }

  // Drawer: success back button
  const successBack = document.getElementById('success-back');
  if (successBack) successBack.addEventListener('click', closeBuyDrawer);
}

// ═══ INIT ═══
window._shedApp = {
  showInitialBubble() {
    const sequence = [
      { delay: 600, msg: "Welcome to the Shed!", dur: 4000 },
      { delay: 5500, msg: "Pick a puppet below to inspect it.", dur: 4000 },
    ];

    sequence.forEach(({ delay, msg, dur }) => {
      setTimeout(() => {
        if (!selectedNFT) showBubble(msg, dur);
      }, delay);
    });

    setTimeout(() => {
      introComplete = true;
      startIdleCycle();
    }, 12000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  initWallet();
  initBuyPanel();

  // Load real data
  fetchBTCPrice();
  fetchCollectionStats();
  loadAllNFTs();

  // Update filter rarity chips to match ordinals sat rarities
  // Keep existing chips but also handle lowercase matching
});
