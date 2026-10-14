/* ======================================================
   İLKKAN SPORTS — Reklamlar
   Her alan panelde seçilen moda göre dolar (Alan 01–16 + maç arası):
   - kiralik: İlkkan fotoğraflı "BU ALAN KİRALIK" bannerı
   - image:   yüklenen görsel + bağlantı
   - code:    reklam ortağının kodu (yalnızca çerez onayı varsa)
   - off:     alan gizlenir
   Gösterim ve tıklamalar çerezsiz sayılır (/api/t).
   ====================================================== */
import { $$, esc, sessionStore, toast, track } from "./core.js";
import { consentGiven, onConsentChange } from "./consent.js";
import { t } from "./i18n.js";
import { DATA } from "./state.js";

const ADS = DATA.ads;
const UNITS = ADS.units || {};
const RENT = ADS.rent;

// Slot sınıfı → standart (IAB) ölçü etiketi
const SLOT_SIZES = [
  ["ad--leaderboard", "970×90"], ["ad--billboard", "970×250"], ["ad--mpu", "300×250"],
  ["ad--sky", "160×600"], ["ad--half", "468×60"], ["ad--inline", "320×50"], ["ad--anchor", "320×50"],
];
const sizeOf = (frame) => {
  const ad = frame.closest(".ad");
  const hit = ad && SLOT_SIZES.find(([cls]) => ad.classList.contains(cls));
  return hit ? hit[1] : "";
};
const unitKey = (frame) => frame.dataset.adNo || frame.dataset.adSlot || "";
const unitOf = (frame) => UNITS[unitKey(frame)] || { mode: "kiralik" };

/* ---------- Parodi reklam seçimi: mümkünse sayfada tekrar etmesin ---------- */
const used = new Set();
const shuffle = (list) => list
  .map((value) => [Math.random(), value])
  .sort((a, b) => a[0] - b[0])
  .map(([, value]) => value);

function pick(slot) {
  const list = Array.isArray(ADS.slots[slot]) ? ADS.slots[slot] : [];
  const candidates = shuffle(list.filter((id) => ADS.creatives[id]));
  const choice = candidates.find((id) => !used.has(id)) || candidates[0];
  if (choice) used.add(choice);
  return choice;
}

function creativeHTML(id) {
  const c = ADS.creatives[id];
  const classes = `adc adc--${esc(c.tone || "red")}${c.serif ? " adc--serif" : ""}`;
  return `<a class="${classes}" href="${esc(c.href || "#")}" data-ad-id="${esc(id)}" aria-label="${esc(t("ad.creativeLabel", { brand: c.brand, tagline: c.tagline }))}">
      <svg class="adc__icon" aria-hidden="true"><use href="#${esc(c.icon)}"></use></svg>
      <span class="adc__body">
        <span class="adc__brand">${esc(c.brand)}</span>
        <span class="adc__copy"><span class="adc__tagline">${esc(c.tagline)}</span><span class="adc__note">${esc(c.note)}</span></span>
        <span class="adc__cta">${esc(c.cta)} →</span>
      </span>
    </a>`;
}

/* ---------- "Bu alan kiralık": sırayla farklı metin / renk / fotoğraf ---------- */
let rentTurn = RENT && RENT.copies.length ? Math.floor(Math.random() * RENT.copies.length) : 0;

function nextRent() {
  const n = rentTurn;
  rentTurn += 1;
  return {
    copy: RENT.copies[n % RENT.copies.length],
    tone: RENT.tones[n % RENT.tones.length] || "red",
    photo: RENT.photos[n % RENT.photos.length] || { src: "", focus: "50% 20%" },
  };
}

function rentHTML(frame) {
  const { copy, tone, photo } = nextRent();
  const size = sizeOf(frame);
  const no = /^\d+$/.test(frame.dataset.adNo || "") ? frame.dataset.adNo : "";
  const kicker = [no ? t("ad.kicker", { no }) : t("ad.space"), size].filter(Boolean).join(" · ");
  const label = t("ad.rentLabel", {
    no: no ? t("ad.rentNo", { no }) : "", size: size ? ` (${size})` : "", brand: copy.brand, tagline: copy.tagline,
  });
  return `<a class="adc adc--rent adc--${esc(tone)}" href="${esc(RENT.href || "#iletisim")}" data-ad-id="kiralik" aria-label="${esc(label)}">
      <span class="adc__media"><span class="adc__photo"><img src="${esc(photo.src)}" alt="" decoding="async" style="object-position:${esc(photo.focus)}"></span><span class="adc__tag">${esc(t("ad.rentTag"))}</span></span>
      <span class="adc__body">
        <span class="adc__kicker">${esc(kicker)}</span>
        <span class="adc__brand">${esc(copy.brand)}</span>
        <span class="adc__copy"><span class="adc__tagline">${esc(copy.tagline)}</span><span class="adc__note">${esc(copy.note)}</span></span>
        <span class="adc__cta">${esc(copy.cta)} →</span>
      </span>
    </a>`;
}

