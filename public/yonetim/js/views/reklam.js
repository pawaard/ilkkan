/* Reklam alanları: Alan 01–16 + maç arası — kiralık / görsel / reklam kodu / kapalı */
import { api } from "../api.js";
import { t } from "../i18n.js";
import { $, $$, field, html, num, pct, raw, readForm, render as paint, textarea, toast, toastError } from "../ui.js";
import { bindImagePickers, imagePicker } from "./image-picker.js";
import { unitLabel } from "./ozet.js";

const modes = () => ["kiralik", "image", "code", "off"].map((value) => ({
  value, label: t(`mode.${value}`), hint: t(`mode.${value}Hint`),
}));

function unitCard(u, stat) {
  const label = unitLabel(u);
  const radios = modes().map((m) => html`<label class="seg-radio" title="${m.hint}">
    <input type="radio" name="mode" value="${m.value}"${u.mode === m.value ? raw(" checked") : ""} /><span>${m.label}</span></label>`);
  const no = /^\d+$/.test(u.id) ? u.id : "∞";
  return html`<form class="unit" data-id="${u.id}" data-mode="${u.mode}" novalidate>
    <header class="unit__head">
      <span class="unit__no" aria-hidden="true">${no}</span>
      <div class="unit__title"><h2>${label}</h2><p>${/^\d+$/.test(u.id) ? t("unit.space", { no: u.id }) : t("unit.everyThird")} · ${u.size}</p></div>
      <dl class="unit__stats">
        <div><dt>${t("stats.imps")}</dt><dd>${num(stat.imps)}</dd></div>
        <div><dt>${t("stats.clicks")}</dt><dd>${num(stat.clicks)}</dd></div>
        <div><dt>${t("stats.ctr")}</dt><dd>${pct(stat.clicks, stat.imps)}</dd></div>
      </dl>
    </header>
    <fieldset class="seg-group seg-group--wide"><legend class="sr-only">${t("unit.modeLegend", { name: label })}</legend>${radios}</fieldset>
    <div class="unit__panel" data-for="kiralik"><p class="field__hint">${t("unit.rentInfo")}</p></div>
    <div class="unit__panel" data-for="image">
      ${imagePicker({ label: t("unit.image"), name: "imageUrl", value: u.imageUrl, hint: t("unit.imageHint", { size: u.size }) })}
      ${field({ label: t("unit.link"), name: "linkUrl", value: u.linkUrl, type: "text", wide: true, hint: t("unit.linkHint"), attrs: 'maxlength="500"' })}
      ${field({ label: t("unit.alt"), name: "alt", value: u.alt, wide: true, hint: t("unit.altHint"), attrs: 'maxlength="120"' })}
      ${field({ label: t("unit.altEn"), name: "altEn", value: u.altEn || "", wide: true, hint: t("common.enHint"), attrs: 'maxlength="120"' })}
    </div>
    <div class="unit__panel" data-for="code">
      ${textarea({ label: t("unit.code"), name: "code", value: u.code, rows: 5, hint: t("unit.codeHint"), attrs: 'spellcheck="false" maxlength="20000"' })}
    </div>
    <div class="unit__panel" data-for="off"><p class="field__hint">${t("unit.offInfo")}</p></div>
    <footer class="unit__foot"><button class="btn-plain btn-plain--red" type="submit">${t("common.save")}</button></footer>
  </form>`;
}

export async function render(root) {
  const [units, stats] = await Promise.all([api("/ads"), api("/stats?days=14")]);
  const statOf = (id) => stats.units.find((s) => s.id === id) || { imps: 0, clicks: 0 };

  paint(root, html`
    <header class="view__head">
      <div><p class="eyebrow">04 · ${t("nav.reklam")}</p><h1 class="view__title">${raw(t("reklam.title"))}</h1></div>
      <p class="view__note">${t("reklam.note")}</p>
    </header>
    <div class="units">${units.map((u) => unitCard(u, statOf(u.id)))}</div>
  `);

  bindImagePickers(root);
  root.addEventListener("change", (e) => {
    const radio = e.target.closest('input[name="mode"]');
    if (radio) radio.closest(".unit").dataset.mode = radio.value;
  });
  root.addEventListener("submit", async (e) => {
    const form = e.target.closest(".unit");
    if (!form) return;
    e.preventDefault();
    const f = readForm(form);
    const mode = $('input[name="mode"]:checked', form);
    const submit = $('button[type="submit"]', form);
    submit.disabled = true;
    try {
      await api(`/ads/${encodeURIComponent(form.dataset.id)}`, {
        method: "PUT",
        body: { mode: mode ? mode.value : "kiralik", imageUrl: f.imageUrl.trim(), linkUrl: f.linkUrl.trim(), alt: f.alt, altEn: f.altEn, code: f.code },
      });
      form.classList.remove("is-dirty");
      toast(t("reklam.saved", { name: $(".unit__title h2", form).textContent }));
    } catch (error) {
      toastError(error);
    } finally {
      submit.disabled = false;
    }
  });
  // Klavyeyle gezinirken hangi kartın değiştiği belli olsun
  $$(".unit", root).forEach((form) => form.addEventListener("input", () => form.classList.add("is-dirty")));
}
