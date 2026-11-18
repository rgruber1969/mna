// Completa os cadastros padrão dos tenants existentes: perfis (se o tenant não
// tiver nenhum), papéis de empresa, tipos de vínculo e a empresa do
// contratante. Tenants novos já recebem tudo. Pode rodar de novo sem duplicar.
// Uso: pnpm tenants:completar-padrao
import { completarCadastrosPadraoParaTodos } from "@/server/services/cadastros-padrao";

const n = await completarCadastrosPadraoParaTodos();
console.log(`Cadastros padrão conferidos em ${n} tenant(s).`);
process.exit(0);
