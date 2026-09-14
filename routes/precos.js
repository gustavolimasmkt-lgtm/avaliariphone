// routes/precos.js — "Precos": tabela editavel de modelos, so o dono ve.
const express = require("express");
const db = require("../db");
const { layout, esc } = require("../lib/layout");

const router = express.Router();
const urlencoded = express.urlencoded({ extended: false });

const CAMPOS = [
  ["base", "Na troca"],
  ["leves", "Marcas leves"],
  ["moderadas", "Marcas moderadas"],
  ["bateria", "Bateria (saude baixa)"],
  ["tela", "Troca de tela"],
  ["traseira", "Traseira"],
  ["faceid", "Face ID"],
  ["doc_carga", "Doc de carga"],
  ["cam_traseira", "Camera traseira"],
  ["notif_camera", "Notif. peca - camera"],
  ["notif_bateria", "Notif. peca - bateria"],
  ["notif_tela", "Notif. peca - tela"],
];

function render(req, res, flash) {
  const models = db.prepare("SELECT * FROM models ORDER BY sort_order, id").all();
  const store = db.prepare("SELECT regras_texto, bonus_valor FROM store WHERE id = 1").get();

  const body = `
  <h1>Precos</h1>
  <p class="subtitle">Sua tabela de avaliacao. Altere qualquer valor, adicione ou exclua modelos.</p>

  ${flash?.erro ? `<div class="flash-erro">${esc(flash.erro)}</div>` : ""}
  ${flash?.ok ? `<div class="flash-ok">${esc(flash.ok)}</div>` : ""}

  <div class="card">
    <h3 style="margin-top:0;">Adicionar modelo</h3>
    <form method="post" action="/config/adicionar" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
      <div class="field" style="flex:2;min-width:220px;margin-bottom:0;">
        <label>Nome do modelo</label>
        <input type="text" name="name" required placeholder="Ex: iPhone 17 Pro 256GB">
      </div>
      <div class="field" style="flex:1;min-width:140px;margin-bottom:0;">
        <label>Valor na troca (R$)</label>
        <input type="number" step="0.01" name="base" value="0" required>
      </div>
      <button type="submit">+ Adicionar</button>
    </form>
    <p style="color:var(--muted);font-size:13px;margin-bottom:0;margin-top:10px;">O modelo novo entra com todas as avarias zeradas — depois e so preencher na tabela abaixo.</p>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Regras e bonus (aparecem na cotacao)</h3>
    <form method="post" action="/config/regras">
      <div class="field">
        <label>Regras exibidas na cotacao (uma por linha)</label>
        <textarea name="regras_texto" rows="4">${esc(store.regras_texto)}</textarea>
      </div>
      <div class="field" style="max-width:280px;">
        <label>Valor do bonus (R$) — troca por outro seminovo do estoque</label>
        <input type="number" step="0.01" name="bonus_valor" value="${store.bonus_valor}">
      </div>
      <p style="color:var(--muted);font-size:13px;">Deixe 0 para esconder o bonus na cotacao.</p>
      <button type="submit">Salvar regras</button>
    </form>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0;">Tabela de valores (${models.length} modelos)</h3>
      <form method="post" action="/config/restaurar" onsubmit="return confirm('Isso substitui TODOS os valores pela tabela padrao original. Continuar?');">
        <button type="submit" class="secundario">Restaurar padrao</button>
      </form>
    </div>
    <form method="post" action="/config/salvar">
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Modelo</th>
              ${CAMPOS.map(([, label]) => `<th>${esc(label)}</th>`).join("")}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${models.map((m) => `
            <tr>
              <td><input type="hidden" name="id[]" value="${m.id}"><b>${esc(m.name)}</b></td>
              ${CAMPOS.map(([key]) => `
                <td><input type="number" step="0.01" name="${key}_${m.id}" value="${m[key]}" style="width:90px;"></td>
              `).join("")}
              <td>
                <button type="submit" formaction="/config/excluir/${m.id}" formnovalidate class="perigo"
                  onclick="return confirm('Excluir ${esc(m.name)}?');">Excluir</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div style="margin-top:16px;">
        <button type="submit">Salvar alteracoes</button>
      </div>
    </form>
  </div>
  `;

  res.send(layout({ title: "Precos", user: req.user, activePath: "/config", body }));
}

router.get("/config", (req, res) => render(req, res, null));

router.post("/config/salvar", urlencoded, (req, res) => {
  const ids = [].concat(req.body["id[]"] || []);
  const update = db.prepare(`
    UPDATE models SET
      base=@base, leves=@leves, moderadas=@moderadas, bateria=@bateria, tela=@tela,
      traseira=@traseira, faceid=@faceid, doc_carga=@doc_carga, cam_traseira=@cam_traseira,
      notif_camera=@notif_camera, notif_bateria=@notif_bateria, notif_tela=@notif_tela
    WHERE id=@id
  `);
  const tx = db.transaction((rows) => rows.forEach((r) => update.run(r)));
  const rows = ids.map((id) => {
    const row = { id };
    CAMPOS.forEach(([key]) => {
      row[key] = Number(req.body[`${key}_${id}`]) || 0;
    });
    return row;
  });
  tx(rows);
  render(req, res, { ok: "Tabela de precos atualizada." });
});

router.post("/config/adicionar", urlencoded, (req, res) => {
  const name = String(req.body.name || "").trim();
  const base = Number(req.body.base) || 0;
  if (!name) return render(req, res, { erro: "Informe o nome do modelo." });
  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) o FROM models").get().o;
  db.prepare("INSERT INTO models (name, base, sort_order) VALUES (?, ?, ?)").run(name, base, maxOrder + 1);
  render(req, res, { ok: `"${name}" adicionado — as avarias entraram zeradas.` });
});

router.post("/config/excluir/:id", (req, res) => {
  db.prepare("DELETE FROM models WHERE id = ?").run(req.params.id);
  render(req, res, { ok: "Modelo excluido." });
});

router.post("/config/regras", urlencoded, (req, res) => {
  db.prepare("UPDATE store SET regras_texto = ?, bonus_valor = ? WHERE id = 1").run(
    String(req.body.regras_texto || ""),
    Number(req.body.bonus_valor) || 0
  );
  render(req, res, { ok: "Regras e bonus salvos." });
});

router.post("/config/restaurar", (req, res) => {
  const seed = require("../data/seed-models.json");
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM models").run();
    const insert = db.prepare(`
      INSERT INTO models (name, base, leves, moderadas, bateria, tela, traseira, faceid, doc_carga, cam_traseira, notif_camera, notif_bateria, notif_tela, sort_order)
      VALUES (@name, @base, @leves, @moderadas, @bateria, @tela, @traseira, @faceid, @doc_carga, @cam_traseira, @notif_camera, @notif_bateria, @notif_tela, @sort_order)
    `);
    seed.forEach((m, i) => insert.run({ ...m, sort_order: i }));
  });
  tx();
  render(req, res, { ok: "Tabela restaurada para o padrao original." });
});

module.exports = router;
