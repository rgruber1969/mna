import { redirect } from "next/navigation";

/** Os cadastros auxiliares agora ficam em Configurações (abas por assunto). */
export default function Page() {
  redirect("/configuracoes?aba=papeis");
}
