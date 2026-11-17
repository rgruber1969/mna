// Convida um usuário para o console da plataforma (primeiro acesso).
// Uso: pnpm console:convidar-admin <e-mail> "<Nome>"
// O convite chega por e-mail (local: Mailpit em http://localhost:8025) e vale 3 dias.
// A senha é definida pela própria pessoa no navegador; o 2FA é obrigatório no console.
import { convidarUsuarioDaPlataforma } from "@/server/services/convites";

const [email, ...partesDoNome] = process.argv.slice(2);
const nome = partesDoNome.join(" ").trim();
if (!email || !nome) {
  console.error('Uso: pnpm console:convidar-admin <e-mail> "<Nome>"');
  process.exit(1);
}

const r = await convidarUsuarioDaPlataforma({ email, nome }, null);
if ("erro" in r) {
  console.error(r.erro);
  process.exit(1);
}
console.log("Convite enviado. Abra o e-mail e siga o link (válido por 3 dias).");
process.exit(0);
