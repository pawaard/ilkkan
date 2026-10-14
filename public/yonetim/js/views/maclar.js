/* Maçlar: liste, sıralama, ekle/düzenle/sil, canlı kumanda */
import { api } from "../api.js";
import { t } from "../i18n.js";
import {
  $, CAT_LABEL, checkbox, confirmAction, field, html, openModal, raw, readForm, render as paint, select,
  STATUS_LABEL, toast, toastError,
} from "../ui.js";
import { bindRemote, remoteCard } from "./live-remote.js";

// Etiketler her çizimde panel dilinden okunur
const cats = () => ["futbol", "basketbol", "voleybol"].map((value) => ({ value, label: CAT_LABEL[value] }));
const statuses = () => ["upcoming", "live", "finished"].map((value) => ({ value, label: STATUS_LABEL[value] }));
const scoreOf = (m) => (m.score ? `${m.score[0]}–${m.score[1]}` : "–");

export const streamNote = () => t("stream.note");

function matchForm(m = null) {
  const v = m || { cat: "futbol", status: "upcoming", time: "20:00", clock: "", period: "", score: null, streams: [] };
  return html`<div class="form-grid">
    ${m ? html`<p class="form-id">${t("match.id")}: <code>${m.id}</code></p>` : field({ label: t("match.idNew"), name: "id", required: true, hint: t("match.idHint"), attrs: 'maxlength="40" pattern="[a-z0-9-]+"' })}
    ${select({ label: t("match.sport"), name: "cat", value: v.cat, options: cats() })}
    ${field({ label: t("match.league"), name: "league", value: v.league, required: true, attrs: 'maxlength="60"' })}
    ${field({ label: t("match.leagueEn"), name: "leagueEn", value: v.leagueEn || "", hint: t("common.enHint"), attrs: 'maxlength="60"' })}
    ${field({ label: t("match.home"), name: "home", value: v.home, required: true, attrs: 'maxlength="40"' })}
    ${field({ label: t("match.short"), name: "homeShort", value: v.homeShort, required: true, hint: t("match.shortHint", { code: "BJK" }), attrs: 'maxlength="5"' })}
    ${field({ label: t("match.away"), name: "away", value: v.away, required: true, attrs: 'maxlength="40"' })}
    ${field({ label: t("match.short"), name: "awayShort", value: v.awayShort, required: true, hint: t("match.shortHint", { code: "TS" }), attrs: 'maxlength="5"' })}
    ${field({ label: t("match.time"), name: "time", value: v.time, type: "time", required: true })}
    ${select({ label: t("match.status"), name: "status", value: v.status, options: statuses() })}
    ${field({ label: t("remote.clock"), name: "clock", value: v.clock, hint: t("match.clockHint"), attrs: 'maxlength="8"' })}
    ${field({ label: t("remote.period"), name: "period", value: v.period, hint: t("match.periodHint"), attrs: 'maxlength="40"' })}
    ${field({ label: t("match.scoreHome"), name: "scoreHome", value: v.score ? v.score[0] : "", type: "number", hint: t("match.scoreHint"), attrs: 'min="0" max="999"' })}
    ${field({ label: t("match.scoreAway"), name: "scoreAway", value: v.score ? v.score[1] : "", type: "number", attrs: 'min="0" max="999"' })}
    ${checkbox({ label: t("match.derby"), name: "derby", checked: Boolean(v.derby), hint: t("match.derbyHint") })}
    ${field({ label: t("stream.one"), name: "stream1", value: v.streams[0] || "", type: "url", wide: true, attrs: 'placeholder="https://…/yayin.m3u8" maxlength="1000"' })}
    ${field({ label: t("stream.two"), name: "stream2", value: v.streams[1] || "", type: "url", wide: true, hint: streamNote(), attrs: 'maxlength="1000"' })}
  </div>`;
}

function toPayload(form) {
  const f = readForm(form);
  const hasScore = f.scoreHome !== null && f.scoreAway !== null;
  if (!hasScore && (f.scoreHome !== null || f.scoreAway !== null)) {
    throw new Error(t("match.scoreBoth"));
  }
  return {
    ...(f.id !== undefined ? { id: f.id.trim() } : {}),
    cat: f.cat, league: f.league, leagueEn: f.leagueEn, home: f.home, away: f.away, homeShort: f.homeShort, awayShort: f.awayShort,
    time: f.time, status: f.status, clock: f.clock, period: f.period,
    score: hasScore ? [f.scoreHome, f.scoreAway] : null,
    derby: f.derby,
    streams: [f.stream1, f.stream2],
  };
}

