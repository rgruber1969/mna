import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { obterAcesso } from "@/server/services/acesso";
import { obterMatrizIndividual } from "@/server/services/perfis";
import { recursosDaCamada } from "@/server/services/permissoes/catalogo";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormCopiarMatriz, FormMatrizIndividual } from "@/components/perfis/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Permissões próprias de um usuário num perfil (modo por usuário). */
async function Detalhe({ ids }: { ids: Promise<{ id: string; perfilId: string }> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const { id, perfilId } = await ids;
  const m = await obterMatrizIndividual(acesso, id, perfilId);
  if (!m) notFound();

  return (
    <>
      <Cabecalho area={acesso.tenant.nome} usuario={acesso.usuario.nome} administrador />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-2xl">
          <Link href={`/usuarios/${m.usuario.id}`} className="text-primary text-sm">
            ← {m.usuario.nome}
          </Link>
          <Titulo sobre={`Perfil: ${m.perfil.nome}`}>Permissões de {m.usuario.nome}</Titulo>
          <p className="text-muted mb-4 text-sm">
            {m.personalizada
              ? "Personalizadas para esta pessoa neste perfil."
              : "Hoje seguem a matriz do perfil. Ao salvar, passam a ser próprias desta pessoa."}
            {acesso.tenant.modoPermissoes === "perfil" &&
              " O tenant está no modo por perfil: estas permissões ficam guardadas e só valem no modo por usuário."}
          </p>
          <FormMatrizIndividual
            usuarioId={m.usuario.id}
            perfilId={m.perfil.id}
            recursos={recursosDaCamada(m.perfil.camada)}
            matriz={m.matriz}
          />
        </Cartao>
        <Cartao largura="max-w-sm">
          <Titulo sobre="Atalho">Copiar permissões</Titulo>
          <p className="text-muted mb-4 text-sm">
            Copie de outro usuário com o mesmo perfil, ou volte à matriz do perfil.
          </p>
          <FormCopiarMatriz usuarioId={m.usuario.id} perfilId={m.perfil.id} outros={m.outros} />
        </Cartao>
      </main>
    </>
  );
}

export default function Page({ params }: PageProps<"/t/[slug]/usuarios/[id]/permissoes/[perfilId]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Detalhe ids={params} />
    </Suspense>
  );
}
