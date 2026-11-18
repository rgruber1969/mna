import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { produto } from "@/config/produto";
import { cancelarConviteDaEquipeAcao, removerDaEquipeAcao } from "@/app/acoes/usuarios";
import { obterAcesso } from "@/server/services/acesso";
import { listarEquipe } from "@/server/services/console";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { BotaoDeAcao, FormConvidarParaEquipe } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Equipe da RGRUBER: quem acessa o console (perfis-e-permissoes.md). */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "console") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const { usuarios, convites } = await listarEquipe(acesso);

  return (
    <>
      <Cabecalho area={`${produto.nome} · Console`} usuario={acesso.usuario} console />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Cartao largura="max-w-2xl">
            <Titulo sobre="Console">Equipe da RGRUBER</Titulo>
            <ul className="divide-border divide-y text-sm">
              {usuarios.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="text-text">{u.nome}</span>{" "}
                    <span className="text-muted">({u.email})</span>
                    {u.ehVoce && <span className="text-muted"> · você</span>}
                  </span>
                  {!u.ehVoce && (
                    <BotaoDeAcao
                      acao={removerDaEquipeAcao}
                      campos={{ id: u.id }}
                      rotulo="Remover acesso"
                      confirmar="Remover o acesso desta pessoa ao console agora? As sessões dela serão encerradas."
                      perigo
                    />
                  )}
                </li>
              ))}
            </ul>
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
                        ({c.email}) · vence em {c.expiraEm.toLocaleString("pt-BR")}
                      </span>
                    </span>
                    <BotaoDeAcao
                      acao={cancelarConviteDaEquipeAcao}
                      campos={{ id: c.id }}
                      rotulo="Cancelar"
                      confirmar="Cancelar este convite?"
                      perigo
                    />
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
        <Cartao largura="max-w-sm">
          <Titulo sobre="Novo">Convidar para a equipe</Titulo>
          <p className="text-muted mb-4 text-sm">
            A pessoa terá acesso total ao console, sempre com verificação em duas etapas.
          </p>
          <FormConvidarParaEquipe />
        </Cartao>
      </main>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel />
    </Suspense>
  );
}
