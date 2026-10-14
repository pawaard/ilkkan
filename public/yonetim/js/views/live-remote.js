/* Canlı skor kumandası: gol +1 / geri al, dakika, durum — Özet ve Maçlar ekranında ortak */
import { api, siteHref } from "../api.js";
import { t } from "../i18n.js";
import { $, html, raw, render, STATUS_LABEL, toast, toastError } from "../ui.js";

const statusRadios = (m) => ["upcoming", "live", "finished"].map((s) => html`
  <label class="seg-radio"><input type="radio" name="status" value="${s}"${m.status === s ? raw(" checked") : ""} /><span>${STATUS_LABEL[s]}</span></label>`);

const side = (m, key) => {
  const i = key === "home" ? 0 : 1;
  const name = key === "home" ? m.home : m.away;
  const score = m.score ? m.score[i] : "–";
  return html`<div class="remote__team">
    <span class="remote__name">${name}</span>
    <div class="stepper">
      <button class="stepper__btn" type="button" data-act="undo" data-side="${key}" aria-label="${t("remote.undo", { name })}"${!m.score || m.score[i] === 0 ? raw(" disabled") : ""}>−</button>
      <output class="stepper__value" aria-label="${t("remote.score", { name })}">${score}</output>
      <button class="stepper__btn stepper__btn--goal" type="button" data-act="goal" data-side="${key}" aria-label="${t("remote.goalLabel", { name })}">${t("remote.goal")}</button>
    </div>
  </div>`;
};

export function remoteCard(m) {
  return html`<article class="remote" data-id="${m.id}" data-status="${m.status}">
    <header class="remote__head">
      <span class="chip" data-status="${m.status}"><i class="pulse" aria-hidden="true"></i>${STATUS_LABEL[m.status]}${m.clock ? ` · ${m.clock}` : ""}</span>
      <span class="remote__league">${m.league}</span>
      <a class="remote__link" href="${siteHref(`/mac/${m.id}`)}" target="_blank" rel="noopener">${t("remote.page")}</a>
    </header>
    <div class="remote__score">${side(m, "home")}<span class="remote__dash" aria-hidden="true">–</span>${side(m, "away")}</div>
    <form class="remote__form" novalidate>
      <fieldset class="seg-group"><legend class="sr-only">${t("remote.status")}</legend>${statusRadios(m)}</fieldset>
      <label class="field field--tight"><span class="field__label">${t("remote.clock")}</span><input class="input" name="clock" value="${m.clock}" maxlength="8" placeholder="34'" /></label>
      <label class="field field--tight field--grow"><span class="field__label">${t("remote.period")}</span><input class="input" name="period" value="${m.period}" maxlength="40" placeholder="34. dakika" /></label>
      <button class="btn-plain btn-plain--red" type="submit">${t("common.save")}</button>
    </form>
  </article>`;
}

// Elle yazılıp henüz kaydedilmemiş dakika/yazı alanları
const typedFields = (card) => Array.from(card.querySelectorAll(".remote__form .input"))
  .filter((input) => input.value !== input.defaultValue)
  .map((input) => [input.name, input.value]);

async function send(card, body, onChange, { keepTyped = false } = {}) {
  const typed = keepTyped ? typedFields(card) : [];
  card.classList.add("is-busy");
  try {
    const updated = await api(`/matches/${encodeURIComponent(card.dataset.id)}/live`, { method: "PATCH", body });
    const next = document.createElement("div");
    render(next, remoteCard(updated));
    const fresh = next.firstElementChild;
    // "+ Gol" basılırken yazılmakta olan dakika kaybolmasın
    typed.forEach(([name, value]) => { fresh.querySelector(`.remote__form [name="${name}"]`).value = value; });
    card.replaceWith(fresh);
    if (onChange) onChange(updated);
    return updated;
  } catch (error) {
    card.classList.remove("is-busy");
    toastError(error);
    return null;
  }
}

/** @param {HTMLElement} root  @param {{ onChange?: (match: object) => void }} options */
export function bindRemote(root, { onChange } = {}) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    const card = btn && btn.closest(".remote");
    if (!card) return;
    const updated = await send(card, { [btn.dataset.act]: btn.dataset.side }, onChange, { keepTyped: true });
    if (updated && btn.dataset.act === "goal") {
      const scorer = btn.dataset.side === "home" ? updated.home : updated.away;
      toast(t("remote.goalToast", { scorer, score: `${updated.score[0]}–${updated.score[1]}` }));
    }
  });
  root.addEventListener("submit", async (e) => {
    const form = e.target.closest(".remote__form");
    if (!form) return;
    e.preventDefault();
    const card = form.closest(".remote");
    // Yalnızca değişen alanlar gider: "Bitti" seçilip dakikaya dokunulmazsa sunucu "MS / Maç sonu" yazar
    const status = $("input[name=status]:checked", form);
    const changed = (input) => (input.value !== input.defaultValue ? input.value : undefined);
    const body = {
      status: status && status.value !== card.dataset.status ? status.value : undefined,
      clock: changed(form.elements.clock),
      period: changed(form.elements.period),
    };
    if (Object.values(body).every((v) => v === undefined)) {
      toast(t("remote.noChange"));
      return;
    }
    const updated = await send(card, body, onChange);
    if (updated) toast(t("remote.saved"));
  });
}
