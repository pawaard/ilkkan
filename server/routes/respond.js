// Ortak API cevap zarfı: { success, data } / { success: false, error }
export const ok = (res, data = null, status = 200) => res.status(status).json({ success: true, data });
export const fail = (res, status, error) => res.status(status).json({ success: false, error });

/** Doğrulama sonucu başarısızsa 400 döndürür; başarılıysa veriyi verir */
export function validated(res, result) {
  if (result.ok) return result.data;
  fail(res, 400, result.error);
  return null;
}
