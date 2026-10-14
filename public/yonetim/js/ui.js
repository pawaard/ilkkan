/* Panel arayüz yardımcıları: güvenli HTML şablonu, form, pencere, bildirim */
import { locale, t } from "./i18n.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESCAPES = Object.freeze({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" });
export const esc = (value) => String(value ?? "").replace(/[&<>"'`]/g, (ch) => ESCAPES[ch]);

/* ---------- html`` : değerler otomatik kaçışlanır; iç içe şablonlar ham kalır ---------- */
class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}
export const raw = (value) => new Raw(String(value));
const fmt = (v) => {
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(fmt).join("");
  if (v === null || v === undefined || v === false) return "";
  return esc(v);
};
export const html = (strings, ...values) =>
  raw(strings.reduce((out, s, i) => out + s + (i < values.length ? fmt(values[i]) : ""), ""));
// Dizi de kabul eder (String(dizi) virgülle birleştirirdi → ekranda başıboş virgüller)
export const render = (node, template) => {
  node.innerHTML = Array.isArray(template) ? template.map(String).join("") : String(template);
};

/* ---------- Bildirim ---------- */
let toastTimer = 0;
export function toast(message, kind = "ok") {
  const node = $("#toast");
  node.textContent = message;
  node.dataset.kind = kind;
  node.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("is-shown"), kind === "error" ? 6000 : 3200);
}
export const toastError = (error) => toast(error instanceof Error ? error.message : String(error), "error");

/* ---------- Form alanları ---------- */
export function field({ label, name, value = "", type = "text", hint = "", required = false, attrs = "", wide = false }) {
  const req = required ? raw(" required") : "";
  return html`<label class="field${wide ? " field--wide" : ""}">
    <span class="field__label">${label}${required ? raw('<i aria-hidden="true">*</i>') : ""}</span>
    <input class="input" type="${type}" name="${name}" value="${value}"${req} ${raw(attrs)} />
    ${hint ? html`<span class="field__hint">${hint}</span>` : ""}
  </label>`;
}

export function textarea({ label, name, value = "", hint = "", rows = 4, attrs = "", wide = true }) {
  return html`<label class="field${wide ? " field--wide" : ""}">
    <span class="field__label">${label}</span>
    <textarea class="input input--area" name="${name}" rows="${rows}" ${raw(attrs)}>${value}</textarea>
    ${hint ? html`<span class="field__hint">${hint}</span>` : ""}
  </label>`;
}

export function select({ label, name, value = "", options, hint = "", wide = false }) {
  const opts = options.map((o) => html`<option value="${o.value}"${String(o.value) === String(value) ? raw(" selected") : ""}>${o.label}</option>`);
  return html`<label class="field${wide ? " field--wide" : ""}">
    <span class="field__label">${label}</span>
    <select class="input" name="${name}">${opts}</select>
    ${hint ? html`<span class="field__hint">${hint}</span>` : ""}
  </label>`;
}

export function checkbox({ label, name, checked = false, hint = "" }) {
  return html`<label class="check">
    <input type="checkbox" name="${name}"${checked ? raw(" checked") : ""} />
    <span><b>${label}</b>${hint ? html`<small>${hint}</small>` : ""}</span>
  </label>`;
}

/** Form → düz nesne (onay kutuları true/false, sayı alanları number) */
export function readForm(form) {
  const out = {};
  Array.from(form.elements).forEach((input) => {
    if (!input.name || input.disabled) return;
    if (input.type === "checkbox") out[input.name] = input.checked;
    else if (input.type === "number" || input.type === "range") out[input.name] = input.value === "" ? null : Number(input.value);
    else out[input.name] = input.value;
  });
  return out;
}

/* ---------- Pencere (dialog) ---------- */
const modal = () => $("#modal");

/**
 * @param {{ title: string, body: unknown, submitLabel?: string, onSubmit: (form: HTMLFormElement) => Promise<void> }} options
 */
export function openModal({ title, body, submitLabel = t("common.save"), onSubmit }) {
  const dialog = modal();
  const form = $("#modalForm");
  const error = $("#modalError");
  $("#modalTitle").textContent = title;
  render($("#modalBody"), body);
  $("#modalSubmit").textContent = submitLabel;
  error.hidden = true;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const submit = $("#modalSubmit");
    submit.disabled = true;
    error.hidden = true;
    try {
      await onSubmit(form);
      dialog.close();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : String(err);
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  };
  dialog.showModal();
  const first = $("input:not([type=hidden]), select, textarea", form);
  if (first) first.focus();
}

export function bindModal() {
  const dialog = modal();
  // Arka plana tıklayınca kapan — ama metin seçerken fare dışarıda bırakılırsa kapanma (basış da dışarıda olmalı)
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (e) => { pressedOutside = e.target === dialog; });
  dialog.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]") || (e.target === dialog && pressedOutside)) dialog.close();
  });
}

/** Onay sorusu (silme vb.) */
export function confirmAction(message, { confirmLabel = t("common.yesDelete") } = {}) {
  return new Promise((resolve) => {
    openModal({
      title: t("common.sure"),
      body: html`<p class="modal__text">${message}</p>`,
      submitLabel: confirmLabel,
      onSubmit: async () => resolve(true),
    });
    modal().addEventListener("close", () => resolve(false), { once: true });
  });
}

/* ---------- Biçimlendirme ---------- */
export const num = (n) => new Intl.NumberFormat(locale()).format(n || 0);
export const pct = (part, whole) => (whole
  ? new Intl.NumberFormat(locale(), { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(part / whole)
  : "—");
export const dayLabel = (iso) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`));
// Panel dili değişince yeniden çizilen ekranlar güncel etiketi okusun diye her erişimde sözlükten
export const STATUS_LABEL = new Proxy({}, { get: (_, key) => t(`status.${String(key)}`) });
export const CAT_LABEL = new Proxy({}, { get: (_, key) => t(`cat.${String(key)}`) });
