// Panel: maçlar (canlı skor kumandası dahil) ve kanallar
import { audit, getSetting, tx } from "../db.js";
import { listChannels, listMatches, toChannel, toMatch } from "../site-data.js";
import { requestLang } from "../i18n/index.js";
import { msg } from "../i18n/messages.js";
import { channelSchema, channelUpdateSchema, idSchema, liveSchema, matchSchema, matchUpdateSchema, parse } from "../validation.js";
import { fail, ok, validated } from "./respond.js";
import { z } from "zod";

const orderSchema = z.object({ ids: z.array(idSchema).min(1).max(500) });

const getMatchRow = (db, id) => db.prepare("SELECT * FROM matches WHERE id = ?").get(id);
const getChannelRow = (db, id) => db.prepare("SELECT * FROM channels WHERE id = ?").get(id);
// Sitede maç ve kanallar tek kimlik sözlüğünde durur (fikstür, oynatıcı, ?mac=): kimlikler iki tabloda da benzersiz olmalı
const idTaken = (db, id) => (getMatchRow(db, id) ? "match" : getChannelRow(db, id) ? "channel" : null);
const SORTABLE = new Set(["matches", "channels"]);
const nextSort = (db, table) => {
  // Tablo adı sorguya gömüldüğü için yalnızca izin listesindekiler
  if (!SORTABLE.has(table)) throw new Error(`Sıralanamayan tablo: ${table}`);
  return db.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM ${table}`).get().n;
};

const matchParams = (m) => [
  m.cat, m.league, m.leagueEn, m.home, m.away, m.homeShort, m.awayShort, m.time, m.status, m.clock, m.period,
  m.score ? m.score[0] : null, m.score ? m.score[1] : null, m.derby ? 1 : 0, m.streams[0] || "", m.streams[1] || "",
];

const channelParams = (c) => [
  c.no, c.name, c.genre, c.genreEn, c.cat, c.now, c.nowEn, c.next, c.nextEn, c.progress, c.matchId, c.feature ? 1 : 0,
  c.streams[0] || "", c.streams[1] || "",
];

/** Canlı kumanda: gol ekle/geri al, durum değiştir — ekrandaki mantıklı varsayılanlarla */
export function applyLive(current, patch) {
  const base = patch.score !== undefined ? patch.score : current.score;
  const side = { home: 0, away: 1 };
  const bump = (score, key, delta) => {
    if (!key) return score;
    const next = [...(score || [0, 0])];
    next[side[key]] = Math.max(0, next[side[key]] + delta);
    return next;
  };
  const status = patch.status ?? current.status;
  const startedWithoutScore = status !== "upcoming" && base === null;
  const score = bump(bump(startedWithoutScore ? [0, 0] : base, patch.goal, 1), patch.undo, -1);
  const finishedNow = status === "finished" && current.status !== "finished";
  return {
    ...current,
    status,
    score,
    clock: patch.clock ?? (finishedNow ? "MS" : current.clock),
    period: patch.period ?? (finishedNow ? "Maç sonu" : current.period),
  };
}

function matchRoutes(router, db) {
  router.get("/matches", (req, res) => ok(res, listMatches(db)));

  router.post("/matches", (req, res) => {
    const m = validated(res, parse(matchSchema, req.body, requestLang(req)));
    if (!m) return undefined;
    const takenM = idTaken(db, m.id);
    if (takenM) return fail(res, 409, msg(req, `idTaken.${takenM}`, { id: m.id }));
    db.prepare(`INSERT INTO matches (cat, league, league_en, home, away, home_short, away_short, time, status, clock, period,
      score_home, score_away, derby, stream_1, stream_2, id, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(...matchParams(m), m.id, m.sort ?? nextSort(db, "matches"));
    audit(db, req.admin.username, "maç eklendi", m.id);
    return ok(res, toMatch(getMatchRow(db, m.id)), 201);
  });

  router.put("/matches/order", (req, res) => {
    const body = validated(res, parse(orderSchema, req.body, requestLang(req)));
    if (!body) return undefined;
    tx(db, () => body.ids.forEach((id, i) => db.prepare("UPDATE matches SET sort = ? WHERE id = ?").run(i, id)));
    audit(db, req.admin.username, "maç sırası değişti");
    return ok(res, listMatches(db));
  });

  router.put("/matches/:id", (req, res) => {
    if (!getMatchRow(db, req.params.id)) return fail(res, 404, msg(req, "matchNotFound"));
    const m = validated(res, parse(matchUpdateSchema, req.body, requestLang(req)));
    if (!m) return undefined;
    db.prepare(`UPDATE matches SET cat = ?, league = ?, league_en = ?, home = ?, away = ?, home_short = ?, away_short = ?, time = ?,
      status = ?, clock = ?, period = ?, score_home = ?, score_away = ?, derby = ?, stream_1 = ?, stream_2 = ?,
      sort = COALESCE(?, sort), updated_at = datetime('now') WHERE id = ?`)
      .run(...matchParams(m), m.sort ?? null, req.params.id);
    audit(db, req.admin.username, "maç güncellendi", req.params.id);
    return ok(res, toMatch(getMatchRow(db, req.params.id)));
  });

  router.patch("/matches/:id/live", (req, res) => {
    const row = getMatchRow(db, req.params.id);
    if (!row) return fail(res, 404, msg(req, "matchNotFound"));
    const patch = validated(res, parse(liveSchema, req.body, requestLang(req)));
    if (!patch) return undefined;
    const next = applyLive(toMatch(row), patch);
    db.prepare(`UPDATE matches SET status = ?, clock = ?, period = ?, score_home = ?, score_away = ?,
      updated_at = datetime('now') WHERE id = ?`)
      .run(next.status, next.clock, next.period, next.score ? next.score[0] : null, next.score ? next.score[1] : null, row.id);
    const what = patch.goal ? `gol: ${patch.goal === "home" ? next.home : next.away}` : "canlı bilgi";
    audit(db, req.admin.username, `canlı güncelleme (${what})`, row.id);
    return ok(res, toMatch(getMatchRow(db, row.id)));
  });

  router.delete("/matches/:id", (req, res) => {
    if (!getMatchRow(db, req.params.id)) return fail(res, 404, msg(req, "matchNotFound"));
    if (getSetting(db, "derby", {}).matchId === req.params.id) {
      return fail(res, 409, msg(req, "matchIsDerby"));
    }
    db.prepare("DELETE FROM matches WHERE id = ?").run(req.params.id);
    audit(db, req.admin.username, "maç silindi", req.params.id);
    return ok(res, { id: req.params.id });
  });
}

