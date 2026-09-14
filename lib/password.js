// lib/password.js — hash de senha com scrypt nativo do Node.
// De proposito NAO usa bcrypt: bcrypt e um modulo nativo que precisa
// compilar (igual o better-sqlite3), e ja tivemos dor de cabeca com
// compilacao nativa no Railway em outro projeto. scrypt vem embutido
// no Node, zero dependencia extra.

const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(check, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { hashPassword, verifyPassword };
