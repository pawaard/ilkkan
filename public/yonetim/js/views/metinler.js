/* Metinler: sitedeki tüm İlkkan replikleri ve dönen yazılar — satır satır, Türkçe ve İngilizce */
import { api } from "../api.js";
import { t } from "../i18n.js";
import { $, $$, confirmAction, esc, html, raw, render as paint, toast, toastError } from "../ui.js";

// Her liste ve satır alanları; başlık/açıklama/etiketler panel dilinde sözlükten
const KINDS = Object.freeze([
  { kind: "subtitles", fields: [{ key: "a", label: "texts.f.question", max: 80 }, { key: "b", label: "texts.f.answer", max: 80 }] },
  { kind: "quotes", fields: [{ key: "", label: "texts.f.line", max: 120 }] },
  { kind: "liveComments", fields: [{ key: "", label: "texts.f.comment", max: 120 }] },
  { kind: "commentary", fields: [{ key: "ago", label: "texts.f.ago", type: "number", max: 999 }, { key: "text", label: "texts.f.commentary", max: 200 }] },
  { kind: "tickerNotes", fields: [{ key: "", label: "texts.f.note", max: 120 }] },
  { kind: "tickerAds", fields: [{ key: "", label: "texts.f.sponsor", max: 120 }] },
  { kind: "rentCopies", fields: [{ key: "brand", label: "texts.f.title", max: 40 }, { key: "tagline", label: "texts.f.tagline", max: 80 }, { key: "note", label: "texts.f.ilkkanNote", max: 80 }, { key: "cta", label: "texts.f.button", max: 24 }] },
]);

const cell = (f, value) => html`<label class="cell${f.type === "number" ? " cell--num" : ""}">
  <span class="sr-only">${t(f.label)}</span>
  <input class="input" data-key="${f.key}" ${raw(f.type === "number" ? `type="number" min="0" max="${f.max}"` : `maxlength="${f.max}"`)} value="${value ?? ""}" placeholder="${t(f.label)}" />
</label>`;

const rowHTML = (def, item) => html`<li class="line">
  <span class="line__grip" aria-hidden="true"></span>
  <div class="line__cells" style="--cols:${def.fields.length}">${def.fields.map((f) => cell(f, f.key ? item[f.key] : item))}</div>
  <span class="line__tools">
    <button class="icon-plain" type="button" data-move="-1" aria-label="${t("texts.up")}"><svg aria-hidden="true"><use href="#i-up" /></svg></button>
    <button class="icon-plain" type="button" data-move="1" aria-label="${t("texts.down")}"><svg aria-hidden="true"><use href="#i-down" /></svg></button>
    <button class="icon-plain icon-plain--danger" type="button" data-remove aria-label="${t("texts.remove")}"><svg aria-hidden="true"><use href="#i-trash" /></svg></button>
  </span>
</li>`;

const blank = (def) => (def.fields.length === 1 && !def.fields[0].key
  ? ""
  : Object.fromEntries(def.fields.map((f) => [f.key, f.type === "number" ? 0 : ""])));

function readList(def, list) {
  return $$(".line", list).map((line) => {
    const inputs = $$("input[data-key]", line);
    if (def.fields.length === 1 && !def.fields[0].key) return inputs[0].value.trim();
    return Object.fromEntries(inputs.map((input) => [
      input.dataset.key,
      input.type === "number" ? Number(input.value || 0) : input.value.trim(),
    ]));
  });
}

