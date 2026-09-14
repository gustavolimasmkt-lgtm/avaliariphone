const express = require("express");
const db = require("../db");
const { verifyPassword } = require("../lib/password");
const { setSessionCookie, clearSessionCookie } = require("../lib/session");
const { layout, esc } = require("../lib/layout");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.user) return res.redirect("/");
  const erro = req.query.erro === "1";
  res.send(
    layout({
      title: "Entrar",
      user: null,
      body: `
      <div style="max-width:380px;margin:60px auto 0;">
        <div class="card">
          <h1 style="font-size:22px;">Avalia iPhone</h1>
          <p class="subtitle">Entre com seu e-mail e senha.</p>
          ${erro ? `<div class="flash-erro">E-mail ou senha incorretos.</div>` : ""}
          <form method="post" action="/login">
            <div class="field">
              <label>E-mail</label>
              <input type="email" name="email" required autofocus>
            </div>
            <div class="field">
              <label>Senha</label>
              <input type="password" name="senha" required>
            </div>
            <button type="submit" style="width:100%;justify-content:center;">Entrar</button>
          </form>
        </div>
      </div>
      `,
    })
  );
});

router.post("/login", express.urlencoded({ extended: false }), (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const senha = String(req.body.senha || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !verifyPassword(senha, user.password_hash, user.salt)) {
    return res.redirect("/login?erro=1");
  }
  setSessionCookie(res, user);
  res.redirect("/");
});

router.get("/logout", (req, res) => {
  clearSessionCookie(res);
  res.redirect("/login");
});

module.exports = router;
