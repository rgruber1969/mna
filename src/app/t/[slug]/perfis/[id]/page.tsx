import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { excluirPerfilAcao, exigirDoPerfilAcao } from "@/app/acoes/perfis";
import { obterAcesso } from "@/server/services/acesso";
import { obterPerfil } from "@/server/services/perfis";
import { recursosDaCamada } from "@/server/services/permissoes/catalogo";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormMatrizDoPerfil, FormEditarPerfil } from "@/components/perfis/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Um perfil: matriz de permissões, nome, quem o usa e exclusão. */
async function Detalhe({ id }: { id: Promise<string> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const p = await obterPerfil(acesso, await id);
  if (!p) notFound();

  return (
    <>
      <Cabecalho area={acesso.tenant.nome} usuario={acesso.usuario.nome} administrador />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-2xl">
          <Link href="/perfis" className="text-primary text-sm">
            ← Perfis
          </Link>
          <Titulo sobre={p.camada === "tenant" ? "Perfil do tenant" : "Perfil de deal"}>{p.nome}</Titulo>
          <p className="text-muted mb-4 text-sm">
            Marque o que este perfil pode fazer em cada menu. O que não estiver marcado é negado.
            {acesso.tenant.modoPermissoes === "usuario" &&
              " No modo por usuário, quem tiver permissões personalizadas não muda com esta matriz."}
          </p>
          <FormMatrizDoPerfil id={p.id} recursos={recursosDaCamada(p.camada)} matriz={p.matriz} />
        </Cartao>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre="Editar">Nome e descrição</Titulo>
            <FormEditarPerfil id={p.id} nome={p.nome} descricao={p.descricao} />
          </Cartao>
          {p.camada === "tenant" && (
            <Cartao largura="max-w-sm">
              <Titulo sobre="Segurança">Verificação em duas etapas</Titulo>
              <p className="text-muted mb-4 text-sm">
                {p.exigeDoisFatores
                  ? "Exigida de todos com este perfil (soma-se às outras regras: vale sempre a mais segura)."
                  : "Não exigida por este perfil. Ainda pode ser exigida pelo tenant, individualmente ou por outro perfil."}
              </p>
              <BotaoDeAcao
                acao={exigirDoPerfilAcao}
                campos={{ id: p.id, valor: p.exigeDoisFatores ? "nao" : "sim" }}
                rotulo={p.exigeDoisFatores ? "Deixar de exigir por este perfil" : "Exigir 2FA deste perfil"}
              />
            </Cartao>
          )}
          {p.camada === "tenant" && (
            <Cartao largura="max-w-sm">
              <Titulo sobre="Em uso">Usuários com este perfil</Titulo>
              {p.usuarios.length === 0 ? (
                <p className="text-muted text-sm">Nenhum.</p>
              ) : (
                <ul className="text-sm">
                  {p.usuarios.map((u) => (
                    <li key={u.id}>
                      <Link href={`/usuarios/${u.id}`} className="text-primary">
                        {u.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          )}
          <Cartao largura="max-w-sm">
            <Titulo sobre="Excluir">Excluir perfil</Titulo>
            <p className="text-muted mb-4 text-sm">Só é possível quando ninguém usa o perfil.</p>
            <BotaoDeAcao
              acao={excluirPerfilAcao}
              campos={{ id: p.id }}
              rotulo="Excluir perfil"
              confirmar="Excluir este perfil?"
              perigo
            />
          </Cartao>
        </div>
      </main>
    </>
  );
}

export default function Page({ params }: PageProps<"/t/[slug]/perfis/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Detalhe id={params.then((p) => p.id)} />
    </Suspense>
  );
}
