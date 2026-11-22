// Extrai o texto dos documentos já enviados para a busca por conteúdo
// (ADR-0022). Documentos novos já são lidos no envio. Pode rodar de novo.
// Uso: pnpm documentos:indexar
import { banco } from "@/server/db/cliente";
import { tenant } from "@/server/db/esquema";
import { indexarVersoesSemTexto } from "@/server/services/texto-de-documento";

for (const t of await banco().select({ id: tenant.id, slug: tenant.slug }).from(tenant)) {
  const r = await indexarVersoesSemTexto(t.id);
  if (r.lidas) console.log(`${t.slug}: ${r.lidas} versão(ões) lida(s), ${r.comTexto} com texto.`);
}
console.log("Pronto.");
process.exit(0);