/* ---------- Panelden yüklenen görsel reklam ---------- */
function imageHTML(unit) {
  const img = `<img src="${esc(unit.imageUrl)}" alt="${esc(unit.alt || t("ad.imageAlt"))}" loading="lazy" decoding="async">`;
  if (!unit.linkUrl) return `<span class="adc adc--image">${img}</span>`;
  const external = !unit.linkUrl.startsWith("#");
  const rel = external ? ' target="_blank" rel="sponsored noopener"' : "";
  return `<a class="adc adc--image" href="${esc(unit.linkUrl)}"${rel} data-ad-id="gorsel" aria-label="${esc(t("ad.imageLabel", { alt: unit.alt || t("ad.sponsorFallback") }))}">${img}</a>`;
}

/* ---------- Reklam ortağı kodu: betikler çalışsın diye "contextual fragment" ---------- */
let codeRan = false; // sayfada gerçekten reklam betiği çalıştı mı (onay geri çekilirse yenilemek için)

function insertCode(frame, code) {
  if (frame.dataset.codeLoaded) return; // aynı kodu iki kez çalıştırma
  try {
    frame.replaceChildren(document.createRange().createContextualFragment(code));
    frame.dataset.codeLoaded = "1";
    codeRan = true;
  } catch {
    frame.innerHTML = rentHTML(frame); // bozuk kod sayfayı düşürmesin
  }
}

/* ---------- Gösterim sayacı: alan yarısı görününce sayfa başına bir kez ----------
   Maç arası yuvaları fikstür her süzüldüğünde yeniden çizilir; sırasına göre anahtarlanır ki tekrar sayılmasın */
const seen = new Set();
const impressionKey = (frame) => {
  const key = unitKey(frame);
  if (key !== "mac-arasi") return key;
  return `${key}:${$$('.ad__frame[data-ad-no="mac-arasi"]').indexOf(frame)}`;
};
const impressions = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      impressions.unobserve(entry.target);
      const key = impressionKey(entry.target);
      if (seen.has(key)) return;
      seen.add(key);
      track("imp", unitKey(entry.target));
    });
  }, { threshold: 0.5 })
  : null;

function hide(frame) {
  const box = frame.closest(".tickets__ad") || frame.closest(".ad");
  if (box) box.hidden = true;
}

// İçindeki tüm alanlar kapalıysa satırı/ızgarayı da gizle (boş "Reklam" etiketi kalmasın)
function hideEmptyGroups() {
  $$(".ad-grid, .ad-row").forEach((group) => {
    const ads = $$(".ad", group);
    group.hidden = ads.length > 0 && ads.every((ad) => ad.hidden);
  });
  const anchor = document.getElementById("adAnchor");
  if (anchor && anchor.hidden) document.documentElement.classList.remove("has-anchor");
}

function fill(frame) {
  const unit = unitOf(frame);
  frame.dataset.filled = unit.mode;
  if (unit.mode === "off") {
    hide(frame);
    return;
  }
  if (unit.mode === "image" && unit.imageUrl) {
    frame.innerHTML = imageHTML(unit);
  } else if (unit.mode === "code" && unit.code) {
    if (consentGiven()) insertCode(frame, unit.code);
    else frame.innerHTML = rentHTML(frame); // onay yok: yerinde kiralık tabelası
  } else if (ADS.slots[frame.dataset.adSlot] === "kiralik" || !Array.isArray(ADS.slots[frame.dataset.adSlot])) {
    frame.innerHTML = rentHTML(frame);
  } else {
    const id = pick(frame.dataset.adSlot);
    if (id) frame.innerHTML = creativeHTML(id);
  }
  if (impressions) impressions.observe(frame);
}

