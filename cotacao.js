// routes/cotacao.js — "Nova cotacao": a tela principal, usada por qualquer
// usuario logado (dono ou colaborador). Mesma logica de calculo do sistema
// original: total = preco base do modelo - avarias marcadas + bonus.

const express = require("express");
const db = require("../db");
const { layout, esc } = require("../lib/layout");

const router = express.Router();

const DAMAGE = [
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

function loadModelsForClient() {
  const rows = db.prepare("SELECT * FROM models ORDER BY sort_order, id").all();
  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    base: m.base,
    values: {
      leves: m.leves, moderadas: m.moderadas, bateria: m.bateria, tela: m.tela,
      traseira: m.traseira, faceid: m.faceid, doc_carga: m.doc_carga,
      cam_traseira: m.cam_traseira, notif_camera: m.notif_camera,
      notif_bateria: m.notif_bateria, notif_tela: m.notif_tela,
    },
  }));
}

router.get("/", (req, res) => {
  const store = db.prepare("SELECT regras_texto, bonus_valor FROM store WHERE id = 1").get();
  const models = loadModelsForClient();
  const regrasLinhas = (store.regras_texto || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const body = `
  <h1>Nova cotacao</h1>
  <p class="subtitle">Escolha o modelo, marque as avarias do aparelho e veja quanto pagar na troca.</p>

  <div class="grid2">
    <div class="card">
      <div class="field">
        <label>Modelo do aparelho</label>
        <select id="modelo">
          <option value="">Selecione o modelo...</option>
          ${models.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}
        </select>
      </div>
      <p id="vazio" style="color:var(--muted);">Selecione um modelo para comecar.</p>
      <div id="avarias-wrap" style="display:none;">
        <div id="avarias"></div>
        ${Number(store.bonus_valor) > 0 ? `
        <label class="avaria" style="border-top:2px solid var(--border);margin-top:6px;padding-top:14px;">
          <input type="checkbox" id="bonus">
          <span class="av-nome">Bonus seminovo (troca por outro aparelho do estoque)</span>
          <span class="av-valor" style="color:var(--ok);">+ ${brl(store.bonus_valor)}</span>
        </label>` : ""}
      </div>
    </div>

    <div>
      <div class="card">
        <label style="margin-bottom:2px;">Valor a pagar</label>
        <div class="total-box" id="total">R$ 0,00</div>
        <div id="breakdown" style="margin-top:14px;font-size:14px;"></div>
        <button id="btn-copiar" style="display:none;margin-top:16px;">📋 Copiar para mandar ao cliente</button>
      </div>
      ${regrasLinhas.length ? `
      <div class="card">
        <label>Regras</label>
        <ul style="margin:8px 0 0;padding-left:18px;color:var(--ink);font-size:14px;">
          ${regrasLinhas.map((l) => `<li style="margin-bottom:6px;">${esc(l)}</li>`).join("")}
        </ul>
      </div>` : ""}
    </div>
  </div>

  <script>
    const MODELS = ${JSON.stringify(models)};
    const DAMAGE = ${JSON.stringify(DAMAGE)};
    const BONUS = ${Number(store.bonus_valor) || 0};
    const byId = {};
    MODELS.forEach(m => byId[m.id] = m);

    function brl(n){
      n = Math.max(0, n);
      return "R$ " + n.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
    }

    const selModelo = document.getElementById("modelo");
    const wrap = document.getElementById("avarias-wrap");
    const avariasBox = document.getElementById("avarias");
    const vazio = document.getElementById("vazio");
    const bonusEl = document.getElementById("bonus");

    selModelo.addEventListener("change", renderAvarias);
    if (bonusEl) bonusEl.addEventListener("change", calcular);

    function addAvaria(key, label, val){
      const line = document.createElement("label");
      line.className = "avaria";
      line.innerHTML =
        '<input type="checkbox" value="'+val+'" data-key="'+key+'">' +
        '<span class="av-nome">'+label+'</span>' +
        '<span class="av-valor">- '+brl(val)+'</span>';
      line.querySelector("input").addEventListener("change", calcular);
      avariasBox.appendChild(line);
    }

    function renderAvarias(){
      const m = byId[selModelo.value];
      avariasBox.innerHTML = "";
      if (bonusEl) bonusEl.checked = false;
      if (!m) { wrap.style.display = "none"; vazio.style.display = "block"; calcular(); return; }
      vazio.style.display = "none";
      wrap.style.display = "block";

      const valor = k => Number((m.values || {})[k] || 0);
      const comValor = DAMAGE.filter(([k]) => valor(k) > 0);
      const lista = comValor.length ? comValor : DAMAGE;
      lista.forEach(([key, label]) => addAvaria(key, label, valor(key)));
      calcular();
    }

    let textoCopia = "";

    function calcular(){
      const m = byId[selModelo.value];
      const totalEl = document.getElementById("total");
      const bd = document.getElementById("breakdown");
      if (!m) { totalEl.textContent = brl(0); bd.innerHTML = ""; return; }

      const base = Number(m.base || 0);
      let linhas = ['<div style="display:flex;justify-content:space-between"><span>Valor na troca</span><b>'+brl(base)+'</b></div>'];
      let total = base;
      const textoLinhas = [m.name, "Valor na troca: " + brl(base)];

      avariasBox.querySelectorAll("input[type=checkbox]:checked").forEach(chk => {
        const v = Number(chk.value);
        total -= v;
        const nome = chk.parentElement.querySelector(".av-nome").textContent;
        linhas.push('<div style="display:flex;justify-content:space-between;color:var(--erro)"><span>'+nome+'</span><span>- '+brl(v)+'</span></div>');
        textoLinhas.push(nome + ": - " + brl(v));
      });

      if (bonusEl && bonusEl.checked) {
        total += BONUS;
        linhas.push('<div style="display:flex;justify-content:space-between;color:var(--ok)"><span>Bonus seminovo</span><span>+ '+brl(BONUS)+'</span></div>');
        textoLinhas.push("Bonus seminovo: + " + brl(BONUS));
      }

      totalEl.textContent = brl(total);
      bd.innerHTML = linhas.join("") +
        '<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between"><b>Total</b><b>'+brl(total)+'</b></div>';

      textoLinhas.push("", "*Valor a pagar: " + brl(total) + "*");
      textoCopia = textoLinhas.join("\\n");
      document.getElementById("btn-copiar").style.display = "inline-flex";

      agendarLog(m, total);
    }

    document.getElementById("btn-copiar").addEventListener("click", function(){
      const btn = this;
      function avisar(){
        btn.textContent = "✓ Copiado! Agora e so colar";
        setTimeout(() => { btn.textContent = "📋 Copiar para mandar ao cliente"; }, 3000);
      }
      function fallback(){
        const campo = document.createElement("textarea");
        campo.value = textoCopia;
        campo.style.position = "fixed";
        campo.style.opacity = "0";
        document.body.appendChild(campo);
        campo.select();
        try { document.execCommand("copy"); avisar(); } catch (e) {}
        document.body.removeChild(campo);
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textoCopia).then(avisar).catch(fallback);
      } else {
        fallback();
      }
    });

    let logTimer = null;
    const jaLogado = new Set();
    function agendarLog(m, total){
      const selecionadas = Array.from(avariasBox.querySelectorAll("input[type=checkbox]:checked")).map(c => c.dataset.key);
      const sig = m.id + "|" + selecionadas.slice().sort().join(",") + "|" + ((bonusEl && bonusEl.checked) ? "1" : "0");
      if (jaLogado.has(sig)) return;
      clearTimeout(logTimer);
      logTimer = setTimeout(() => {
        jaLogado.add(sig);
        fetch("/api/quote-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_id: m.id, avarias: selecionadas, bonus: !!(bonusEl && bonusEl.checked) }),
        }).catch(() => {});
      }, 2500);
    }

    calcular();
  </script>
  `;

  res.send(layout({ title: "Nova cotacao", user: req.user, activePath: "/", body }));
});

router.post("/api/quote-log", express.json(), (req, res) => {
  const { model_id, avarias, bonus } = req.body || {};
  try {
    db.prepare(
      "INSERT INTO quote_log (model_id, avarias, bonus, user_id) VALUES (?, ?, ?, ?)"
    ).run(Number(model_id) || null, JSON.stringify(avarias || []), bonus ? 1 : 0, req.user?.id || null);
  } catch (e) {
    // log e best-effort, nunca deve quebrar o fluxo do usuario
  }
  res.status(204).end();
});

function brl(n) {
  n = Math.max(0, Number(n) || 0);
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = router;
