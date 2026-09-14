// routes/calculadora.js — "Calculadora de taxas": qualquer usuario logado
// usa, mas os valores de taxa vem prontos do servidor (nao da pra editar
// aqui — edicao e so em /taxas, exclusiva do dono).
const express = require("express");
const db = require("../db");
const { layout, esc } = require("../lib/layout");

const router = express.Router();

const PARCELAS = ["debito", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x",
  "11x", "12x", "13x", "14x", "15x", "16x", "17x", "18x", "19x", "20x", "21x"];

router.get("/calculadora", (req, res) => {
  const bandeiras = db.prepare("SELECT * FROM bandeiras ORDER BY sort_order, id").all();
  const taxaRows = db.prepare("SELECT * FROM taxas").all();
  const map = {};
  taxaRows.forEach((t) => { map[`${t.bandeira_id}_${t.parcela}`] = t.taxa; });
  const dados = bandeiras.map((b) => ({
    id: b.id, nome: b.nome, sigla: b.sigla,
    taxas: PARCELAS.map((p) => map[`${b.id}_${p}`] ?? 0),
  }));

  const body = `
  <h1>Calculadora de taxas</h1>
  <p class="subtitle">Quanto cobrar no cartao para receber o valor limpo, ja com a taxa da maquininha.</p>

  <div class="grid2">
    <div class="card">
      <div class="grid2">
        <div class="field">
          <label>Valor do servico / aparelho</label>
          <input type="text" id="valor" inputmode="decimal" placeholder="0,00">
        </div>
        <div class="field">
          <label>Entrada (opcional)</label>
          <input type="text" id="entrada" inputmode="decimal" placeholder="0,00">
        </div>
      </div>
      <label>Bandeira do cartao</label>
      <div id="bandeiras" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"></div>
      <div id="resumo" style="display:none;margin-top:16px;display:flex;gap:20px;flex-wrap:wrap;">
        <div><label style="margin-bottom:2px;">Valor</label><b id="r-valor"></b></div>
        <div><label style="margin-bottom:2px;">Entrada</label><b id="r-entrada"></b></div>
        <div><label style="margin-bottom:2px;">No cartao</label><b id="r-cartao"></b></div>
      </div>
    </div>
    <div class="card">
      <div id="tabela-parcelas" style="color:var(--muted);">Digite o valor para ver as parcelas.</div>
    </div>
  </div>

  <script>
    const BANDEIRAS = ${JSON.stringify(dados)};
    const PARCELAS = ${JSON.stringify(PARCELAS)};
    let bandeiraAtual = BANDEIRAS[0]?.id;

    function brl(n){
      return "R$ " + Math.max(0,n).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    function parseValor(s){
      const n = Number(String(s).replace(/\\./g,"").replace(",", "."));
      return isNaN(n) ? 0 : n;
    }

    const bandeirasBox = document.getElementById("bandeiras");
    BANDEIRAS.forEach(b => {
      const el = document.createElement("div");
      el.className = "btn secundario";
      el.style.cssText = "flex-direction:column;align-items:flex-start;cursor:pointer;padding:14px;";
      el.innerHTML = '<b>'+b.nome+'</b><span style="font-weight:400;color:var(--muted);font-size:12px;">'+b.sigla+'</span>';
      el.addEventListener("click", () => { bandeiraAtual = b.id; render(); });
      el.dataset.id = b.id;
      bandeirasBox.appendChild(el);
    });

    function render(){
      Array.from(bandeirasBox.children).forEach(el => {
        el.style.background = Number(el.dataset.id) === bandeiraAtual ? "var(--azul-esc)" : "#fff";
        el.style.color = Number(el.dataset.id) === bandeiraAtual ? "#fff" : "var(--ink)";
      });

      const valor = parseValor(document.getElementById("valor").value);
      const entrada = parseValor(document.getElementById("entrada").value);
      const noCartao = Math.max(0, valor - entrada);
      const resumo = document.getElementById("resumo");
      const tabela = document.getElementById("tabela-parcelas");

      if (!valor) {
        resumo.style.display = "none";
        tabela.innerHTML = '<p style="color:var(--muted);">Digite o valor para ver as parcelas.</p>';
        return;
      }

      resumo.style.display = "flex";
      document.getElementById("r-valor").textContent = brl(valor);
      document.getElementById("r-entrada").textContent = brl(entrada);
      document.getElementById("r-cartao").textContent = brl(noCartao);

      const b = BANDEIRAS.find(x => x.id === bandeiraAtual);
      if (!b) { tabela.innerHTML = ""; return; }

      let rows = PARCELAS.map((p, i) => {
        const taxa = b.taxas[i] || 0;
        const total = noCartao * (1 + taxa / 100);
        const n = p === "debito" ? 1 : Number(p.replace("x",""));
        const parcela = total / n;
        return '<tr><td><b>'+(p === "debito" ? "Debito" : p)+'</b></td><td>'+brl(parcela)+'</td><td><b>'+brl(total)+'</b></td><td>'+taxa.toFixed(2)+'%</td></tr>';
      }).join("");

      tabela.innerHTML =
        '<div class="tablewrap"><table><thead><tr><th>Parcelas</th><th>Valor da parcela</th><th>Total</th><th>Taxa</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    }

    document.getElementById("valor").addEventListener("input", render);
    document.getElementById("entrada").addEventListener("input", render);
    render();
  </script>
  `;

  res.send(layout({ title: "Calculadora de taxas", user: req.user, activePath: "/calculadora", body }));
});

module.exports = router;
