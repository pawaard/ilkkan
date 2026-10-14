/* ======================================================
   İLKKAN SPORTS — Fikstür (bilet koçanları) ve kanal kumandası
   ====================================================== */
import { $, $$, dotOf, esc, fold, prose } from "./core.js";
import { t } from "./i18n.js";
import { byId, DATA, getChannels, getMatches, getUi, isChannel, scoreText, setUi } from "./state.js";

const el = {
  tabs: $("#tabs"),
  search: $("#search"),
  tickets: $("#tickets"),
  empty: $("#empty"),
  channels: $("#channels"),
};

const countFor = (id) => {
  if (id === "all") return getMatches().length + getChannels().length;
  if (id === "kanal") return getChannels().length;
  return getMatches().filter((m) => m.cat === id).length;
};

export function renderTabs() {
  const { filter } = getUi();
  el.tabs.innerHTML = DATA.categories
    .map((c) => {
      const dot = c.id === "all" ? "" : `<i class="tab__dot" aria-hidden="true"></i>`;
      return `<button class="tab" type="button" data-filter="${esc(c.id)}" aria-pressed="${c.id === filter}" style="--dot:${dotOf(c.id)}">${dot}${esc(c.label)}<span class="tab__count">${countFor(c.id)}</span></button>`;
    })
    .join("");
}

const syncTabs = () =>
  $$(".tab", el.tabs).forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.filter === getUi().filter)));

function visibleItems() {
  const { filter, query } = getUi();
  const matches = getMatches();
  const channels = getChannels();
  const pool =
    filter === "all" ? [...matches, ...channels]
    : filter === "kanal" ? channels
    : matches.filter((m) => m.cat === filter);
  const q = fold(query.trim());
  if (!q) return pool;
  // Kısa kodlar da aranır: skorbordda görülen "BJK", "GS" vb.
  return pool.filter((item) =>
    fold([item.home, item.away, item.homeShort, item.awayShort, item.league, item.name, item.genre, item.now]
      .filter(Boolean).join(" ")).includes(q));
}

const STUB = {
  live: (m) => [m.clock || "—", t("ticket.live")],
  upcoming: (m) => [m.time, t("ticket.starts")],
  finished: () => [t("ticket.ft"), t("ticket.finished")],
};
const FLAG = {
  live: () => t("ticket.watch"),
  upcoming: (m) => (m.derby ? t("ticket.pick") : ""),
  finished: () => t("ticket.summary"),
};
const STATUS_TEXT = {
  live: (m) => t("ticket.liveLabel", { period: m.period }),
  upcoming: (m) => t("ticket.startsLabel", { time: prose(m.time) }),
  finished: () => t("ticket.finishedLabel"),
};

function matchTicket(m, pressed) {
  const [big, small] = STUB[m.status](m);
  const score = (i) => (m.score ? `<b>${esc(m.score[i])}</b>` : "");
  const teams = m.score ? `${m.home} ${m.score[0]}, ${m.away} ${m.score[1]}` : `${m.home} – ${m.away}`;
  const label = `${teams}. ${STATUS_TEXT[m.status](m)}. ${m.league}`;
  return `<button class="ticket${m.derby ? " ticket--derby" : ""}" type="button" data-id="${esc(m.id)}" data-status="${esc(m.status)}" aria-pressed="${pressed}" aria-label="${esc(label)}" style="--dot:${dotOf(m.cat)}">
      <span class="ticket__stub"><span class="ticket__time">${esc(big)}</span><span class="ticket__state">${esc(small)}</span></span>
      <span class="ticket__body">
        <span class="ticket__team"><span>${esc(m.home)}</span>${score(0)}</span>
        <span class="ticket__team"><span>${esc(m.away)}</span>${score(1)}</span>
        <span class="ticket__meta"><span class="ticket__league">${esc(m.league)}</span><span class="ticket__flag">${esc(FLAG[m.status](m))}</span></span>
      </span></button>`;
}

function channelTicket(ch, pressed) {
  const label = t("ticket.channelLabel", { name: ch.name, now: ch.now });
  return `<button class="ticket" type="button" data-id="${esc(ch.id)}" data-status="live" aria-pressed="${pressed}" aria-label="${esc(label)}" style="--dot:${dotOf(ch.cat)}">
      <span class="ticket__stub"><span class="ticket__time">${esc(ch.no)}</span><span class="ticket__state">${esc(t("ticket.channel"))}</span></span>
      <span class="ticket__body">
        <span class="ticket__team"><span>${esc(ch.name)}</span></span>
        <span class="ticket__now">${esc(ch.now)}</span>
        <span class="ticket__meta"><span class="ticket__league">${esc(ch.genre)}</span><span class="ticket__flag">7/24</span></span>
      </span></button>`;
}

const ticketHTML = (item, pressed) => (isChannel(item) ? channelTicket : matchTicket)(item, pressed);

