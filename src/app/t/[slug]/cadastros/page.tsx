import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { excluirPapelAcao, excluirTipoDeVinculoAcao } from "@/app/acoes/cadastros";
import { obterAcesso } from "@/server/services/acesso";
import { listarPapeis, listarTiposDeVinculo, perfisDeDeal } from "@/server/services/cadastros";
import { listarTiposDeOperacao } from "@/server/services/negocios";
import { excluirTipoDeOperacaoAcao } from "@/app/acoes/negocios";
import { FormNovoTipoDeOperacao } from "@/components/negocios/formularios";
import { pode } from "@/server/services/permissoes/verificador";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormPapel, FormTipoDeVinculo } from "@/components/cadastros/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Cadastros gerais: papéis de empresa (com perfil sugerido e lado), tipos de vínculo e tipos de operação. */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "cadastros", "ver"))) notFound();
  const tr = await getTranslations("cadastros.auxiliares");
  const tc = await getTranslations("comum");
  const tOp = await getTranslations("negocios.tipos");
  const [papeis, tipos, perfis, podeCriar, podeEditar, podeExcluir, operacoes] = await Promise.all([
    listarPapeis(acesso),
    listarTiposDeVinculo(acesso),
    perfisDeDeal(acesso),
    pode(acesso, "cadastros", "criar"),
    pode(acesso, "cadastros", "editar"),
    pode(acesso, "cadastros", "excluir"),
    listarTiposDeOperacao(acesso),
  ]);

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Titulo sobre={tr("sobre")}>{tr("papeisTitulo")}</Titulo>
          <p className="text-muted mb-3 text-sm">{tr("papeisExplicacao")}</p>
          <ul className="divide-border divide-y">
            {papeis.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                {podeEditar ? (
                  <FormPapel papel={p} perfis={perfis} />
                ) : (
                  <span className="py-2 text-sm">
                    {p.nome}
                    <span className="text-muted block text-xs">
                      {p.perfilSugerido ?? tr("semPerfilSugerido")}
                    </span>
                  </span>
                )}
                {podeExcluir && (
                  <BotaoDeAcao
                    acao={excluirPapelAcao}
                    campos={{ id: p.id }}
                    rotulo={tc("excluir")}
                    confirmar={tr("confirmarExcluirPapel", { nome: p.nome })}
                    perigo
                  />
                )}
              </li>
            ))}
          </ul>
          {podeCriar && (
            <div className="border-border mt-2 border-t">
              <FormPapel perfis={perfis} />
            </div>
          )}
        </Cartao>
        <Cartao largura="max-w-lg">
          <Titulo sobre={tr("sobre")}>{tr("tiposTitulo")}</Titulo>
          <p className="text-muted mb-3 text-sm">{tr("tiposExplicacao")}</p>
          <ul className="divide-border divide-y">
            {tipos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                {podeEditar ? <FormTipoDeVinculo tipo={t} /> : <span className="py-2 text-sm">{t.nome}</span>}
                <span className="flex items-center gap-2">
                  <span className="text-muted text-xs">{tr("usoDoTipo", { n: t.emUso })}</span>
                  {podeExcluir && t.emUso === 0 && (
                    <BotaoDeAcao
                      acao={excluirTipoDeVinculoAcao}
                      campos={{ id: t.id }}
                      rotulo={tc("excluir")}
                      confirmar={tr("confirmarExcluirTipo", { nome: t.nome })}
                      perigo
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
          {podeCriar && (
            <div className="border-border mt-2 border-t">
              <FormTipoDeVinculo />
            </div>
          )}
        </Cartao>
        <Cartao largura="max-w-lg">
          <Titulo sobre={tr("sobre")}>{tOp("titulo")}</Titulo>
          <p className="text-muted mb-3 text-sm">{tOp("explicacao")}</p>
          <ul className="divide-border divide-y text-sm">
            {operacoes.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {o.nome}
                  {o.comPercentual && (
                    <span className="text-muted block text-xs">{tOp("pedePercentual")}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted text-xs">{tOp("uso", { n: o.emUso })}</span>
                  {podeExcluir && o.emUso === 0 && (
                    <BotaoDeAcao
                      acao={excluirTipoDeOperacaoAcao}
                      campos={{ id: o.id }}
                      rotulo={tc("excluir")}
                      confirmar={tOp("confirmarExcluir", { nome: o.nome })}
                      perigo
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
          {podeCriar && <FormNovoTipoDeOperacao />}
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel />
    </Suspense>
  );
}
