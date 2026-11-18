// Gera as chaves LOCAIS de criptografia de campos (ADR-0017 e adendo) e as
// acrescenta ao .env, sem nunca mostrá-las na tela:
//   CRIPTO_CHAVE_MESTRA  tranca as chaves de dados de cada tenant
//   CRIPTO_CHAVE_INDICE  calcula os índices cegos (busca exata sem dado legível)
// Não substitui chaves existentes: trocar a mestra deixaria ilegíveis os dados
// já criptografados. Elas vão no backup criptografado junto com o .env.
// Uso: pnpm cripto:gerar-chaves
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

if (!existsSync(".env")) {
  console.error("Não encontrei o .env. Copie o .env.example para .env antes.");
  process.exit(1);
}
const atual = readFileSync(".env", "utf8");
const novas = ["CRIPTO_CHAVE_MESTRA", "CRIPTO_CHAVE_INDICE"].filter(
  (nome) => !new RegExp(`^${nome}=.+`, "m").test(atual),
);
if (novas.length === 0) {
  console.log("As chaves já existem no .env; nada foi alterado.");
  process.exit(0);
}
const linhas = novas.map((nome) => `${nome}=${randomBytes(32).toString("base64url")}`);
appendFileSync(
  ".env",
  `${atual.endsWith("\n") ? "" : "\n"}\n# Criptografia de campos (gerado por pnpm cripto:gerar-chaves; não altere).\n${linhas.join("\n")}\n`,
);
console.log(`Chave(s) gerada(s) no .env: ${novas.join(", ")}.`);
