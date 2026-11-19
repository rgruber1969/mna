import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { cancelarConviteAcao, exigirDeTodosAcao, reenviarConviteAcao } from "@/app/acoes/usuarios";
import { obterAcesso } from "@/server/services/acesso";
import { listarUsuarios } from "@/server/services/usuarios";
import { listarPerfis } from "@/server/services/perfis";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { BotaoDeAcao, FormConvidarUsuario } from "@/components/usuarios/formularios";
import { Avatar, Cartao, Carregando, Etiqueta, Titulo, estiloTabela } from "@/components/ui/basicos";

/** Administração de usuários do tenant (só administradores). */
async function Painel({ consulta }: { consulta: Promise<{ nome?: string; email?: string }> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const { exigeDeTodos, usuarios, convites } = await listarUsuarios(acesso);
  const perfisDoTenant = (await listarPerfis(acesso)).perfis.filter((p) => p.camada === "tenant");

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <div className="flex w-full max-w-3xl flex-col gap-6">
          <Cartao largura="max-w-3xl">
            <Titulo sobre="Administração">Usuários</Titulo>
            <div className="-mx-2 overflow-x-auto">
              <table className={estiloTabela.tabela}>
                <thead className={estiloTabela.cabecalho}>
                  <tr>
                    <th className={estiloTabela.th}>Nome</th>
                    <th className={estiloTabela.th}>Perfil</th>
                    <th className={estiloTabela.th}>2FA</th>
                    <th className={`${estiloTabela.th} text-right`}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className={estiloTabela.linha}>
                      <td className={estiloTabela.td}>
                        <span className="flex items-center gap-3">
                          <Avatar nome={u.nome} foto={u.foto} tamanho={40} />
                          <span className="min-w-0">
                            <Link href={`/usuarios/${u.id}`} className="text-text block font-semibold">
                              {u.nome}
                            </Link>
                            <span className="text-muted block truncate text-xs">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className={estiloTabela.td}>
                        <span className="flex flex-wrap gap-1">
                          {u.administrador && <Etiqueta>Administrador</Etiqueta>}
                          {u.perfil ? (
                            <Etiqueta tom="neutra">{u.perfil}</Etiqueta>
                          ) : (
                            !u.administrador && <span className="text-muted text-xs">Sem perfil</span>
                          )}
                        </span>
                      </td>
                      <td className={estiloTabela.td}>
                        {u.temDoisFatores ? (
                          <Etiqueta tom="sucesso">Ativo</Etiqueta>
                        ) : u.exigeDoisFatores ? (
                          <Etiqueta tom="perigo">Exigido, não configurado</Etiqueta>
                        ) : (
                          <Etiqueta tom="neutra">Não configurado</Etiqueta>
                        )}
                      </td>
                      <td className={`${estiloTabela.td} text-right`}>
                        <Link
                          href={`/usuarios/${u.id}`}
                          aria-label={`Abrir ${u.nome}`}
                          className="bg-surface text-text hover:text-primary inline-flex h-8 w-8 items-center justify-center rounded-md font-bold"
                        >
                          ···
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>

          {convites.length > 0 && (
            <Cartao largura="max-w-2xl">
              <Titulo sobre="Aguardando aceite">Convites pendentes</Titulo>
              <ul className="divide-border divide-y text-sm">
                {convites.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="text-text">{c.nome}</span>{" "}
                      <span className="text-muted">
                        ({c.email}){c.administrador ? " · administrador" : ""} · vence em{" "}
                        {c.expiraEm.toLocaleString("pt-BR")}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      <BotaoDeAcao acao={reenviarConviteAcao} campos={{ id: c.id }} rotulo="Reenviar" />
                      <BotaoDeAcao
                        acao={cancelarConviteAcao}
                        campos={{ id: c.id }}
                        rotulo="Cancelar"
                        confirmar="Cancelar este convite?"
                        perigo
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>

        <Cartao largura="max-w-sm">
          <Titulo sobre="Novo">Convidar usuário</Titulo>
          <FormConvidarUsuario perfis={perfisDoTenant} inicial={await consulta} />
        </Cartao>
        {/* Coluna própria: em telas largas fica à direita do convite; nas estreitas, abaixo. */}
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre="Configuração">Verificação em duas etapas</Titulo>
            <p className="text-muted mb-4 text-sm">
              {exigeDeTodos
                ? "Exigida de todos os usuários deste tenant."
                : "Exigida dos administradores e dos usuários marcados individualmente."}
            </p>
            <BotaoDeAcao
              acao={exigirDeTodosAcao}
              campos={{ valor: exigeDeTodos ? "nao" : "sim" }}
              rotulo={exigeDeTodos ? "Deixar de exigir de todos" : "Exigir de todos"}
              confirmar={
                exigeDeTodos
                  ? undefined
                  : "Quem ainda não tem 2FA terá de configurar no próximo acesso. Continuar?"
              }
            />
          </Cartao>
        </div>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/usuarios">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel consulta={searchParams as Promise<{ nome?: string; email?: string }>} />
    </Suspense>
  );
}
