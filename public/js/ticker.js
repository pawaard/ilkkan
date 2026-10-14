/* ======================================================
   İLKKAN SPORTS — Skorbord şeridi · İlkkan bandı · canlı anlatım
   ====================================================== */
import { $, esc } from "./core.js";
import { LOCALE } from "./i18n.js";
import { DATA, liveMatches, scoreText } from "./state.js";

const el = {
  ticker: $("#ticker"),
  tape: $("#tape"),
  commentary: $("#commentary"),
};

// Kayan yazı hızını içerik genişliğine göre sabitle (px/sn)
function tuneMarquee(track, pxPerSecond) {
  const half = track.scrollWidth / 2;
  if (half > 0) track.style.setProperty("--dur", `${Math.max(20, half / pxPerSecond).toFixed(1)}s`);
}

export function renderTicker() {
  const scores = liveMatches().map((m) =>
    `<span class="tick"><b>${esc(m.homeShort)}</b>${esc(scoreText(m))}<b>${esc(m.awayShort)}</b><span class="tick__min">${esc(m.clock)}</span></span>`);
  const notes = DATA.tickerNotes.map((note) => `<span class="tick tick--note">${esc(note)}</span>`);
  // İlkkan'ın notlarını skorların arasına serpiştir
  const mixed = scores.flatMap((s, i) => {
    const note = i % 2 === 1 ? notes[(i - 1) / 2] : null;
    return note ? [s, note] : [s];
  });
  // Skor yoksa notlar yine dönsün
  const base = mixed.length ? mixed : notes;
  const ads = (DATA.ads.ticker || []).map((text) => `<span class="tick tick--ad">${esc(text)}</span>`);
  const group = [...base.slice(0, 3), ads[0], ...base.slice(3, 7), ads[1], ...base.slice(7)]
    .filter(Boolean)
    .join("");
  el.ticker.innerHTML = `<span class="tick-group">${group}</span><span class="tick-group" aria-hidden="true">${group}</span>`;
  tuneMarquee(el.ticker, 55);
}

export function renderTape() {
  const group = DATA.quotes.map((q) => `<span class="tape__item">${esc(q)}</span>`).join("");
  el.tape.innerHTML = `<span class="tape__group">${group}</span><span class="tape__group" aria-hidden="true">${group}</span>`;
  tuneMarquee(el.tape, 45);
}

// Canlı anlatım: saatler sayfanın açıldığı ana göre hesaplanır
export function renderCommentary() {
  const now = Date.now();
  const fmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
  el.commentary.innerHTML = DATA.commentary
    .map((c) => `<li class="commentary__item"><time class="commentary__time">${esc(fmt.format(now - c.ago * 60000))}</time><p class="commentary__text">${esc(c.text)}</p></li>`)
    .join("");
}

// Fontlar gelince genişlik değişir → hızları yeniden ayarla
export function retuneMarquees() {
  tuneMarquee(el.ticker, 55);
  tuneMarquee(el.tape, 45);
}

// Kayan yazıları durdur/başlat (klavye: skorbord düğmesi, dokunmatik: banda dokun)
export function bindMotionToggle() {
  const btn = $("#motionToggle");
  if (!btn) return;
  const toggle = () => {
    const paused = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(paused));
    document.documentElement.classList.toggle("motion-paused", paused);
  };
  btn.addEventListener("click", toggle);
  el.tape.closest(".tape").addEventListener("click", toggle);
}
