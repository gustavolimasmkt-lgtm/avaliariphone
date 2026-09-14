// lib/session.js — sessao "stateless" via cookie assinado (HMAC).
// Sem express-session/connect-sqlite3: o cookie carrega {uid, role} e uma
// assinatura HMAC com SESSION_SECRET. Nao precisa de tabela de sessao nem
// se perde em restart do Railway. Se SESSION_SECRET mudar, todo mundo e
// deslogado (normal, e esperado ao trocar o segredo).

const crypto = require("crypto");

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error(
    "SESSION_SECRET nao definido. Configure essa variavel de ambiente (uma string aleatoria longa) antes de subir o servidor."
  );
}

const COOKIE_NAME = "sessao";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function sign(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function unsign(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [b64, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function setSessionCookie(res, user) {
  const token = sign({ uid: user.id, role: user.role, name: user.name });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  return unsign(token);
}

module.exports = { setSessionCookie, clearSessionCookie, readSession, COOKIE_NAME };
