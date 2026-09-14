// lib/pdf.js — gera o PDF do termo de responsabilidade na hora, sem tocar
// disco. Os dados do cliente (PII) chegam so por parametro, sao usados uma
// vez pra desenhar o PDF e descartados — em nenhum momento sao gravados no
// banco (ver routes/termos.js e db.js).

const PDFDocument = require("pdfkit");

const CLAUSULA_PADRAO = (store, aparelho, cliente) => `
Eu, ${cliente.nome || "____________________"}, portador(a) do CPF ${cliente.cpf || "____________________"}, declaro para os devidos fins que o aparelho descrito acima é de minha propriedade, de origem lícita, e que não pesa sobre ele qualquer ônus, gravame, restrição, furto, roubo ou impedimento de qualquer natureza.

Declaro estar ciente de que, em caso de identificação de irregularidade na origem do aparelho, responderei civil e criminalmente pelos atos praticados, isentando ${store.nome_fantasia || "a loja"} de qualquer responsabilidade.

Autorizo ${store.nome_fantasia || "a loja"} a revender, utilizar peças ou dar a destinação comercial que julgar adequada ao aparelho recebido em troca/compra, mediante o pagamento no valor de R$ ${Number(aparelho.valor_pago || 0).toFixed(2)}, que declaro ter recebido integralmente.
`.trim();

function gerarTermoPdf({ res, store, aparelho, cliente, assinaturaBuffer }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  // Cabecalho da loja
  doc.fontSize(16).font("Helvetica-Bold").text(store.nome_fantasia || "Termo de responsabilidade");
  if (store.razao_social) doc.fontSize(9).font("Helvetica").fillColor("#555").text(store.razao_social);
  if (store.cnpj) doc.fontSize(9).text(`CNPJ: ${store.cnpj}`);
  const enderecoLinha = [store.endereco, store.cidade, store.uf, store.cep].filter(Boolean).join(", ");
  if (enderecoLinha) doc.fontSize(9).text(enderecoLinha);
  if (store.telefone || store.email) doc.fontSize(9).text([store.telefone, store.email].filter(Boolean).join(" · "));
  doc.fillColor("#000");
  doc.moveDown(1.2);

  doc.fontSize(14).font("Helvetica-Bold").text("Termo de responsabilidade — compra/troca de aparelho usado");
  doc.moveDown(0.8);

  doc.fontSize(10).font("Helvetica-Bold").text("Aparelho");
  doc.font("Helvetica").fontSize(10);
  doc.text(`Modelo: ${aparelho.modelo || "-"}`);
  doc.text(`IMEI: ${aparelho.imei || "-"}`);
  doc.text(`Valor pago: R$ ${Number(aparelho.valor_pago || 0).toFixed(2)}`);
  doc.text(`Consulta Anatel/base de bloqueio verificada antes da compra: ${aparelho.anatel_ok ? "Sim" : "Não"}`);
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").text("Quem está entregando o aparelho");
  doc.font("Helvetica");
  doc.text(`Nome completo: ${cliente.nome || "-"}`);
  doc.text(`CPF: ${cliente.cpf || "-"}`);
  doc.text(`Nascimento: ${cliente.nascimento || "-"}`);
  doc.text(`Telefone: ${cliente.telefone || "-"}`);
  const enderecoCliente = [cliente.endereco, cliente.cidade, cliente.uf, cliente.cep].filter(Boolean).join(", ");
  doc.text(`Endereço: ${enderecoCliente || "-"}`);
  doc.moveDown(1);

  doc.font("Helvetica-Bold").text("Declaração");
  doc.font("Helvetica").fontSize(10);
  const textoClausula = (store.termo_texto_custom || "").trim() || CLAUSULA_PADRAO(store, aparelho, cliente);
  doc.text(textoClausula, { align: "justify" });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").text("Assinatura");
  doc.moveDown(0.3);
  if (assinaturaBuffer) {
    try {
      doc.image(assinaturaBuffer, { fit: [260, 100] });
    } catch (e) {
      doc.font("Helvetica").fontSize(9).fillColor("#900").text("(nao foi possivel carregar a assinatura)");
      doc.fillColor("#000");
    }
  } else {
    doc.moveDown(3);
  }
  doc.moveTo(doc.x, doc.y + 4).lineTo(doc.x + 260, doc.y + 4).strokeColor("#999").stroke();
  doc.fontSize(9).fillColor("#555").text(cliente.nome || "", { width: 260 });
  doc.fillColor("#000");

  doc.fontSize(8).fillColor("#888").text(
    `Documento gerado em ${new Date().toLocaleString("pt-BR")}. Este PDF não fica armazenado no servidor — guarde uma cópia.`,
    50, doc.page.height - 60, { width: doc.page.width - 100, align: "center" }
  );

  doc.end();
}

module.exports = { gerarTermoPdf };
