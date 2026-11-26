import { TelaRedefinirSenha } from "@/components/acesso/telas";

export default function Page({ params }: PageProps<"/console/redefinir-senha/[token]">) {
  return <TelaRedefinirSenha token={params.then((p) => p.token)} />;
}