// Slot sırası = doldurma önceliği (aynı anda görünen alanlar önce)
export function fillSlots() {
  const order = Object.keys(ADS.slots);
  const rank = (frame) => {
    const i = order.indexOf(frame.dataset.adSlot);
    return i === -1 ? order.length : i;
  };
  $$(".ad__frame[data-ad-slot]")
    .filter((frame) => !frame.dataset.filled)
    .sort((a, b) => rank(a) - rank(b))
    .forEach(fill);
  hideEmptyGroups();
}

/* ---------- Kanallar arasında sponsorlu kart ---------- */
function addNativeTile() {
  const grid = document.getElementById("channels");
  const id = pick("kanal-native");
  if (!grid || !id) return;
  const c = ADS.creatives[id];
  grid.insertAdjacentHTML("beforeend", `<a class="chan chan--ad" href="${esc(c.href || "#")}" data-ad-id="${esc(id)}" data-ad-slot="kanal-native" aria-label="${esc(t("ad.sponsoredLabel", { brand: c.brand, tagline: c.tagline }))}">
      <span class="chan__no" aria-hidden="true">SP</span>
      <span class="chan__genre">${esc(t("ad.sponsored"))}</span>
      <span class="chan__name">${esc(c.brand)}</span>
      <span class="chan__now">${esc(c.tagline)}</span>
      <span class="chan__next">${esc(c.note)}</span>
      <span class="chan__adcta">${esc(c.cta)} →</span>
    </a>`);
}

/* ---------- Oynatıcı: "… katkılarıyla sunulmaktadır" ---------- */
function playerSponsor() {
  const node = document.getElementById("playerSponsor");
  const c = ADS.creatives[ADS.playerSponsor];
  if (!node || !c) return;
  node.innerHTML = `<span class="idle__sponsor-label">${esc(t("ad.sponsorLabel"))}</span><span>${t("ad.sponsorLine", { brand: `<b>${esc(c.brand)}</b>` })}</span>`;
  node.hidden = false;
}

/* ---------- Tıklama: say; şablon parodi reklamların gerçek bağlantısı yok ---------- */
function bindClicks() {
  document.addEventListener("click", (e) => {
    const ad = e.target.closest("[data-ad-id]");
    if (!ad) return;
    const frame = ad.closest(".ad__frame");
    track("click", frame ? unitKey(frame) : ad.dataset.adSlot || "kanal-native");
    const href = ad.getAttribute("href");
    if (href && href !== "#") return; // kiralık → #iletisim, görsel reklam → reklamverenin adresi
    e.preventDefault();
    toast(ADS.clickNote);
  });
}

/* ---------- Mobil alt şerit: kapatılınca bu oturumda kapalı kalsın ---------- */
function bindAnchor() {
  const anchor = document.getElementById("adAnchor");
  if (!anchor || anchor.hidden) return;
  const KEY = "ilkkan:alt-reklam-kapali";
  if (sessionStore.get(KEY) === "1") {
    anchor.hidden = true;
    return;
  }
  document.documentElement.classList.add("has-anchor");
  anchor.querySelector(".ad__close").addEventListener("click", () => {
    anchor.hidden = true;
    document.documentElement.classList.remove("has-anchor");
    if (!sessionStore.set(KEY, "1")) toast(t("ad.anchorNotSaved"));
  });
}

/* ---------- Yan raylar footer'ın üstüne binmesin ---------- */
function bindRails() {
  const footer = document.querySelector(".credits");
  if (!footer || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([entry]) => {
    document.documentElement.classList.toggle("footer-in-view", entry.isIntersecting);
  }).observe(footer);
}

/** Sayfada çerez gerektiren (kod modlu) reklam alanı var mı */
export const needsConsent = () => Object.values(UNITS).some((u) => u.mode === "code" && u.code);

export function initAds() {
  fillSlots();
  addNativeTile();
  playerSponsor();
  bindClicks();
  bindAnchor();
  bindRails();
  // Fikstür filtre/arama ile yeniden çizilince yeni "maç arası" yuvalarını doldur
  document.addEventListener("ilkkan:slots", fillSlots);
  onConsentChange((granted) => {
    if (!granted) {
      // Yalnızca gerçekten çalışmış reklam betiği varsa yenile (kaldırmanın tek güvenli yolu)
      if (codeRan) window.location.reload();
      return;
    }
    $$('.ad__frame[data-filled="code"]:not([data-code-loaded])').forEach((frame) => insertCode(frame, unitOf(frame).code));
  });
}
