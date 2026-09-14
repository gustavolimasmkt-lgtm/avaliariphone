// routes/termos.js — emissao do termo de responsabilidade. Reproduz a
// decisao de privacidade do sistema original: nome/CPF/nascimento/endereco/
// assinatura do cliente NUNCA sao gravados no banco — so existem dentro do
// PDF, que e gerado na hora e não fica guardado no servidor. So gravamos
// IMEI + modelo + valor + se a consulta Anatel foi feita, pra dar pra
// localizar o termo depois (busca por IMEI, nunca por nome de pessoa).
const express = require("express");
const db = require("../db");
const { layout, esc } = require("../lib/layout");
const { gerarTermoPdf } = require("../lib/pdf");

const router = express.Router();
const urlencoded = express.urlencoded({ extended: false, limit: "5mb" }); // assinatura em base64 vai no body

// Link oficial de consulta de IMEI (Celular Legal / Anatel + ABR Telecom).
// Confira periodicamente se o governo nao mudou a URL.
const ANATEL_URL = "https://www.gov.br/anatel/pt-br/assuntos/celular-legal/consulte-sua-situacao";

router.get("/termos", (req, res) => {
  const q = String(req.query.q || "").trim();
  const termos = q
    ? db.prepare("SELECT * FROM termos WHERE imei LIKE ? ORDER BY created_at DESC LIMIT 100").all(`%${q}%`)
    : db.prepare("SELECT * FROM termos ORDER BY created_at DESC LIMIT 100").all();
  const total = db.prepare("SELECT COUNT(*) c FROM termos").get().c;

  const body = `
  <h1>Termos emitidos</h1>
  <p class="subtitle">${total} no total. Busque pelo IMEI do aparelho.</p>

  <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
    <form method="get" action="/termos" style="display:flex;gap:10px;flex:1;min-width:260px;">
      <input type="text" name="q" value="${esc(q)}" placeholder="IMEI, codigo ou modelo" style="max-width:320px;">
      <button type="submit" class="secundario">Buscar</button>
    </form>
    <a class="btn" href="/termos/novo">+ Novo termo</a>
  </div>

  <div class="card">
    ${termos.length === 0 ? `<p style="color:var(--muted);">Nenhum termo emitido ainda.</p>` : `
    <div class="tablewrap">
      <table>
        <thead><tr><th>IMEI</th><th>Modelo</th><th>Valor pago</th><th>Anatel conferida</th><th>Emitido em</th></tr></thead>
        <tbody>
          ${termos.map((t) => `
          <tr>
            <td>${esc(t.imei)}</td>
            <td>${esc(t.modelo)}</td>
            <td>R$ ${Number(t.valor_pago).toFixed(2)}</td>
            <td>${t.anatel_ok ? "Sim" : "Não"}</td>
            <td>${esc(t.created_at)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`}
  </div>

  <div class="card" style="background:var(--warn-bg);border-color:#cdd6ff;">
    <b>Por que não tem o nome do cliente aqui</b>
    <p style="font-size:14px;margin:8px 0 0;">Nome, CPF, foto e assinatura ficam só dentro do PDF que você baixou — nunca são guardados no nosso servidor. É o que mantém você fora da obrigação de proteger dado de terceiro. Por isso a busca é pelo IMEI: identifica o aparelho sem identificar a pessoa.</p>
    <p style="font-size:14px;margin:8px 0 0;"><b>Guarde os PDFs.</b> Se perder, não temos cópia para reenviar.</p>
  </div>
  `;
  res.send(layout({ title: "Termos", user: req.user, activePath: "/termos", body }));
});

router.get("/termos/novo", (req, res) => {
  const store = db.prepare("SELECT nome_fantasia FROM store WHERE id = 1").get();
  const body = `
  <h1>Termo de responsabilidade</h1>
  <p class="subtitle">O cliente declara que o aparelho é dele e de origem lícita. Assina aqui mesmo, no seu celular.</p>

  ${!store.nome_fantasia ? `<div class="banner">Antes de emitir, preencha os <a href="/loja">dados da sua loja</a> — eles vão no cabeçalho do documento.</div>` : ""}

  <form method="post" action="/termos/novo" id="form-termo">
    <div class="card">
      <h3 style="margin-top:0;">Aparelho</h3>
      <div class="grid2">
        <div class="field"><label>Modelo</label><input type="text" name="modelo" required placeholder="iPhone 11 64GB Preto"></div>
        <div class="field"><label>IMEI</label><input type="text" name="imei" required placeholder="356789104532198" id="imei"></div>
      </div>
      <div class="field" style="max-width:220px;"><label>Valor pago</label><input type="number" step="0.01" name="valor_pago" required></div>

      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:6px;">
        <button type="button" class="secundario" id="btn-anatel">🔎 Consultar na Anatel</button>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;">
          <input type="checkbox" name="anatel_ok" value="1" style="width:auto;"> Consultei e não há impedimento
        </label>
      </div>
      <p style="color:var(--muted);font-size:13px;margin-bottom:0;">
        O botão copia o IMEI e abre a consulta oficial numa aba nova — é só colar. Marcando a caixa, fica registrado no PDF que você conferiu antes de comprar.<br>
        O IMEI também é como você acha este termo depois. Nos iPhones: Ajustes › Geral › Sobre, ou disque *#06#.
      </p>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Quem está entregando o aparelho</h3>
      <div class="grid2">
        <div class="field"><label>Nome completo</label><input type="text" name="cliente_nome" required></div>
        <div class="field"><label>CPF</label><input type="text" name="cliente_cpf" required></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Nascimento</label><input type="date" name="cliente_nascimento"></div>
        <div class="field"><label>Telefone</label><input type="text" name="cliente_telefone"></div>
      </div>
      <div class="field"><label>Endereço</label><input type="text" name="cliente_endereco"></div>
      <div class="grid2">
        <div class="field"><label>Cidade</label><input type="text" name="cliente_cidade"></div>
        <div class="field"><label>UF</label><input type="text" name="cliente_uf" maxlength="2"></div>
      </div>
      <div class="field" style="max-width:220px;"><label>CEP</label><input type="text" name="cliente_cep"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Assinatura</h3>
      <p class="subtitle" style="margin-top:-6px;">Peça pro cliente assinar com o dedo ou o mouse na área abaixo.</p>
      <canvas id="sig" class="sig-pad"></canvas>
      <div style="margin-top:10px;">
        <button type="button" class="secundario" id="btn-limpar-sig">Limpar assinatura</button>
      </div>
      <input type="hidden" name="assinatura" id="assinatura-input">
    </div>

    <button type="submit" id="btn-emitir">Emitir termo e gerar PDF »</button>
  </form>

  <script>
    // Consulta Anatel: copia o IMEI e abre a pagina oficial numa aba nova.
    document.getElementById("btn-anatel").addEventListener("click", async () => {
      const imei = document.getElementById("imei").value.trim();
      if (imei && navigator.clipboard) {
        try { await navigator.clipboard.writeText(imei); } catch (e) {}
      }
      window.open(${JSON.stringify(ANATEL_URL)}, "_blank");
    });

    // Assinatura em canvas (mouse + touch), sem biblioteca externa.
    const canvas = document.getElementById("sig");
    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#16181d";
    }
    resize();
    window.addEventListener("resize", resize);

    let desenhando = false;
    let ultimo = null;
    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: p.clientX - rect.left, y: p.clientY - rect.top };
    }
    function start(e) { desenhando = true; ultimo = pos(e); e.preventDefault(); }
    function mover(e) {
      if (!desenhando) return;
      const ctx = canvas.getContext("2d");
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(ultimo.x, ultimo.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ultimo = p;
      e.preventDefault();
    }
    function fim() { desenhando = false; }
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", fim);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", mover, { passive: false });
    canvas.addEventListener("touchend", fim);

    document.getElementById("btn-limpar-sig").addEventListener("click", () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    document.getElementById("form-termo").addEventListener("submit", (e) => {
      document.getElementById("assinatura-input").value = canvas.toDataURL("image/png");
      const btn = document.getElementById("btn-emitir");
      btn.disabled = true;
      btn.textContent = "Gerando PDF...";
    });
  </script>
  `;
  res.send(layout({ title: "Novo termo", user: req.user, activePath: "/termos", body }));
});

router.post("/termos/novo", urlencoded, (req, res) => {
  const b = req.body;
  const store = db.prepare("SELECT * FROM store WHERE id = 1").get();

  const aparelho = {
    modelo: String(b.modelo || "").trim(),
    imei: String(b.imei || "").trim(),
    valor_pago: Number(b.valor_pago) || 0,
    anatel_ok: b.anatel_ok === "1",
  };
  const cliente = {
    nome: String(b.cliente_nome || "").trim(),
    cpf: String(b.cliente_cpf || "").trim(),
    nascimento: String(b.cliente_nascimento || "").trim(),
    telefone: String(b.cliente_telefone || "").trim(),
    endereco: String(b.cliente_endereco || "").trim(),
    cidade: String(b.cliente_cidade || "").trim(),
    uf: String(b.cliente_uf || "").trim(),
    cep: String(b.cliente_cep || "").trim(),
  };

  if (!aparelho.imei || !aparelho.modelo || !cliente.nome || !cliente.cpf) {
    return res.status(400).send("Preencha modelo, IMEI, nome e CPF antes de emitir o termo.");
  }

  let assinaturaBuffer = null;
  if (b.assinatura && b.assinatura.startsWith("data:image/png;base64,")) {
    assinaturaBuffer = Buffer.from(b.assinatura.split(",")[1], "base64");
  }

  // Unico ponto onde os dados do cliente (PII) existem no servidor: ficam
  // so nessas variaveis locais, usadas pra montar o PDF, e somem quando a
  // resposta terminar. So o que vai pro banco e o INSERT abaixo.
  db.prepare(
    "INSERT INTO termos (imei, modelo, valor_pago, anatel_ok, created_by) VALUES (?, ?, ?, ?, ?)"
  ).run(aparelho.imei, aparelho.modelo, aparelho.valor_pago, aparelho.anatel_ok ? 1 : 0, req.user.id);

  const nomeArquivo = `termo-${aparelho.imei.replace(/\D/g, "") || "aparelho"}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);

  gerarTermoPdf({ res, store, aparelho, cliente, assinaturaBuffer });
});

module.exports = router;
