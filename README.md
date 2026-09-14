# Avalia iPhone (interno)

Reconstrução da ferramenta de avaliação/compra de iPhone usado, feita por leitura de interface (sem acesso ao código-fonte original). Uso interno — sem cobrança, sem múltiplas contas, sem a comparação entre lojas do produto original (essa parte depende de uma rede de outras lojas que não temos).

## O que tem

- **Nova cotação** — escolhe o modelo, marca avarias, calcula o valor (base − avarias + bônus), copia texto pronto pro WhatsApp.
- **Preços** — tabela dos 55 modelos (seed com os valores extraídos do sistema original), editável, com adicionar/excluir modelo e restaurar padrão.
- **Taxas** — tabela de taxas de cartão por bandeira × parcela (débito a 21x), editável.
- **Calculadora** — quanto cobrar no cartão pra receber limpo, usando a tabela de taxas.
- **Termos** — gera o termo de responsabilidade em PDF na hora, com assinatura em canvas. **Não guarda nome/CPF/endereço/assinatura do cliente no banco** — só IMEI, modelo, valor e se a consulta Anatel foi feita, pra dar pra buscar depois. O PDF não fica salvo no servidor.
- **Loja** — dados que entram no cabeçalho do termo, upload de logo, texto customizado das cláusulas.
- **Equipe** — colaboradores com login próprio, acesso restrito só a Nova cotação e Calculadora.

## Rodando local

```bash
npm install
cp .env.example .env
# edite o .env: gere um SESSION_SECRET e defina OWNER_EMAIL/OWNER_PASSWORD
npm start
```

Abre em `http://localhost:3000`. No primeiro boot sem nenhum usuário cadastrado, o servidor cria a conta dona com `OWNER_EMAIL`/`OWNER_PASSWORD`/`OWNER_NAME` do `.env` — depois disso pode até remover essas variáveis, o usuário já existe no banco.

## Deploy no Railway

1. Suba esse projeto num repositório Git (GitHub) e conecte no Railway, ou use `railway up` direto da pasta.
2. O `nixpacks.toml` já pina Node 18.x (mesma lição aprendida no aclera.cars — `better-sqlite3` precisa compilar nativo e trava em versões mais novas do Node sem isso).
3. Configure as variáveis de ambiente do serviço no Railway:
   - `SESSION_SECRET` — gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME` — só precisa na primeira subida
   - `NODE_ENV=production`
4. **Adicione um Volume** no serviço (Railway → seu serviço → Settings → Volumes) montado em `/data`, e defina:
   - `DB_PATH=/data/app.db`
   - `UPLOAD_DIR=/data/uploads`

   Sem isso o banco (preços, taxas, termos, colaboradores) e o logo somem a cada novo deploy — o mesmo problema que o `aclera.cars` já teve com volume.
5. Deploy. Acesse a URL gerada, faça login com o `OWNER_EMAIL`/`OWNER_PASSWORD`.

## Estrutura

```
server.js          → monta as rotas e a autenticação
db.js               → schema SQLite + seed inicial (roda sozinho no boot)
data/seed-*.json    → tabela de preços e de taxas extraídas do sistema original
lib/session.js      → sessão via cookie assinado (sem tabela de sessão)
lib/password.js     → hash de senha com scrypt (nativo do Node, sem dependência extra)
lib/pdf.js          → geração do PDF do termo (pdfkit)
lib/layout.js       → casca HTML comum (nav + head)
middleware/auth.js  → requireLogin / requireOwner
routes/*.js         → uma rota por módulo (cotacao, precos, taxas, calculadora, loja, equipe, termos, auth)
public/style.css    → estilos compartilhados
```

## O que ficou diferente do original de propósito

- Sem cobrança/assinatura, sem limite de vagas de colaborador.
- Sem "Espelho de preços" (comparação entre lojas) — depende de dados de outras contas que não existem aqui.
- Sem o pixel do Facebook/Meta Ads que o original carregava.
- Login por cookie assinado em vez de sessão em banco — mais simples, menos dependência, mas todo mundo é deslogado se `SESSION_SECRET` mudar.

## Coisas pra revisar antes de usar valendo

- O texto padrão da cláusula do termo (`lib/pdf.js`) é um rascunho razoável, mas não é revisão jurídica — vale passar por um advogado antes de usar com cliente de verdade, ou usar o campo "Texto do termo" em `/loja` pra colar um texto já aprovado.
- O link do botão "Consultar na Anatel" aponta para `https://www.gov.br/anatel/pt-br/assuntos/celular-legal/consulte-sua-situacao` — confirme que ainda é a página certa antes de depender dele no dia a dia (sites de governo mudam de endereço de vez em quando).
- Faltam testes automatizados — o que existe foi validado manualmente (login, permissões, cálculo, PDF, upload, restaurar padrão).