function row(m, i, total) {
  return html`<li class="row" data-id="${m.id}">
    <span class="chip" data-status="${m.status}"><i class="pulse" aria-hidden="true"></i>${STATUS_LABEL[m.status]}</span>
    <span class="row__time">${m.status === "live" ? m.clock || STATUS_LABEL.live : m.time}</span>
    <span class="row__main"><b>${m.home} <span class="row__score">${scoreOf(m)}</span> ${m.away}</b><small>${m.league} · ${CAT_LABEL[m.cat]}${m.derby ? ` · ${t("match.derbyTag")}` : ""} · ${m.streams.length ? t("stream.count", { n: m.streams.length }) : t("stream.none")}</small></span>
    <span class="row__actions">
      <button class="icon-plain" type="button" data-act="up" aria-label="${t("common.moveUp", { name: `${m.home} – ${m.away}` })}"${i === 0 ? raw(" disabled") : ""}><svg aria-hidden="true"><use href="#i-up" /></svg></button>
      <button class="icon-plain" type="button" data-act="down" aria-label="${t("common.moveDown", { name: `${m.home} – ${m.away}` })}"${i === total - 1 ? raw(" disabled") : ""}><svg aria-hidden="true"><use href="#i-down" /></svg></button>
      <button class="btn-plain" type="button" data-act="remote">${t("match.remote")}</button>
      <button class="btn-plain" type="button" data-act="edit">${t("common.edit")}</button>
      <button class="icon-plain icon-plain--danger" type="button" data-act="delete" aria-label="${t("common.deleteName", { name: `${m.home} – ${m.away}` })}"><svg aria-hidden="true"><use href="#i-trash" /></svg></button>
    </span>
    <div class="row__remote" hidden></div>
  </li>`;
}

export async function render(root, { refreshOnAir }) {
  let matches = await api("/matches");

  const draw = () => {
    paint(root, html`
      <header class="view__head">
        <div><p class="eyebrow">02 · ${t("nav.maclar")}</p><h1 class="view__title">${raw(t("maclar.title"))}</h1></div>
        <div class="view__actions"><button class="btn btn--ticket btn--sm" type="button" id="newMatch">${t("maclar.new")}</button></div>
      </header>
      <p class="view__note">${t("maclar.note")}</p>
      <ol class="rows" id="matchRows">${matches.map((m, i) => row(m, i, matches.length))}</ol>
    `);
  };

  const reload = async () => {
    matches = await api("/matches");
    draw();
    refreshOnAir();
  };

  // Pencere açıkken kumandadan skor/dakika değiştiyse, pencerede dokunulmayan canlı alanlar sunucudaki güncel değeri korur
  const keepLiveFields = async (m, body) => {
    const fresh = (await api("/matches")).find((x) => x.id === m.id) || m;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const pick = (key) => (same(body[key], m[key]) ? fresh[key] : body[key]);
    return { ...body, status: pick("status"), clock: pick("clock"), period: pick("period"), score: pick("score") };
  };

  const edit = (m = null) => openModal({
    title: m ? `${m.home} – ${m.away}` : t("maclar.newTitle"),
    body: matchForm(m),
    onSubmit: async (form) => {
      const body = toPayload(form);
      if (m) await api(`/matches/${encodeURIComponent(m.id)}`, { method: "PUT", body: await keepLiveFields(m, body) });
      else await api("/matches", { method: "POST", body });
      toast(t(m ? "maclar.updated" : "maclar.added"));
      await reload();
    },
  });

  let moving = false; // art arda hızlı tıklamada eski sıradan hesap yapılmasın
  const move = async (id, delta) => {
    if (moving) return;
    const i = matches.findIndex((m) => m.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= matches.length) return;
    const ids = matches.map((m) => m.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    moving = true;
    try {
      matches = await api("/matches/order", { method: "PUT", body: { ids } });
    } finally {
      moving = false;
    }
    draw();
    const again = root.querySelector(`[data-id="${CSS.escape(id)}"] [data-act="${delta < 0 ? "up" : "down"}"]`);
    if (again && !again.disabled) again.focus();
  };

  const remove = async (m) => {
    if (!(await confirmAction(t("maclar.confirmDelete", { name: `${m.home} – ${m.away}` })))) return;
    await api(`/matches/${encodeURIComponent(m.id)}`, { method: "DELETE" });
    toast(t("maclar.deleted"));
    await reload();
  };

  const toggleRemote = (li, m) => {
    const box = $(".row__remote", li);
    box.hidden = !box.hidden;
    if (!box.hidden) paint(box, remoteCard(m));
  };

  draw();
  root.addEventListener("click", async (e) => {
    if (e.target.closest("#newMatch")) {
      edit();
      return;
    }
    const btn = e.target.closest(".row__actions [data-act]");
    const li = btn && btn.closest(".row");
    const m = li && matches.find((x) => x.id === li.dataset.id);
    if (!m) return;
    try {
      if (btn.dataset.act === "edit") edit(m);
      else if (btn.dataset.act === "delete") await remove(m);
      else if (btn.dataset.act === "up") await move(m.id, -1);
      else if (btn.dataset.act === "down") await move(m.id, 1);
      else if (btn.dataset.act === "remote") toggleRemote(li, m);
    } catch (error) {
      toastError(error);
    }
  });
  bindRemote(root, {
    onChange: (updated) => {
      matches = matches.map((m) => (m.id === updated.id ? updated : m));
      const li = root.querySelector(`.row[data-id="${CSS.escape(updated.id)}"]`);
      if (li) {
        const tmp = document.createElement("ol");
        paint(tmp, row(updated, matches.indexOf(updated), matches.length));
        const box = $(".row__remote", li);
        const fresh = tmp.firstElementChild;
        $(".row__remote", fresh).replaceWith(box); // açık kumanda yerinde kalsın
        li.replaceWith(fresh);
      }
      refreshOnAir();
    },
  });
}
