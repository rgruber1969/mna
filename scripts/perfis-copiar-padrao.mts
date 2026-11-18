// Copia os perfis padrão para os tenants que ainda não têm nenhum perfil
// (tenants criados antes dos perfis padrão). Tenants novos já recebem a cópia.
// Uso: pnpm perfis:copiar-padrao
import { copiarPerfisPadraoParaTodos } from "@/server/services/perfis";

const n = await copiarPerfisPadraoParaTodos();
console.log(`Perfis padrão copiados para ${n} tenant(s).`);
process.exit(0);
