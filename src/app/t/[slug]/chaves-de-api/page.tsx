import { redirect } from "next/navigation";

/** Chaves de API ficam em Configurações (aba Chaves de API). */
export default function Page() {
  redirect("/configuracoes?aba=chaves");
}
