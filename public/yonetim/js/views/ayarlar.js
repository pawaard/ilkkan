/* Ayarlar: site bilgileri ve bağlantılar, derbi, oynatıcı sponsoru, görseller, kiralık reklam bağlantısı — İngilizce katmanıyla */
import { api } from "../api.js";
import { t } from "../i18n.js";
import { $$, field, html, raw, readForm, render as paint, select, textarea, toast, toastError } from "../ui.js";
import { bindImagePickers, imagePicker } from "./image-picker.js";

const section = (key, title, sub, body) => html`<form class="card settings" data-key="${key}" novalidate>
  <header class="card__head"><div><h2 class="card__title">${title}</h2><p class="card__sub">${sub}</p></div></header>
  <div class="form-grid">${body}</div>
  <footer class="card__foot"><button class="btn btn--ticket btn--sm" type="submit">${t("common.save")}</button></footer>
</form>`;

// İngilizce alanlar her bölümün altında; boş bırakılırsa sitede Türkçesi görünür
const enSep = () => html`<p class="form-sep form-sep--en">English <small>${t("common.enHint")}</small></p>`;

const rentPhotoRow = (p, i) => html`<div class="photo-row" data-photo>
  ${imagePicker({ label: t("set.rentPhoto", { n: i + 1 }), name: `rentSrc${i}`, value: p.src })}
  ${field({ label: t("set.focus"), name: `rentFocus${i}`, value: p.focus, hint: t("set.focusHint"), attrs: 'maxlength="9"' })}
</div>`;

const en = (f, keys) => Object.fromEntries(keys.map((k) => [k, f[`en.${k}`] || ""]));

// Her form kendi ayar anahtarının şemasına göre gövde üretir (İngilizce katman "en" altında)
const PAYLOAD = Object.freeze({
  site: (f) => ({
    title: f.title, tagline: f.tagline, description: f.description, telegramUrl: f.telegramUrl.trim(), xUrl: f.xUrl.trim(), contactNote: f.contactNote,
    en: en(f, ["tagline", "description", "contactNote"]),
  }),
  derby: (f) => ({ matchId: f.matchId, kickoff: f.kickoff, prediction: f.prediction, en: en(f, ["prediction"]) }),
  player: (f) => ({ sponsor: f.sponsor }),
  ads: (f) => ({ rentHref: f.rentHref.trim(), clickNote: f.clickNote, en: en(f, ["clickNote"]) }),
  images: (f, form) => ({
    posterLeft: f.posterLeft.trim(), posterRight: f.posterRight.trim(), hero: f.hero.trim(), card: f.card.trim(),
    heroAlt: f.heroAlt, cardAlt: f.cardAlt,
    rentPhotos: $$("[data-photo]", form)
      .map((_, i) => ({ src: (f[`rentSrc${i}`] || "").trim(), focus: (f[`rentFocus${i}`] || "50% 20%").trim() }))
      .filter((p) => p.src),
    en: en(f, ["heroAlt", "cardAlt"]),
  }),
});

