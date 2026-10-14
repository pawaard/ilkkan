/* Özet: bugünün sayaçları, 14 günlük grafik, canlı maçlar, reklam alanı performansı */
import { api } from "../api.js";
import { t } from "../i18n.js";
import { dayLabel, html, num, pct, raw, render as paint } from "../ui.js";
import { bindRemote, remoteCard } from "./live-remote.js";

const tile = (label, value, note = "") => html`<div class="meter">
  <span class="meter__label">${label}</span>
  <b class="meter__value">${value}</b>
  ${note ? html`<span class="meter__note">${note}</span>` : ""}
</div>`;

/** Reklam alanı adı panel dilinde (sözlükte yoksa veritabanındaki ad) */
export const unitLabel = (u) => {
  const key = `unit.${u.id}`;
  const label = t(key);
  return label === key ? u.label : label;
};

function chart(series) {
  const W = 700;
  const H = 220;
  const pad = { top: 16, bottom: 28, left: 8, right: 8 };
  const max = Math.max(1, ...series.map((d) => d.views));
  const step = (W - pad.left - pad.right) / series.length;
  const y = (v) => H - pad.bottom - ((H - pad.top - pad.bottom) * v) / max;
  const bars = series.map((d, i) => {
    const x = pad.left + i * step;
    return html`<g>
      <title>${t("ozet.barTitle", { day: dayLabel(d.day), views: num(d.views), visitors: num(d.visitors) })}</title>
      <rect class="bar bar--views" x="${(x + step * 0.14).toFixed(1)}" y="${y(d.views).toFixed(1)}" width="${(step * 0.72).toFixed(1)}" height="${(H - pad.bottom - y(d.views)).toFixed(1)}" rx="3" />
      <rect class="bar bar--visitors" x="${(x + step * 0.34).toFixed(1)}" y="${y(d.visitors).toFixed(1)}" width="${(step * 0.32).toFixed(1)}" height="${(H - pad.bottom - y(d.visitors)).toFixed(1)}" rx="2" />
      ${i % 2 === series.length % 2 ? "" : html`<text class="chart__day" x="${(x + step / 2).toFixed(1)}" y="${H - 8}">${dayLabel(d.day)}</text>`}
    </g>`;
  });
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("ozet.chartLabel", { days: series.length })}">
    <line class="chart__base" x1="0" x2="${W}" y1="${H - pad.bottom}" y2="${H - pad.bottom}" />
    ${bars}
  </svg>`;
}

function unitTable(units, ads) {
  if (units.length === 0) return html`<p class="empty-state">${t("ozet.noImps")}</p>`;
  const byId = Object.fromEntries(ads.map((a) => [a.id, a]));
  const rows = units.slice(0, 8).map((u) => html`<tr>
    <td><b>${byId[u.id] ? unitLabel(byId[u.id]) : u.id}</b><small>${/^\d+$/.test(u.id) ? t("unit.space", { no: u.id }) : u.id}</small></td>
    <td class="num">${num(u.imps)}</td><td class="num">${num(u.clicks)}</td><td class="num">${pct(u.clicks, u.imps)}</td>
  </tr>`);
  return html`<table class="table"><thead><tr><th>${t("stats.space")}</th><th class="num">${t("stats.imps")}</th><th class="num">${t("stats.clicks")}</th><th class="num">${t("stats.ctr")}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export async function render(root, { refreshOnAir }) {
  const [stats, matches, ads] = await Promise.all([api("/stats?days=14"), api("/matches"), api("/ads")]);
  const live = matches.filter((m) => m.status === "live");
  const today = stats.today;
  const total = stats.series.reduce((n, d) => n + d.views, 0);

  paint(root, html`
    <header class="view__head">
      <div><p class="eyebrow">01 · ${t("nav.ozet")}</p><h1 class="view__title">${raw(t("ozet.title"))}</h1></div>
      <p class="view__note">${t("ozet.note")}</p>
    </header>
    <section class="meters" aria-label="${t("ozet.today")}">
      ${tile(t("ozet.views"), num(today.views), t("ozet.viewsNote", { total: num(total) }))}
      ${tile(t("ozet.visitors"), num(today.visitors), t("ozet.visitorsNote"))}
      ${tile(t("ozet.imps"), num(today.imps))}
      ${tile(t("ozet.clicks"), num(today.clicks), t("ozet.ctrNote", { ctr: pct(today.clicks, today.imps) }))}
      ${tile(t("ozet.plays"), num(today.plays))}
    </section>
    <div class="grid-2">
      <section class="card">
        <header class="card__head"><h2 class="card__title">${t("ozet.last14")}</h2>
          <p class="legend"><i class="legend__dot legend__dot--views"></i>${t("ozet.views")} <i class="legend__dot legend__dot--visitors"></i>${t("ozet.unique")}</p></header>
        ${chart(stats.series)}
      </section>
      <section class="card">
        <header class="card__head"><h2 class="card__title">${t("nav.reklam")} <small>${t("ozet.days14")}</small></h2><a class="card__more" href="#reklam">${t("ozet.all")}</a></header>
        ${unitTable(stats.units, ads)}
      </section>
    </div>
    <section class="card card--flat">
      <header class="card__head"><h2 class="card__title">${t("ozet.liveNow")} <small>${t("ozet.liveCount", { n: live.length })}</small></h2><a class="card__more" href="#maclar">${t("ozet.allMatches")}</a></header>
      <div class="remotes" id="liveRemotes">${live.length ? live.map(remoteCard) : html`<p class="empty-state">${t("ozet.noLive")}</p>`}</div>
    </section>
  `);
  bindRemote(root.querySelector("#liveRemotes"), { onChange: refreshOnAir });
}
