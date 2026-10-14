/* Kanallar: İlkkan 1–6 kumandası (şimdi/sonra, ilerleme, bağlı maç, yayın adresi) — Türkçe + isteğe bağlı İngilizce */
import { api } from "../api.js";
import { t } from "../i18n.js";
import {
  CAT_LABEL, checkbox, confirmAction, field, html, openModal, raw, readForm, render as paint, select, toast, toastError,
} from "../ui.js";
import { streamNote } from "./maclar.js";

const cats = () => ["futbol", "basketbol", "voleybol", "kanal"].map((value) => ({ value, label: CAT_LABEL[value] }));

function channelForm(c, matches) {
  const v = c || { no: "", cat: "kanal", progress: 0, matchId: null, streams: [] };
  const matchOptions = [{ value: "", label: t("chan.noMatchOption") }, ...matches.map((m) => ({ value: m.id, label: `${m.home} – ${m.away}` }))];
  const en = t("common.enHint");
  return html`<div class="form-grid">
    ${c ? html`<p class="form-id">${t("match.id")}: <code>${c.id}</code></p>` : field({ label: t("match.id"), name: "id", required: true, hint: t("chan.idHint"), attrs: 'maxlength="40" pattern="[a-z0-9-]+"' })}
    ${field({ label: t("chan.no"), name: "no", value: v.no, required: true, hint: "01, 02…", attrs: 'maxlength="3" inputmode="numeric"' })}
    ${field({ label: t("chan.name"), name: "name", value: v.name, required: true, attrs: 'maxlength="30"' })}
    ${select({ label: t("chan.cat"), name: "cat", value: v.cat, options: cats() })}
    ${field({ label: t("chan.genre"), name: "genre", value: v.genre, required: true, hint: t("chan.genreHint"), attrs: 'maxlength="30"' })}
    ${field({ label: t("chan.genreEn"), name: "genreEn", value: v.genreEn || "", hint: en, attrs: 'maxlength="30"' })}
    ${field({ label: t("chan.now"), name: "now", value: v.now, wide: true, attrs: 'maxlength="80"' })}
    ${field({ label: t("chan.nowEn"), name: "nowEn", value: v.nowEn || "", wide: true, hint: en, attrs: 'maxlength="80"' })}
    ${field({ label: t("chan.next"), name: "next", value: v.next, wide: true, attrs: 'maxlength="80"' })}
    ${field({ label: t("chan.nextEn"), name: "nextEn", value: v.nextEn || "", wide: true, hint: en, attrs: 'maxlength="80"' })}
    ${field({ label: t("chan.progress"), name: "progress", value: Math.round((v.progress || 0) * 100), type: "number", hint: t("chan.progressHint"), attrs: 'min="0" max="100"' })}
    ${select({ label: t("chan.match"), name: "matchId", value: v.matchId || "", options: matchOptions, hint: t("chan.matchHint") })}
    ${checkbox({ label: t("chan.feature"), name: "feature", checked: Boolean(v.feature), hint: t("chan.featureHint") })}
    ${field({ label: t("stream.one"), name: "stream1", value: v.streams[0] || "", type: "url", wide: true, hint: t("chan.streamHint"), attrs: 'maxlength="1000"' })}
    ${field({ label: t("stream.two"), name: "stream2", value: v.streams[1] || "", type: "url", wide: true, hint: streamNote(), attrs: 'maxlength="1000"' })}
  </div>`;
}

const toPayload = (form) => {
  const f = readForm(form);
  return {
    ...(f.id !== undefined ? { id: f.id.trim() } : {}),
    no: f.no, name: f.name, genre: f.genre, genreEn: f.genreEn, cat: f.cat,
    now: f.now, nowEn: f.nowEn, next: f.next, nextEn: f.nextEn,
    progress: Math.min(100, Math.max(0, f.progress || 0)) / 100,
    matchId: f.matchId || null,
    feature: f.feature,
    streams: [f.stream1, f.stream2],
  };
};

const card = (c, matches) => {
  const m = c.matchId ? matches.find((x) => x.id === c.matchId) : null;
  const translated = c.genreEn || c.nowEn || c.nextEn;
  return html`<li class="chan-card${c.feature ? " chan-card--feature" : ""}" data-id="${c.id}" style="--p:${c.progress}">
    <span class="chan-card__no">${c.no}</span>
    <div class="chan-card__body">
      <p class="chan-card__genre">${c.genre}${c.feature ? ` · ${t("chan.featured")}` : ""}</p>
      <h2 class="chan-card__name">${c.name}</h2>
      <p class="chan-card__now">${t("chan.nowLine", { text: c.now })}</p>
      <p class="chan-card__next">${t("chan.nextLine", { text: c.next })}</p>
      <span class="chan-card__bar" aria-hidden="true"><span></span></span>
      <p class="chan-card__meta">${m ? t("chan.linked", { name: `${m.home} – ${m.away}` }) : t("chan.noMatch")} · ${c.streams.length ? t("stream.count", { n: c.streams.length }) : t("stream.none")} · ${translated ? "EN ✓" : t("chan.noEnglish")}</p>
    </div>
    <div class="chan-card__actions">
      <button class="btn-plain" type="button" data-act="edit">${t("common.edit")}</button>
      <button class="icon-plain icon-plain--danger" type="button" data-act="delete" aria-label="${t("common.deleteName", { name: c.name })}"><svg aria-hidden="true"><use href="#i-trash" /></svg></button>
    </div>
  </li>`;
};

export async function render(root) {
  let [channels, matches] = await Promise.all([api("/channels"), api("/matches")]);

  const draw = () => paint(root, html`
    <header class="view__head">
      <div><p class="eyebrow">03 · ${t("nav.kanallar")}</p><h1 class="view__title">${raw(t("chan.title"))}</h1></div>
      <div class="view__actions"><button class="btn btn--ticket btn--sm" type="button" id="newChannel">${t("chan.new")}</button></div>
    </header>
    <ul class="chan-grid">${channels.map((c) => card(c, matches))}</ul>
  `);

  const reload = async () => {
    [channels, matches] = await Promise.all([api("/channels"), api("/matches")]);
    draw();
  };

  const edit = (c = null) => openModal({
    title: c ? c.name : t("chan.newTitle"),
    body: channelForm(c, matches),
    onSubmit: async (form) => {
      const body = toPayload(form);
      if (c) await api(`/channels/${encodeURIComponent(c.id)}`, { method: "PUT", body });
      else await api("/channels", { method: "POST", body });
      toast(t(c ? "chan.updated" : "chan.added"));
      await reload();
    },
  });

  draw();
  root.addEventListener("click", async (e) => {
    if (e.target.closest("#newChannel")) {
      edit();
      return;
    }
    const btn = e.target.closest("[data-act]");
    const li = btn && btn.closest(".chan-card");
    const c = li && channels.find((x) => x.id === li.dataset.id);
    if (!c) return;
    try {
      if (btn.dataset.act === "edit") edit(c);
      if (btn.dataset.act === "delete" && (await confirmAction(t("chan.confirmDelete", { name: c.name })))) {
        await api(`/channels/${encodeURIComponent(c.id)}`, { method: "DELETE" });
        toast(t("chan.deleted"));
        await reload();
      }
    } catch (error) {
      toastError(error);
    }
  });
}
