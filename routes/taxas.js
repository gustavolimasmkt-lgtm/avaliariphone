// routes/taxas.js — "Taxas do cartao": tabela de bandeiras x parcelas,
// exclusiva do dono (a equipe so USA os valores, dentro da Calculadora).
const express = require("express");
const db = require("../db");
const { layout, esc } = require("../lib/layout");

const router = express.Router();
const urlencoded = express.urlencoded({ extended: false });

const PARCELAS = ["debito", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x",
  "11x", "12x", "13x", "14x", "15x", "16x", "17x", "18x", "19x", "20x", "21x"];

function loadTaxas() {
  const bandeiras = db.prepare("SELECT * FROM bandeiras ORDER BY sort_order, id").all();
  const taxaRows = db.prepare("SELECT * FROM taxas").all();
  const map = {};
  taxaRows.forEach((t) => {
    map[`${t.bandeira_id}_${t.parcela}`] = t.taxa;
  });
  return bandeiras.map((b) => ({
    ...b,
    taxas: PARCELAS.map((p) => map[`${b.id}_${p}`] ?? 0),
  }));
}

function render(req, res, flash) {
  const bandeiras = loadTaxas();
  const body = `
  <h1>Taxas do cartao</h1>
  <p class="subtitle">As taxas da sua maquininha. Sua equipe usa elas na calculadora, mas nao ve nem edita esta tela.</p>

  ${flash?.ok ? `<div class="flash-ok">${esc(flash.ok)}</div>` : ""}
  ${flash?.erro ? `<div class="flash-erro">${esc(flash.erro)}</div>` : ""}

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0;">Bandeiras (${bandeiras.length})</h3>
      <form method="post" action="/taxas/restaurar" onsubmit="return confirm('Restaurar as taxas padrao?');">
        <button type="submit" class="secundario">Restaurar padrao</button>
      </form>
    </div>
    <form method="post" action="/taxas/salvar">
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Bandeira</th>
              ${PARCELAS.map((p) => `<th>${p === "debito" ? "Debito" : p}</th>`).join("")}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${bandeiras.map((b) => `
            <tr>
              <td><input type="hidden" name="id[]" value="${b.id}"><b>${esc(b.nome)}</b><br><span style="color:var(--muted);font-weight:400;">${esc(b.sigla)}</span></td>
              ${PARCELAS.map((p, i) => `<td><input type="number" step="0.01" name="${b.id}_${p}" value="${b.taxas[i]}" style="width:70px;"></td>`).join("")}
              <td>
                <button type="submit" formaction="/taxas/excluir/${b.id}" formnovalidate class="perigo"
                  onclick="return confirm('Excluir ${esc(b.nome)}?');">Excluir</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p style="color:var(--muted);font-size:13px;">Os valores sao em % — o que a maquininha desconta.</p>
      <button type="submit">Salvar taxas</button>
    </form>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Adicionar bandeira</h3>
    <form method="post" action="/taxas/adicionar" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
      <div class="field" style="flex:1;min-width:180px;margin-bottom:0;">
        <label>Nome</label>
        <input type="text" name="nome" required placeholder="Ex: PIX Parcelado">
      </div>
      <div class="field" style="flex:1;min-width:140px;margin-bottom:0;">
        <label>Sigla</label>
        <input type="text" name="sigla" placeholder="Ex: PIX">
      </div>
      <button type="submit">+ Adicionar</button>
    </form>
    <p style="color:var(--muted);font-size:13px;margin-bottom:0;margin-top:10px;">Ela nasce com todas as taxas zeradas — preencha na tabela acima e salve.</p>
  </div>
  `;
  res.send(layout({ title: "Taxas", user: req.user, activePath: "/taxas", body }));
}

router.get("/taxas", (req, res) => render(req, res, null));

router.post("/taxas/salvar", urlencoded, (req, res) => {
  const ids = [].concat(req.body["id[]"] || []);
  const upsert = db.prepare(
    "INSERT INTO taxas (bandeira_id, parcela, taxa) VALUES (?, ?, ?) ON CONFLICT(bandeira_id, parcela) DO UPDATE SET taxa=excluded.taxa"
  );
  const tx = db.transaction(() => {
    ids.forEach((id) => {
      PARCELAS.forEach((p) => {
        const v = Number(req.body[`${id}_${p}`]) || 0;
        upsert.run(id, p, v);
      });
    });
  });
  tx();
  render(req, res, { ok: "Taxas atualizadas." });
});

router.post("/taxas/adicionar", urlencoded, (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const sigla = String(req.body.sigla || "").trim();
  if (!nome) return render(req, res, { erro: "Informe o nome da bandeira." });
  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) o FROM bandeiras").get().o;
  const { lastInsertRowid } = db
    .prepare("INSERT INTO bandeiras (nome, sigla, sort_order) VALUES (?, ?, ?)")
    .run(nome, sigla, maxOrder + 1);
  const insertTaxa = db.prepare("INSERT INTO taxas (bandeira_id, parcela, taxa) VALUES (?, ?, 0)");
  PARCELAS.forEach((p) => insertTaxa.run(lastInsertRowid, p));
  render(req, res, { ok: `"${nome}" adicionada — taxas zeradas.` });
});

router.post("/taxas/excluir/:id", (req, res) => {
  db.prepare("DELETE FROM bandeiras WHERE id = ?").run(req.params.id);
  db.prepare("DELETE FROM taxas WHERE bandeira_id = ?").run(req.params.id);
  render(req, res, { ok: "Bandeira excluida." });
});

router.post("/taxas/restaurar", (req, res) => {
  const seed = require("../data/seed-taxas.json");
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM taxas").run();
    db.prepare("DELETE FROM bandeiras").run();
    const insertB = db.prepare("INSERT INTO bandeiras (nome, sigla, sort_order) VALUES (?, ?, ?)");
    const insertT = db.prepare("INSERT INTO taxas (bandeira_id, parcela, taxa) VALUES (?, ?, ?)");
    seed.bandeiras.forEach((b, i) => {
      const { lastInsertRowid } = insertB.run(b.nome, b.sigla, i);
      seed.parcelas.forEach((p, j) => insertT.run(lastInsertRowid, p, b.taxas[j] ?? 0));
    });
  });
  tx();
  render(req, res, { ok: "Taxas restauradas para o padrao original." });
});

module.exports = router;