export async function render(root) {
  const [s, matches] = await Promise.all([api("/settings"), api("/matches")]);
  const site = s.site || {};
  const derby = s.derby || {};
  const img = s.images || {};
  const english = s.en || {};
  const siteEn = english.site || {};
  const photos = [...(img.rentPhotos || []), { src: "", focus: "50% 20%" }].slice(0, 6);

  paint(root, html`
    <header class="view__head">
      <div><p class="eyebrow">06 · ${t("nav.ayarlar")}</p><h1 class="view__title">${raw(t("set.title"))}</h1></div>
      <p class="view__note">${t("set.note")}</p>
    </header>
    ${section("site", t("set.site"), t("set.siteSub"), html`
      ${field({ label: t("set.siteTitle"), name: "title", value: site.title, required: true, attrs: 'maxlength="60"' })}
      ${field({ label: t("set.tagline"), name: "tagline", value: site.tagline, required: true, attrs: 'maxlength="80"' })}
      ${textarea({ label: t("set.description"), name: "description", value: site.description, rows: 2, hint: t("set.descriptionHint"), attrs: 'maxlength="200"' })}
      ${field({ label: t("set.telegram"), name: "telegramUrl", value: site.telegramUrl, type: "url", hint: "https://t.me/…", attrs: 'maxlength="500"' })}
      ${field({ label: t("set.x"), name: "xUrl", value: site.xUrl, type: "url", hint: "https://x.com/…", attrs: 'maxlength="500"' })}
      ${field({ label: t("set.contactNote"), name: "contactNote", value: site.contactNote, wide: true, attrs: 'maxlength="160"' })}
      ${enSep()}
      ${field({ label: t("set.tagline"), name: "en.tagline", value: siteEn.tagline, attrs: 'maxlength="80"' })}
      ${textarea({ label: t("set.description"), name: "en.description", value: siteEn.description, rows: 2, attrs: 'maxlength="200"' })}
      ${field({ label: t("set.contactNote"), name: "en.contactNote", value: siteEn.contactNote, wide: true, attrs: 'maxlength="160"' })}
    `)}
    ${section("derby", t("set.derby"), t("set.derbySub"), html`
      ${select({ label: t("set.derbyMatch"), name: "matchId", value: derby.matchId, options: matches.map((m) => ({ value: m.id, label: `${m.home} – ${m.away} (${m.time})` })) })}
      ${field({ label: t("match.time"), name: "kickoff", value: derby.kickoff, type: "time", required: true })}
      ${textarea({ label: t("set.prediction"), name: "prediction", value: derby.prediction, rows: 2, attrs: 'maxlength="160"' })}
      ${enSep()}
      ${textarea({ label: t("set.prediction"), name: "en.prediction", value: (english.derby || {}).prediction, rows: 2, attrs: 'maxlength="160"' })}
    `)}
    ${section("player", t("set.sponsor"), t("set.sponsorSub"), html`
      ${select({ label: t("set.sponsorLabel"), name: "sponsor", value: (s.player || {}).sponsor || "", options: [{ value: "", label: t("set.noSponsor") }, ...s.creatives.map((c) => ({ value: c.id, label: `${c.brand} — ${c.tagline}` }))] })}
    `)}
    ${section("images", t("set.images"), t("set.imagesSub"), html`
      ${imagePicker({ label: t("set.posterLeft"), name: "posterLeft", value: img.posterLeft })}
      ${imagePicker({ label: t("set.posterRight"), name: "posterRight", value: img.posterRight })}
      ${imagePicker({ label: t("set.hero"), name: "hero", value: img.hero })}
      ${field({ label: t("set.heroAlt"), name: "heroAlt", value: img.heroAlt, wide: true, hint: t("set.altHint"), attrs: 'maxlength="200"' })}
      ${imagePicker({ label: t("set.card"), name: "card", value: img.card })}
      ${field({ label: t("set.cardAlt"), name: "cardAlt", value: img.cardAlt, wide: true, attrs: 'maxlength="200"' })}
      <p class="form-sep">${t("set.rentPhotos")} <small>${t("set.rentPhotosHint")}</small></p>
      ${photos.map(rentPhotoRow)}
      ${enSep()}
      ${field({ label: t("set.heroAlt"), name: "en.heroAlt", value: (english.images || {}).heroAlt, wide: true, attrs: 'maxlength="200"' })}
      ${field({ label: t("set.cardAlt"), name: "en.cardAlt", value: (english.images || {}).cardAlt, wide: true, attrs: 'maxlength="200"' })}
    `)}
    ${section("ads", t("set.rent"), t("set.rentSub"), html`
      ${field({ label: t("set.rentHref"), name: "rentHref", value: s.ads.rentHref, hint: "#iletisim · https://… · mailto:reklam@…", attrs: 'maxlength="500"' })}
      ${textarea({ label: t("set.clickNote"), name: "clickNote", value: s.ads.clickNote, rows: 2, attrs: 'maxlength="200"' })}
      ${enSep()}
      ${textarea({ label: t("set.clickNote"), name: "en.clickNote", value: (english.ads || {}).clickNote, rows: 2, attrs: 'maxlength="200"' })}
    `)}
  `);

  bindImagePickers(root);
  root.addEventListener("submit", async (e) => {
    const form = e.target.closest(".settings");
    if (!form) return;
    e.preventDefault();
    const { key } = form.dataset;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api(`/settings/${key}`, { method: "PUT", body: PAYLOAD[key](readForm(form), form) });
      toast(t("set.saved"));
    } catch (error) {
      toastError(error);
    } finally {
      submit.disabled = false;
    }
  });
}
