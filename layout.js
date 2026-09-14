// lib/layout.js — casca HTML comum (nav + head) reaproveitada por todas as
// paginas. Nada de template engine: strings simples, igual ao padrao
// "single HTML" usado no resto do ecossistema.

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const NAV_ITEMS = [
  { href: "/", label: "Nova cotacao", ownerOnly: false },
  { href: "/calculadora", label: "Calculadora", ownerOnly: false },
  { href: "/termos", label: "Termos", ownerOnly: true },
  { href: "/config", label: "Precos", ownerOnly: true },
  { href: "/taxas", label: "Taxas", ownerOnly: true },
  { href: "/loja", label: "Loja", ownerOnly: true },
  { href: "/team", label: "Equipe", ownerOnly: true },
];

function layout({ title, user, activePath, body, extraHead = "" }) {
  const nav = user
    ? NAV_ITEMS.filter((i) => !i.ownerOnly || user.role === "owner")
        .map(
          (i) =>
            `<a href="${i.href}" class="${i.href === activePath ? "active" : ""}">${esc(i.label)}</a>`
        )
        .join("")
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Avalia iPhone</title>
<link rel="stylesheet" href="/style.css">
${extraHead}
</head>
<body>
${user ? `
<header class="topbar">
  <div class="brand">📱 Avalia <b>iPhone</b></div>
  <nav class="mainnav">
    <span class="userlabel">Ola, ${esc(user.name)} <span class="pill ${user.role}">${user.role === "owner" ? "dono" : "equipe"}</span></span>
    ${nav}
    <a class="sair" href="/logout">Sair</a>
  </nav>
</header>` : ""}
<main>
${body}
</main>
<footer class="rodape">Avalia iPhone — sistema interno, reconstruido a partir de leitura de interface.</footer>
</body>
</html>`;
}

module.exports = { layout, esc };
