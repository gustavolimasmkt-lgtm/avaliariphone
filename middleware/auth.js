// middleware/auth.js — autenticacao e permissao por papel.
// Regra copiada do sistema original: colaborador so acessa a tela de
// avaliacao (Nova cotacao). Tudo o resto (precos, taxas, loja, equipe,
// termos) e exclusivo do owner.

const db = require("../db");
const { readSession } = require("../lib/session");

function attachUser(req, res, next) {
  const session = readSession(req);
  if (session) {
    const user = db
      .prepare("SELECT id, name, email, role FROM users WHERE id = ?")
      .get(session.uid);
    req.user = user || null;
  } else {
    req.user = null;
  }
  res.locals.user = req.user;
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect("/login");
  next();
}

function requireOwner(req, res, next) {
  if (!req.user) return res.redirect("/login");
  if (req.user.role !== "owner") {
    return res
      .status(403)
      .send("Essa tela e restrita ao dono da conta. Fale com quem administra o sistema.");
  }
  next();
}

module.exports = { attachUser, requireLogin, requireOwner };
