import { redirect } from "next/navigation";

/** Identidade visual fica em Configurações (aba Identidade visual). */
export default function Page() {
  redirect("/configuracoes?aba=identidade");
}