// Her 3 maçtan sonra küçük reklam yuvası (içeriğini ads.js basar)
const AD_EVERY = 3;
const TICKET_AD = `<li class="tickets__ad"><aside class="ad ad--inline" aria-label="${esc(t("ad.region"))}"><div class="ad__frame" data-ad-slot="mac-arasi" data-ad-no="mac-arasi"></div></aside></li>`;

export function renderTickets() {
  const items = visibleItems();
  const { selectedId } = getUi();
  el.tickets.innerHTML = items
    .flatMap((item, i) => {
      const row = `<li>${ticketHTML(item, item.id === selectedId)}</li>`;
      const withAd = (i + 1) % AD_EVERY === 0 && i < items.length - 1;
      return withAd ? [row, TICKET_AD] : [row];
    })
    .join("");
  el.empty.hidden = items.length > 0;
  document.dispatchEvent(new CustomEvent("ilkkan:slots")); // yeni reklam yuvaları eklendi
}

/* ---------- Kanallar ---------- */
function channelTile(ch) {
  const m = ch.matchId ? byId(ch.matchId) : null;
  const bug = ch.feature && m && m.score
    ? `<span class="chan__bug"><b>${esc(m.homeShort)}</b>${esc(scoreText(m))}<b>${esc(m.awayShort)}</b><i>${esc(m.clock)}</i></span>`
    : "";
  const progress = Math.min(1, Math.max(0, Number(ch.progress) || 0));
  const label = t("channel.label", { name: ch.name, genre: ch.genre, now: ch.now });
  return `<button class="chan${ch.feature ? " chan--feature" : ""}" type="button" data-id="${esc(ch.id)}" aria-pressed="${ch.id === getUi().selectedId}" aria-label="${esc(label)}" style="--dot:${dotOf(ch.cat)};--p:${progress}">
      <span class="chan__no" aria-hidden="true">${esc(ch.no)}</span>
      <span class="chan__genre">${esc(ch.genre)}</span>
      <span class="chan__name">${esc(ch.name)}</span>
      ${bug}
      <span class="chan__now"><i class="pulse" aria-hidden="true"></i><span>${esc(t("channel.now", { text: ch.now }))}</span></span>
      <span class="chan__bar" aria-hidden="true"><span></span></span>
      <span class="chan__next">${esc(t("channel.next", { text: ch.next }))}</span>
    </button>`;
}

export function renderChannels() {
  const ordered = [...getChannels()].sort((a, b) => Number(Boolean(b.feature)) - Number(Boolean(a.feature)));
  el.channels.innerHTML = ordered.map(channelTile).join("");
}

/** Seçili öğeyi biletlerde ve kanallarda işaretle */
export function markSelected(id) {
  $$(".ticket", el.tickets).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
  $$(".chan:not(.chan--ad)", el.channels).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
}

/**
 * Canlı güncellemede yalnızca değişen bilet ve kanal kartlarını yeniden çiz.
 * Reklam yuvaları yerinde kalır, odak kaybolmaz.
 */
export function patchItems(ids) {
  const { selectedId } = getUi();
  const changed = new Set(ids);
  const focusedId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.id : null;
  $$(".ticket", el.tickets)
    .filter((node) => changed.has(node.dataset.id))
    .forEach((node) => {
      node.outerHTML = ticketHTML(byId(node.dataset.id), node.dataset.id === selectedId);
    });
  // Öne çıkan kanaldaki skor rozeti bağlı maça göre değişir
  const affectsTile = (ch) => changed.has(ch.id) || (ch.feature && changed.has(ch.matchId));
  $$(".chan:not(.chan--ad)", el.channels)
    .filter((node) => affectsTile(byId(node.dataset.id) || {}))
    .forEach((node) => {
      node.outerHTML = channelTile(byId(node.dataset.id));
    });
  if (focusedId && changed.has(focusedId)) {
    const again = $(`[data-id="${CSS.escape(focusedId)}"]`);
    if (again) again.focus({ preventScroll: true });
  }
}

/** @param {{ onPick: (id: string) => void, onWatch: (id: string) => void }} handlers */
export function bindFixtures({ onPick, onWatch }) {
  el.tabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    setUi({ filter: tab.dataset.filter });
    syncTabs();
    renderTickets();
  });
  el.search.addEventListener("input", (e) => {
    setUi({ query: e.target.value });
    renderTickets();
  });
  el.tickets.addEventListener("click", (e) => {
    const ticket = e.target.closest(".ticket");
    if (ticket) onPick(ticket.dataset.id);
  });
  el.channels.addEventListener("click", (e) => {
    const tile = e.target.closest(".chan:not(.chan--ad)"); // sponsorlu kartı ads.js yönetir
    if (tile) onWatch(tile.dataset.id);
  });
}