export async function render(root) {
  let content = await api("/content"); // { tr: {…}, en: {…} }
  let active = KINDS[0].kind;
  let contentLang = "tr";
  const listOf = (lang, kind) => (content[lang] && content[lang][kind]) || [];

  const langTabs = () => ["tr", "en"].map((l) => html`<button class="tab-btn tab-btn--lang" type="button" data-content-lang="${l}" aria-pressed="${l === contentLang}">${t(`content.${l}`)}</button>`);
  const tabs = () => KINDS.map((d) => html`<button class="tab-btn" type="button" role="tab" data-kind="${d.kind}" aria-selected="${d.kind === active}">${t(`texts.${d.kind}`)}<span>${listOf(contentLang, d.kind).length}</span></button>`);

  const englishNote = (items) => {
    if (contentLang !== "en") return "";
    if (items.length) return html`<p class="lang-note">${t("texts.enNote")}</p>`;
    return html`<p class="lang-note lang-note--empty">${t("texts.enEmpty")} <button class="btn-plain" type="button" id="copyTr">${t("texts.copyTr")}</button></p>`;
  };

  const panel = () => {
    const def = KINDS.find((d) => d.kind === active);
    const items = listOf(contentLang, def.kind);
    const title = t(`texts.${def.kind}`);
    return html`<section class="card" role="tabpanel" aria-label="${title}">
      <header class="card__head"><div><h2 class="card__title">${title} <small>${t(`content.${contentLang}`)}</small></h2><p class="card__sub">${t(`texts.${def.kind}Where`)}</p></div></header>
      ${englishNote(items)}
      <ol class="lines" id="lines">${items.map((item) => rowHTML(def, item))}</ol>
      <footer class="card__foot">
        <button class="btn-plain" type="button" id="addLine">${t("texts.add")}</button>
        <button class="btn btn--ticket btn--sm" type="button" id="saveLines">${t("common.save")}</button>
      </footer>
    </section>`;
  };
  const draw = () => paint(root, html`
    <header class="view__head">
      <div><p class="eyebrow">05 · ${t("nav.metinler")}</p><h1 class="view__title">${raw(t("texts.title"))}</h1></div>
      <p class="view__note">${t("texts.note")}</p>
    </header>
    <div class="tab-row tab-row--lang" role="group" aria-label="${t("content.label")}"><span class="tab-row__label">${t("content.label")}</span>${langTabs()}</div>
    <div class="tab-row" role="tablist" aria-label="${t("texts.lists")}">${tabs()}</div>
    ${panel()}
  `);

  // Kaydedilmemiş satırlar sessizce kaybolmasın
  const leaveOk = async () => {
    const current = KINDS.find((d) => d.kind === active);
    const dirty = JSON.stringify(readList(current, $("#lines", root))) !== JSON.stringify(listOf(contentLang, active));
    return !dirty || confirmAction(t("texts.discard", { name: t(`texts.${active}`) }), { confirmLabel: t("texts.discardYes") });
  };

  draw();
  root.addEventListener("click", async (e) => {
    const langBtn = e.target.closest("[data-content-lang]");
    if (langBtn) {
      if (langBtn.dataset.contentLang === contentLang || !(await leaveOk())) return;
      contentLang = langBtn.dataset.contentLang;
      draw();
      $(`[data-content-lang="${esc(contentLang)}"]`, root).focus();
      return;
    }
    const tab = e.target.closest("[data-kind]");
    if (tab) {
      if (tab.dataset.kind === active || !(await leaveOk())) return;
      active = tab.dataset.kind;
      draw();
      $(`[data-kind="${esc(active)}"]`, root).focus();
      return;
    }
    const def = KINDS.find((d) => d.kind === active);
    const list = $("#lines", root);
    const line = e.target.closest(".line");
    if (e.target.closest("#copyTr")) {
      // Çeviriye Türkçe listeyle başla (kaydetmeden önce satırları İngilizceye çevir)
      paint(list, listOf("tr", active).map((item) => rowHTML(def, item)));
      const first = $("input", list);
      if (first) first.focus();
    } else if (e.target.closest("#addLine")) {
      list.insertAdjacentHTML("beforeend", String(rowHTML(def, blank(def))));
      $("input", list.lastElementChild).focus();
    } else if (line && e.target.closest("[data-remove]")) {
      line.remove();
    } else if (line && e.target.closest("[data-move]")) {
      const dir = Number(e.target.closest("[data-move]").dataset.move);
      const sibling = dir < 0 ? line.previousElementSibling : line.nextElementSibling;
      if (sibling) {
        if (dir < 0) sibling.before(line);
        else sibling.after(line);
        e.target.closest("[data-move]").focus();
      }
    } else if (e.target.closest("#saveLines")) {
      try {
        const path = contentLang === "en" ? `/content/${active}/en` : `/content/${active}`;
        const items = await api(path, { method: "PUT", body: { items: readList(def, list) } });
        content = { ...content, [contentLang]: { ...content[contentLang], [active]: items } };
        draw();
        toast(t("texts.saved", { name: t(`texts.${active}`), lang: t(`content.${contentLang}`) }));
      } catch (error) {
        toastError(error);
      }
    }
  });
}
