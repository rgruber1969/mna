import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { getFormatter, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { cancelarConviteAcao, exigirDeTodosAcao, reenviarConviteAcao } from "@/app/acoes/usuarios";
import { obterAcesso } from "@/server/services/acesso";
import { listarUsuarios } from "@/server/services/usuarios";
import { lerPedido, paginarEmMemoria } from "@/config/paginacao";
import { Paginacao, TituloOrdenavel } from "@/components/ui/lista";
import { listarPerfis } from "@/server/services/perfis";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { BotaoDeAcao, FormConvidarUsuario } from "@/components/usuarios/formularios";
import { Avatar, Cartao, Etiqueta, Titulo, estiloTabela } from "@/components/ui/basicos";

const DATA_E_HORA = { dateStyle: "short", timeStyle: "medium" } as const;

/** Administração de usuários do tenant (só administradores). */
async function Painel({ consulta }: { consulta: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const parametros = await consulta;
  const { exigeDeTodos, usuarios: todos, convites } = await listarUsuarios(acesso);
  // Usuários do tenant são poucos por natureza: paginados no servidor, em memória.
  const pedido = lerPedido(parametros, ["nome", "email"] as const, "nome");
  const fator = pedido.direcao === "desc" ? -1 : 1;
  const ordenados = [...todos].sort(
    (a, b) =>
      fator * (a[pedido.ordem] ?? "").localeCompare(b[pedido.ordem] ?? "", "pt-BR", { sensitivity: "base" }),
  );
  const pagina = paginarEmMemoria(ordenados, pedido);
  const usuarios = pagina.itens;
  const perfisDoTenant = (await listarPerfis(acesso)).perfis.filter((p) => p.camada === "tenant");
  const t = await getTranslations("administracao.usuarios");
  const formatar = await getFormatter();

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <div className="flex w-full max-w-3xl flex-col gap-6">
          <Cartao largura="max-w-3xl">
            <Titulo sobre={t("sobre")}>{t("titulo")}</Titulo>
            <div className="-mx-2 overflow-x-auto">
              <table className={estiloTabela.tabela}>
                <thead className={estiloTabela.cabecalho}>
                  <tr>
                    <TituloOrdenavel
                      rotulo={t("colunaNome")}
                      campo="nome"
                      pedido={pedido}
                      caminho="/usuarios"
                      parametros={parametros}
                      className={estiloTabela.th}
                    />
                    <th className={estiloTabela.th}>{t("colunaPerfil")}</th>
                    <th className={estiloTabela.th}>{t("colunaDoisFatores")}</th>
                    <th className={`${estiloTabela.th} text-right`}>
                      <span className="sr-only">{t("colunaAcoes")}</span>
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
                          {u.administrador && <Etiqueta>{t("administrador")}</Etiqueta>}
                          {u.perfil ? (
                            <Etiqueta tom="neutra">{u.perfil}</Etiqueta>
                          ) : (
                            !u.administrador && <span className="text-muted text-xs">{t("semPerfil")}</span>
                          )}
                        </span>
                      </td>
                      <td className={estiloTabela.td}>
                        {u.temDoisFatores ? (
                          <Etiqueta tom="sucesso">{t("doisFatoresAtivo")}</Etiqueta>
                        ) : u.exigeDoisFatores ? (
                          <Etiqueta tom="perigo">{t("doisFatoresExigidoNaoConfigurado")}</Etiqueta>
                        ) : (
                          <Etiqueta tom="neutra">{t("doisFatoresNaoConfigurado")}</Etiqueta>
                        )}
                      </td>
                      <td className={`${estiloTabela.td} text-right`}>
                        <Link
                          href={`/usuarios/${u.id}`}
                          aria-label={t("abrir", { nome: u.nome })}
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
            <Paginacao pagina={pagina} caminho="/usuarios" parametros={parametros} />
          </Cartao>

          {convites.length > 0 && (
            <Cartao largura="max-w-2xl">
              <Titulo sobre={t("convitesSobre")}>{t("convitesTitulo")}</Titulo>
              <ul className="divide-border divide-y text-sm">
                {convites.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="text-text">{c.nome}</span>{" "}
                      <span className="text-muted">
                        {t(c.administrador ? "conviteAdminVence" : "conviteVence", {
                          email: c.email,
                          data: formatar.dateTime(c.expiraEm, DATA_E_HORA),
                        })}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      <BotaoDeAcao acao={reenviarConviteAcao} campos={{ id: c.id }} rotulo={t("reenviar")} />
                      <BotaoDeAcao
                        acao={cancelarConviteAcao}
                        campos={{ id: c.id }}
                        rotulo={t("cancelar")}
                        confirmar={t("confirmarCancelarConvite")}
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
          <Titulo sobre={t("convidarSobre")}>{t("convidarTitulo")}</Titulo>
          <FormConvidarUsuario perfis={perfisDoTenant} inicial={await consulta} />
        </Cartao>
        {/* Coluna própria: em telas largas fica à direita do convite; nas estreitas, abaixo. */}
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre={t("configuracaoSobre")}>{t("doisFatoresTitulo")}</Titulo>
            <p className="text-muted mb-4 text-sm">
              {exigeDeTodos ? t("exigidaDeTodos") : t("exigidaPadrao")}
            </p>
            <BotaoDeAcao
              acao={exigirDeTodosAcao}
              campos={{ valor: exigeDeTodos ? "nao" : "sim" }}
              rotulo={exigeDeTodos ? t("deixarDeExigirDeTodos") : t("exigirDeTodos")}
              confirmar={exigeDeTodos ? undefined : t("confirmarExigirDeTodos")}
            />
          </Cartao>
        </div>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/usuarios">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel consulta={searchParams as Promise<Record<string, string | string[] | undefined>>} />
    </Suspense>
  );
}
