/* ======================================================
   İLKKAN SPORTS — Veri ve arayüz durumu
   Veri sunucudan gelir (/data.js → window.ILKKAN_DATA);
   canlı güncellemeler yeni nesnelerle değiştirilir (yerinde değişiklik yok).
   ====================================================== */

export const DATA = window.ILKKAN_DATA || null;

const STATUS_ORDER = Object.freeze({ live: 0, upcoming: 1, finished: 2 });
const byStatus = (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status];

let matches = DATA ? [...DATA.matches].sort(byStatus) : [];
let channels = DATA ? [...DATA.channels] : [];
let index = new Map();
const reindex = () => {
  index = new Map([...matches, ...channels].map((item) => [item.id, item]));
};
reindex();

export const getMatches = () => matches;
export const getChannels = () => channels;
export const byId = (id) => index.get(id);
export const liveMatches = () => matches.filter((m) => m.status === "live");
export const isChannel = (item) => Boolean(item && item.no);
export const scoreText = (m) => (m && m.score ? `${m.score[0]}–${m.score[1]}` : "–");

// Kanalın yayın adresi yoksa bağlı maçınkini kullan
export const streamsOf = (item) => {
  if (!item) return [];
  if (item.streams && item.streams.length) return item.streams;
  const linked = isChannel(item) && item.matchId ? byId(item.matchId) : null;
  return linked && linked.streams ? linked.streams : [];
};

/* ---------- Arayüz durumu ---------- */
const pickInitial = () => {
  const wanted = new URLSearchParams(window.location.search).get("mac");
  if (wanted && index.has(wanted)) return wanted;
  const first = liveMatches()[0] || matches[0] || channels[0];
  return first ? first.id : "";
};

let ui = Object.freeze({ filter: "all", query: "", selectedId: pickInitial(), source: 0 });
export const getUi = () => ui;
export const setUi = (patch) => {
  ui = Object.freeze({ ...ui, ...patch });
  return ui;
};

/* ---------- Canlı güncelleme (/api/live) ---------- */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function merge(list, updates) {
  const fresh = new Map(updates.map((u) => [u.id, u]));
  const changed = [];
  const next = list.map((item) => {
    const patch = fresh.get(item.id);
    if (!patch) return item;
    const merged = { ...item, ...patch };
    if (same(merged, item)) return item;
    changed.push(item.id);
    return merged;
  });
  return { next, changed };
}

/** Sunucudan gelen canlı veriyi uygular; değişen öğe kimliklerini döndürür (sıra korunur) */
export function applyLive(update) {
  const m = merge(matches, update.matches || []);
  const c = merge(channels, update.channels || []);
  matches = m.next;
  channels = c.next;
  reindex();
  return [...m.changed, ...c.changed];
}