function channelRoutes(router, db) {
  const badMatch = (c) => c.matchId && !getMatchRow(db, c.matchId);

  router.get("/channels", (req, res) => ok(res, listChannels(db)));

  router.post("/channels", (req, res) => {
    const c = validated(res, parse(channelSchema, req.body, requestLang(req)));
    if (!c) return undefined;
    const takenC = idTaken(db, c.id);
    if (takenC) return fail(res, 409, msg(req, `idTaken.${takenC}`, { id: c.id }));
    if (badMatch(c)) return fail(res, 400, msg(req, "linkedMatchNotFound"));
    db.prepare(`INSERT INTO channels (no, name, genre, genre_en, cat, now, now_en, next, next_en, progress, match_id, feature,
      stream_1, stream_2, id, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(...channelParams(c), c.id, c.sort ?? nextSort(db, "channels"));
    audit(db, req.admin.username, "kanal eklendi", c.id);
    return ok(res, toChannel(getChannelRow(db, c.id)), 201);
  });

  router.put("/channels/:id", (req, res) => {
    if (!getChannelRow(db, req.params.id)) return fail(res, 404, msg(req, "channelNotFound"));
    const c = validated(res, parse(channelUpdateSchema, req.body, requestLang(req)));
    if (!c) return undefined;
    if (badMatch(c)) return fail(res, 400, msg(req, "linkedMatchNotFound"));
    db.prepare(`UPDATE channels SET no = ?, name = ?, genre = ?, genre_en = ?, cat = ?, now = ?, now_en = ?, next = ?, next_en = ?,
      progress = ?, match_id = ?, feature = ?, stream_1 = ?, stream_2 = ?, sort = COALESCE(?, sort) WHERE id = ?`)
      .run(...channelParams(c), c.sort ?? null, req.params.id);
    audit(db, req.admin.username, "kanal güncellendi", req.params.id);
    return ok(res, toChannel(getChannelRow(db, req.params.id)));
  });

  router.delete("/channels/:id", (req, res) => {
    if (!getChannelRow(db, req.params.id)) return fail(res, 404, msg(req, "channelNotFound"));
    db.prepare("DELETE FROM channels WHERE id = ?").run(req.params.id);
    audit(db, req.admin.username, "kanal silindi", req.params.id);
    return ok(res, { id: req.params.id });
  });
}

export function fixtureRoutes(router, db) {
  matchRoutes(router, db);
  channelRoutes(router, db);
}
