// routes/equipe.js — "Equipe": cadastro de colaboradores. Colaborador so
// acessa Nova cotacao e Calculadora (ver middleware/auth.js). Sem limite de
// vagas aqui — no original o limite existe porque e cobrado por vaga; como
// isso e uso interno, nao tem cobranca, entao nao tem limite.
const express = require("express");
const db = require("../db");
const { hashPassword } = require("../lib/password");
const { layout, esc } = require("../lib/layout");

const router = express.Router();
const urlencoded = express.urlencoded({ extended: false });

function render(req, res, flash) {
  const colaboradores = db.prepare("SELECT * FROM users WHERE role = 'colaborador' ORDER BY name").all();
  const body = `
  <h1>Equipe</h1>
  <p class="subtitle">Cadastre colaboradores. Eles entram com o proprio e-mail e senha, mas so acessam a <b>avaliacao</b> — nao veem nem mexem nos precos.</p>

  ${flash?.ok ? `<div class="flash-ok">${esc(flash.ok)}</div>` : ""}
  ${flash?.erro ? `<div class="flash-erro">${esc(flash.erro)}</div>` : ""}

  <div class="card">
    <h3 style="margin-top:0;">Adicionar colaborador</h3>
    <form method="post" action="/team" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
      <div class="field" style="flex:1;min-width:160px;margin-bottom:0;"><label>Nome</label><input type="text" name="name" required></div>
      <div class="field" style="flex:1;min-width:180px;margin-bottom:0;"><label>E-mail</label><input type="email" name="email" required></div>
      <div class="field" style="flex:1;min-width:140px;margin-bottom:0;"><label>WhatsApp</label><input type="text" name="whatsapp" placeholder="45 99999-9999"></div>
      <div class="field" style="flex:1;min-width:140px;margin-bottom:0;"><label>Senha (min. 6)</label><input type="password" name="senha" minlength="6" required></div>
      <button type="submit">+ Adicionar</button>
    </form>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Colaboradores (${colaboradores.length})</h3>
    ${colaboradores.length === 0 ? `<p style="color:var(--muted);">Nenhum colaborador ainda.</p>` : `
    <div class="tablewrap">
      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Desde</th><th></th></tr></thead>
        <tbody>
          ${colaboradores.map((c) => `
          <tr>
            <td>${esc(c.name)}</td>
            <td>${esc(c.email)}</td>
            <td>${esc(c.whatsapp || "")}</td>
            <td>${esc(c.created_at)}</td>
            <td><form method="post" action="/team/remover/${c.id}" onsubmit="return confirm('Remover ${esc(c.name)}?');"><button type="submit" class="perigo">Remover</button></form></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`}
  </div>
  `;
  res.send(layout({ title: "Equipe", user: req.user, activePath: "/team", body }));
}

router.get("/team", (req, res) => render(req, res, null));

router.post("/team", urlencoded, (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").toLowerCase().trim();
  const whatsapp = String(req.body.whatsapp || "").trim();
  const senha = String(req.body.senha || "");

  if (!name || !email || senha.length < 6) {
    return render(req, res, { erro: "Preencha nome, e-mail e uma senha com pelo menos 6 caracteres." });
  }
  const existe = db.prepare("SELECT 1 FROM users WHERE email = ?").get(email);
  if (existe) return render(req, res, { erro: "Ja existe uma conta com esse e-mail." });

  const { hash, salt } = hashPassword(senha);
  db.prepare(
    "INSERT INTO users (name, email, whatsapp, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, 'colaborador')"
  ).run(name, email, whatsapp, hash, salt);

  render(req, res, { ok: `${name} adicionado(a) — ja pode entrar com o e-mail e senha cadastrados.` });
});

router.post("/team/remover/:id", (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ? AND role = 'colaborador'").run(req.params.id);
  render(req, res, { ok: "Colaborador removido." });
});

module.exports = router;
