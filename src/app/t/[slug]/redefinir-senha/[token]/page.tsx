import { TelaRedefinirSenha } from "@/components/acesso/telas";

export default function Page({ params }: PageProps<"/t/[slug]/redefinir-senha/[token]">) {
  return <TelaRedefinirSenha token={params.then((p) => p.token)} />;
}
