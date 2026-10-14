/* Hesap: şifre değiştir, yüklenen görseller, son işlemler (denetim kaydı) */
import { api, setCsrf } from "../api.js";
import { getLang, locale, t } from "../i18n.js";
import { confirmAction, field, html, num, raw, readForm, render as paint, toast, toastError } from "../ui.js";

const when = (sqlTime) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  .format(new Date(`${sqlTime.replace(" ", "T")}Z`));

const kb = (bytes) => `${num(Math.ceil(bytes / 1024))} KB`;

// Denetim kaydı Türkçe yazılır (kalıcı kayıt); İngilizce panelde bilinen ifadeler çevrilerek gösterilir
const AUDIT_EN = Object.freeze([
  ["giriş yaptı", "signed in"], ["şifre değiştirdi", "changed the password"],
  ["maç sırası değişti", "reordered matches"], ["maç eklendi", "added a match"], ["maç güncellendi", "updated a match"],
  ["maç silindi", "deleted a match"], ["canlı güncelleme", "live update"], ["(gol: ", "(goal: "], ["(canlı bilgi)", "(live info)"],
  ["kanal eklendi", "added a channel"], ["kanal güncellendi", "updated a channel"], ["kanal silindi", "deleted a channel"],
  ["metin listesi güncellendi", "updated a text list"], ["reklam alanı:", "ad space:"], ["ayar güncellendi", "updated settings"],
  ["görsel yüklendi", "uploaded an image"], ["görsel silindi", "deleted an image"],
]);
const auditText = (action) => (getLang() === "en"
  ? AUDIT_EN.reduce((text, [tr, en]) => text.split(tr).join(en), action)
  : action);

export async function render(root) {
  let [audit, files] = await Promise.all([api("/audit"), api("/uploads")]);

  const gallery = () => (files.length
    ? html`<ul class="gallery">${files.map((f) => html`<li class="gallery__item">
        <img src="${f.url}" alt="" loading="lazy" />
        <span class="gallery__meta"><code>${f.url}</code><small>${kb(f.size)}</small></span>
        <button class="icon-plain icon-plain--danger" type="button" data-delete="${f.name}" aria-label="${t("common.deleteName", { name: f.name })}"><svg aria-hidden="true"><use href="#i-trash" /></svg></button>
      </li>`)}</ul>`
    : html`<p class="empty-state">${t("account.noUploads")}</p>`);

  const draw = () => paint(root, html`
    <header class="view__head">
      <div><p class="eyebrow">07 · ${t("nav.hesap")}</p><h1 class="view__title">${raw(t("account.title"))}</h1></div>
    </header>
    <div class="grid-2">
      <form class="card" id="passwordForm" novalidate>
        <header class="card__head"><div><h2 class="card__title">${t("account.password")}</h2><p class="card__sub">${t("account.passwordSub")}</p></div></header>
        <div class="form-grid form-grid--single">
          ${field({ label: t("account.current"), name: "current", type: "password", required: true, attrs: 'autocomplete="current-password" maxlength="200"' })}
          ${field({ label: t("account.new"), name: "newPassword", type: "password", required: true, hint: t("account.newHint"), attrs: 'autocomplete="new-password" minlength="10" maxlength="200"' })}
          ${field({ label: t("account.again"), name: "again", type: "password", required: true, attrs: 'autocomplete="new-password" maxlength="200"' })}
        </div>
        <footer class="card__foot"><button class="btn btn--ticket btn--sm" type="submit">${t("account.change")}</button></footer>
      </form>
      <section class="card">
        <header class="card__head"><div><h2 class="card__title">${t("account.audit")}</h2><p class="card__sub">${t("account.auditSub")}</p></div></header>
        ${audit.length ? html`<ol class="audit">${audit.map((a) => html`<li><time>${when(a.at)}</time><b>${a.admin}</b> ${auditText(a.action)}${a.target ? html` <code>${a.target}</code>` : ""}</li>`)}</ol>` : html`<p class="empty-state">${t("account.noAudit")}</p>`}
      </section>
    </div>
    <section class="card">
      <header class="card__head"><div><h2 class="card__title">${t("account.uploads")} <small>${files.length}</small></h2><p class="card__sub">${t("account.uploadsSub")}</p></div></header>
      ${gallery()}
    </section>
  `);

  draw();
  root.addEventListener("submit", async (e) => {
    if (e.target.id !== "passwordForm") return;
    e.preventDefault();
    const f = readForm(e.target);
    if (f.newPassword !== f.again) {
      toast(t("account.mismatch"), "error");
      return;
    }
    try {
      const { csrf } = await api("/password", { method: "POST", body: { current: f.current, newPassword: f.newPassword } });
      setCsrf(csrf);
      e.target.reset();
      toast(t("account.changed"));
    } catch (error) {
      toastError(error);
    }
  });
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    try {
      if (!(await confirmAction(t("account.confirmDelete", { name: btn.dataset.delete })))) return;
      await api(`/uploads/${encodeURIComponent(btn.dataset.delete)}`, { method: "DELETE" });
      [audit, files] = await Promise.all([api("/audit"), api("/uploads")]);
      draw();
      toast(t("account.deleted"));
    } catch (error) {
      toastError(error);
    }
  });
}
