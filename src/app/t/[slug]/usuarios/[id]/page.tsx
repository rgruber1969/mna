import { getFormatter, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
  definirAdministradorAcao,
  exigirDoUsuarioAcao,
  redefinirDoisFatoresAcao,
  removerAutenticadorAcao,
  removerPasskeyAcao,
  revogarAcessoAcao,
} from "@/app/acoes/usuarios";
import { obterAcesso } from "@/server/services/acesso";
import { obterUsuario } from "@/server/services/usuarios";
import { permissoesDoUsuario } from "@/server/services/perfis";
import { recursosDaCamada } from "@/server/services/permissoes/catalogo";
import { FormPerfisDoUsuario, GradeDaMatriz } from "@/components/perfis/formularios";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Detalhe de um usuário do tenant: papel, exigência e recuperação do 2FA, revogação. */
async function Detalhe({ id }: { id: Promise<string> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const u = await obterUsuario(acesso, await id);
  if (!u) notFound();
  const permissoes = await permissoesDoUsuario(acesso, u.id);
  if (!permissoes) notFound();
  const t = await getTranslations("administracao.usuarios");
  const d = await getTranslations("administracao.usuarios.detalhe");
  const formatar = await getFormatter();
  const campos = { id: u.id };
  // Regras somadas (autenticacao-e-sessao.md): mostra todas as que valem.
  const motivos = [
    u.administrador && d("motivoAdministrador"),
    acesso.tenant.exigeDoisFatoresDeTodos && d("motivoTodos"),
    u.exigePorPerfil && d("motivoPerfil"),
    u.exigeIndividual && d("motivoIndividual"),
  ].filter(Boolean);
  const situacao = motivos.length > 0 ? d("exigida", { motivos: motivos.join(", ") }) : d("naoExigida");

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <Cartao largura="max-w-xl">
          <Link href="/usuarios" className="text-primary text-sm">
            {d("voltar")}
          </Link>
          <Titulo sobre={u.administrador ? t("administrador") : t("usuario")}>{u.nome}</Titulo>
          <p className="text-muted -mt-4 mb-6 text-sm">{u.email}</p>

          <h2 className="text-text mb-2 text-sm font-semibold">{d("papel")}</h2>
          <div className="mb-6">
            <BotaoDeAcao
              acao={definirAdministradorAcao}
              campos={{ ...campos, valor: u.administrador ? "nao" : "sim" }}
              rotulo={u.administrador ? d("retirarAdministracao") : d("tornarAdministrador")}
            />
          </div>

          <h2 className="text-text mb-2 text-sm font-semibold">{d("doisFatores")}</h2>
          <p className="text-muted mb-2 text-sm">{d("situacao", { situacao })}</p>
          {!u.administrador && (
            <div className="mb-4">
              <BotaoDeAcao
                acao={exigirDoUsuarioAcao}
                campos={{ ...campos, valor: u.exigeIndividual ? "nao" : "sim" }}
                rotulo={u.exigeIndividual ? d("deixarDeExigirIndividual") : d("exigirDesteUsuario")}
              />
            </div>
          )}

          <h3 className="text-text mb-2 text-sm font-medium">{d("fatores")}</h3>
          <ul className="divide-border border-border mb-2 divide-y rounded-md border text-sm">
            {u.fatores.passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-text">
                  {d("passkey", { nome: p.nome ?? d("semNome") })}
                  {p.criadoEm && (
                    <span className="text-muted">
                      {d("desde", { data: formatar.dateTime(p.criadoEm, { dateStyle: "short" }) })}
                    </span>
                  )}
                </span>
                <BotaoDeAcao
                  acao={removerPasskeyAcao}
                  campos={{ ...campos, passkey: p.id }}
                  rotulo={d("remover")}
                  confirmar={d("confirmarRemoverPasskey")}
                  perigo
                />
              </li>
            ))}
            {u.fatores.autenticador && (
              <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-text">{d("autenticador")}</span>
                <BotaoDeAcao
                  acao={removerAutenticadorAcao}
                  campos={campos}
                  rotulo={d("remover")}
                  confirmar={d("confirmarRemoverAutenticador")}
                  perigo
                />
              </li>
            )}
            {!u.temDoisFatores && <li className="text-muted px-3 py-2">{d("nenhumFator")}</li>}
          </ul>
          <p className="text-muted mb-4 text-xs">{d("notaRemocao")}</p>
          {u.temDoisFatores && (
            <div className="mb-6">
              <BotaoDeAcao
                acao={redefinirDoisFatoresAcao}
                campos={campos}
                rotulo={d("redefinir")}
                confirmar={d("confirmarRedefinir")}
                perigo
              />
            </div>
          )}

          {!u.ehVoce && (
            <>
              <h2 className="text-text mb-2 text-sm font-semibold">{d("acesso")}</h2>
              <BotaoDeAcao
                acao={revogarAcessoAcao}
                campos={campos}
                rotulo={d("revogar")}
                confirmar={d("confirmarRevogar")}
                perigo
              />
            </>
          )}
        </Cartao>

        <Cartao largura="max-w-xl">
          <Titulo sobre={d("perfilSobre")}>{d("perfilTitulo")}</Titulo>
          {u.administrador && <p className="text-text mb-4 text-sm">{d("adminAcessoTotal")}</p>}
          <FormPerfisDoUsuario
            usuarioId={u.id}
            perfis={permissoes.disponiveis}
            marcados={permissoes.atribuidos.map((p) => p.id)}
          />
          {permissoes.modo === "usuario" && permissoes.atribuidos.length > 0 && (
            <>
              <h3 className="text-text mt-6 mb-2 text-sm font-semibold">{d("permissoesProprias")}</h3>
              <ul className="mb-2 text-sm">
                {permissoes.atribuidos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-text">
                      {p.nome}
                      <span className="text-muted">
                        {" "}
                        · {p.personalizada ? d("personalizadas") : d("comoOPerfil")}
                      </span>
                    </span>
                    <Link
                      href={`/usuarios/${u.id}/permissoes/${p.id}`}
                      className="text-primary text-xs font-medium"
                    >
                      {d("ajustar")}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="text-text mt-6 mb-2 text-sm font-semibold">{d("resultantes")}</h3>
          <GradeDaMatriz recursos={recursosDaCamada("tenant")} matriz={permissoes.efetiva} />
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params }: PageProps<"/t/[slug]/usuarios/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Detalhe id={params.then((p) => p.id)} />
    </Suspense>
  );
}
