// routes/loja.js — dados da loja (vao no cabecalho do termo) + upload de
// logo. Exclusivo do dono.
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../db");
const { layout, esc } = require("../lib/layout");

const router = express.Router();
const urlencoded = express.urlencoded({ extended: false });

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, "logo" + ext);
    },
  }),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB, igual ao original
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.mimetype);
    cb(ok ? null : new Error("Formato de imagem nao suportado."), ok);
  },
});

function render(req, res, flash) {
  const store = db.prepare("SELECT * FROM store WHERE id = 1").get();
  const body = `
  <h1>Dados da loja</h1>
  <p class="subtitle">Vao no cabecalho do termo de responsabilidade. Preenche uma vez e esquece.</p>

  ${flash?.ok ? `<div class="flash-ok">${esc(flash.ok)}</div>` : ""}
  ${flash?.erro ? `<div class="flash-erro">${esc(flash.erro)}</div>` : ""}

  <div class="card">
    <h3 style="margin-top:0;">Identificacao</h3>
    <form method="post" action="/loja" enctype="multipart/form-data">
      <div class="grid2">
        <div class="field"><label>Nome fantasia</label><input type="text" name="nome_fantasia" value="${esc(store.nome_fantasia)}"></div>
        <div class="field"><label>Razao social</label><input type="text" name="razao_social" value="${esc(store.razao_social)}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>CNPJ</label><input type="text" name="cnpj" value="${esc(store.cnpj)}" placeholder="00.000.000/0001-00"></div>
        <div class="field"><label>Endereco</label><input type="text" name="endereco" value="${esc(store.endereco)}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Cidade</label><input type="text" name="cidade" value="${esc(store.cidade)}"></div>
        <div class="field"><label>UF</label><input type="text" name="uf" maxlength="2" value="${esc(store.uf)}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>CEP</label><input type="text" name="cep" value="${esc(store.cep)}"></div>
        <div class="field"><label>Telefone</label><input type="text" name="telefone" value="${esc(store.telefone)}"></div>
      </div>
      <div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(store.email)}"></div>
      <div class="field">
        <label>Logo (opcional, ate 1 MB)</label>
        ${store.logo_path ? `<div style="margin-bottom:8px;"><img src="/uploads/${esc(store.logo_path)}" style="max-height:60px;"></div>` : ""}
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml">
      </div>
      <button type="submit">Salvar dados da loja</button>
    </form>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Texto do termo</h3>
    <p class="subtitle" style="margin-top:-6px;">As clausulas que o cliente assina. Vem um texto pronto — se seu advogado quiser mudar alguma coisa, e aqui.</p>
    <form method="post" action="/loja/termo-texto">
      <div class="field">
        <textarea name="termo_texto_custom" rows="8" placeholder="Deixe em branco para usar o texto padrao.">${esc(store.termo_texto_custom)}</textarea>
      </div>
      <button type="submit">Salvar texto do termo</button>
    </form>
  </div>
  `;
  res.send(layout({ title: "Dados da loja", user: req.user, activePath: "/loja", body }));
}

router.get("/loja", (req, res) => render(req, res, null));

router.post("/loja", (req, res) => {
  upload.single("logo")(req, res, (err) => {
    if (err) return render(req, res, { erro: err.message });

    const b = req.body;
    const store = db.prepare("SELECT logo_path FROM store WHERE id = 1").get();
    const logo_path = req.file ? path.basename(req.file.filename) : store.logo_path;

    db.prepare(`
      UPDATE store SET nome_fantasia=?, razao_social=?, cnpj=?, endereco=?, cidade=?, uf=?, cep=?, telefone=?, email=?, logo_path=?
      WHERE id = 1
    `).run(b.nome_fantasia, b.razao_social, b.cnpj, b.endereco, b.cidade, b.uf, b.cep, b.telefone, b.email, logo_path);

    render(req, res, { ok: "Dados da loja salvos." });
  });
});

router.post("/loja/termo-texto", urlencoded, (req, res) => {
  db.prepare("UPDATE store SET termo_texto_custom = ? WHERE id = 1").run(String(req.body.termo_texto_custom || ""));
  render(req, res, { ok: "Texto do termo salvo." });
});

module.exports = router;
