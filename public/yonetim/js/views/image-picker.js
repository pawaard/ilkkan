/* Görsel seçici: önizleme + adres + bilgisayardan yükleme + yüklenenlerden seçme */
import { api, uploadImage } from "../api.js";
import { t } from "../i18n.js";
import { $, $$, html, render as paint, toast, toastError } from "../ui.js";

const looksLikeImage = (v) => /^\/(assets\/img|uploads)\/[\w.-]+$/.test(v) || /^https:\/\/\S+$/.test(v);

export function imagePicker({ label, name, value = "", hint = t("picker.hint") }) {
  return html`<div class="picker field--wide" data-picker>
    <span class="field__label">${label}</span>
    <div class="picker__row">
      <span class="picker__frame">${value ? html`<img class="picker__preview" src="${value}" alt="" />` : html`<span class="picker__empty">${t("picker.empty")}</span>`}</span>
      <div class="picker__controls">
        <input class="input" name="${name}" value="${value}" placeholder="${t("picker.placeholder")}" maxlength="500" />
        <div class="picker__btns">
          <label class="btn-plain picker__upload">${t("picker.upload")}<input type="file" accept="image/png,image/jpeg,image/webp" hidden /></label>
          <button class="btn-plain" type="button" data-gallery>${t("picker.gallery")}</button>
        </div>
        <span class="field__hint">${hint}</span>
      </div>
    </div>
    <div class="picker__gallery" hidden></div>
  </div>`;
}

function setValue(picker, url) {
  const input = $("input.input", picker);
  input.value = url;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function preview(picker) {
  const value = $("input.input", picker).value.trim();
  const frame = $(".picker__frame", picker);
  paint(frame, looksLikeImage(value) ? html`<img class="picker__preview" src="${value}" alt="" />` : html`<span class="picker__empty">${t("picker.empty")}</span>`);
}

async function openGallery(picker) {
  const box = $(".picker__gallery", picker);
  if (!box.hidden) {
    box.hidden = true;
    return;
  }
  const files = await api("/uploads");
  paint(box, files.length
    ? files.map((f) => html`<button class="picker__thumb" type="button" data-url="${f.url}" aria-label="${t("picker.choose", { name: f.name })}"><img src="${f.url}" alt="" loading="lazy" /></button>`)
    : html`<p class="field__hint">${t("picker.none")}</p>`);
  box.hidden = false;
}

/** Kök altındaki tüm görsel seçicileri bağlar (olay devri; bir kez çağır) */
export function bindImagePickers(root) {
  root.addEventListener("change", async (e) => {
    const input = e.target.closest('[data-picker] input[type="file"]');
    if (!input || !input.files || !input.files[0]) return;
    const picker = input.closest("[data-picker]");
    const label = input.closest(".picker__upload");
    label.classList.add("is-busy");
    try {
      const file = await uploadImage(input.files[0]);
      setValue(picker, file.url);
      toast(t("picker.uploaded"));
    } catch (error) {
      toastError(error);
    } finally {
      label.classList.remove("is-busy");
      input.value = "";
    }
  });
  root.addEventListener("input", (e) => {
    const picker = e.target.closest("[data-picker]");
    if (picker && e.target.matches("input.input")) preview(picker);
  });
  root.addEventListener("click", async (e) => {
    const thumb = e.target.closest(".picker__thumb");
    if (thumb) {
      const picker = thumb.closest("[data-picker]");
      setValue(picker, thumb.dataset.url);
      $(".picker__gallery", picker).hidden = true;
      return;
    }
    const gallery = e.target.closest("[data-gallery]");
    if (!gallery) return;
    try {
      await openGallery(gallery.closest("[data-picker]"));
    } catch (error) {
      toastError(error);
    }
  });
}

export const closeGalleries = (root) => $$(".picker__gallery", root).forEach((g) => { g.hidden = true; });
