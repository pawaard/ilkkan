/* Yönetim API istemcisi: oturum çerezi tarayıcıda, CSRF belirteci bellekte; sunucu mesajları panel dilinde gelir */
import { getLang, t } from "./i18n.js";

let csrf = "";
let siteUrl = "";
let onUnauthorized = () => {};

export const setCsrf = (token) => { csrf = token || ""; };
export const whenUnauthorized = (fn) => { onUnauthorized = fn; };

// Panel ayrı alan adında (ADMIN_HOST) açılabildiği için siteye giden bağlantılar tam adresle kurulur
export const setSiteUrl = (url) => { siteUrl = url || ""; };
export const siteHref = (path) => `${siteUrl}${path}`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json", "X-Lang": getLang() };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrf;
  let res;
  try {
    res = await fetch(`/api/admin${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(t("api.offline"), 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && path !== "/login") onUnauthorized();
  if (!res.ok || !data || !data.success) {
    throw new ApiError((data && data.error) || t("api.failed", { status: res.status }), res.status);
  }
  return data.data;
}

/** Görseli base64 olarak yükler (en fazla 1 MB; PNG/JPG/WebP) */
export function uploadImage(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 1024 * 1024) {
      reject(new ApiError(t("upload.tooBig"), 400));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new ApiError(t("upload.unreadable"), 0));
    reader.onload = () => {
      api("/uploads", { method: "POST", body: { name: file.name, data: String(reader.result) } }).then(resolve, reject);
    };
    reader.readAsDataURL(file);
  });
}
