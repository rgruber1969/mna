// Completa os cadastros padrão dos tenants existentes: perfis (se o tenant não
// tiver nenhum), papéis de empresa, tipos de vínculo, tipos de operação e a
// empresa do contratante. Tenants novos já recebem tudo. Pode rodar de novo
// sem duplicar.
// Uso: pnpm tenants:completar-padrao            (todos os tenants)
//      pnpm tenants:completar-padrao <endereço> (só um tenant, ex.: bt)
import { eq } from "drizzle-orm";
import { banco } from "@/server/db/cliente";
import { tenant } from "@/server/db/esquema";
import {
  completarCadastrosPadrao,
  completarCadastrosPadraoParaTodos,
} from "@/server/services/cadastros-padrao";

const slug = process.argv[2];
if (slug) {
  const [t] = await banco().select({ id: tenant.id }).from(tenant).where(eq(tenant.slug, slug));
  if (!t) {
    console.error(`Tenant "${slug}" não encontrado.`);
    process.exit(1);
  }
  await completarCadastrosPadrao(t.id);
  console.log(`Cadastros padrão conferidos no tenant ${slug}.`);
} else {
  const n = await completarCadastrosPadraoParaTodos();
  console.log(`Cadastros padrão conferidos em ${n} tenant(s).`);
}
process.exit(0);
