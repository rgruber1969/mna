import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { excluirPapelAcao, excluirTipoDeVinculoAcao } from "@/app/acoes/cadastros";
import { obterAcesso } from "@/server/services/acesso";
import { listarPapeis, listarTiposDeVinculo, perfisDeDeal } from "@/server/services/cadastros";
import { pode } from "@/server/services/permissoes/verificador";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormPapel, FormTipoDeVinculo } from "@/components/cadastros/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Cadastros gerais: papéis de empresa (com perfil sugerido) e tipos de vínculo. */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "cadastros", "ver"))) notFound();
  const [papeis, tipos, perfis, podeCriar, podeEditar, podeExcluir] = await Promise.all([
    listarPapeis(acesso),
    listarTiposDeVinculo(acesso),
    perfisDeDeal(acesso),
    pode(acesso, "cadastros", "criar"),
    pode(acesso, "cadastros", "editar"),
    pode(acesso, "cadastros", "excluir"),
  ]);

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Titulo sobre="Cadastros auxiliares">Papéis de empresa</Titulo>
          <p className="text-muted mb-3 text-sm">
            O papel que uma empresa assume em cada deal. O perfil sugerido é proposto às pessoas da empresa
            quando ela entra no deal; o administrador confirma.
          </p>
          <ul className="divide-border divide-y">
            {papeis.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                {podeEditar ? (
                  <FormPapel papel={p} perfis={perfis} />
                ) : (
                  <span className="py-2 text-sm">
                    {p.nome}
                    <span className="text-muted block text-xs">
                      {p.perfilSugerido ?? "Sem perfil sugerido"}
                    </span>
                  </span>
                )}
                {podeExcluir && (
                  <BotaoDeAcao
                    acao={excluirPapelAcao}
                    campos={{ id: p.id }}
                    rotulo="Excluir"
                    confirmar={`Excluir o papel ${p.nome}?`}
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
          <Titulo sobre="Cadastros auxiliares">Tipos de vínculo</Titulo>
          <p className="text-muted mb-3 text-sm">
            Como uma pessoa se liga a uma empresa. &quot;Com percentual&quot; pede a participação (ex.:
            sócio).
          </p>
          <ul className="divide-border divide-y">
            {tipos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                {podeEditar ? <FormTipoDeVinculo tipo={t} /> : <span className="py-2 text-sm">{t.nome}</span>}
                <span className="flex items-center gap-2">
                  <span className="text-muted text-xs">
                    {t.emUso === 0 ? "sem uso" : `${t.emUso} vínculo${t.emUso > 1 ? "s" : ""}`}
                  </span>
                  {podeExcluir && t.emUso === 0 && (
                    <BotaoDeAcao
                      acao={excluirTipoDeVinculoAcao}
                      campos={{ id: t.id }}
                      rotulo="Excluir"
                      confirmar={`Excluir o tipo ${t.nome}?`}
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
