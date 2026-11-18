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
import { Cabecalho } from "@/components/acesso/cabecalho";
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
  const campos = { id: u.id };
  const situacao = u.administrador
    ? "exigida por ser administrador"
    : acesso.tenant.exigeDoisFatoresDeTodos
      ? "exigida de todos neste tenant"
      : u.exigeIndividual
        ? "exigida individualmente"
        : "não exigida";

  return (
    <>
      <Cabecalho area={acesso.tenant.nome} usuario={acesso.usuario.nome} administrador />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-xl">
          <Link href="/usuarios" className="text-primary text-sm">
            ← Usuários
          </Link>
          <Titulo sobre={u.administrador ? "Administrador" : "Usuário"}>{u.nome}</Titulo>
          <p className="text-muted -mt-4 mb-6 text-sm">{u.email}</p>

          <h2 className="text-text mb-2 text-sm font-semibold">Papel</h2>
          <div className="mb-6">
            <BotaoDeAcao
              acao={definirAdministradorAcao}
              campos={{ ...campos, valor: u.administrador ? "nao" : "sim" }}
              rotulo={u.administrador ? "Retirar administração" : "Tornar administrador"}
            />
          </div>

          <h2 className="text-text mb-2 text-sm font-semibold">Verificação em duas etapas</h2>
          <p className="text-muted mb-2 text-sm">Situação: {situacao}.</p>
          {!u.administrador && (
            <div className="mb-4">
              <BotaoDeAcao
                acao={exigirDoUsuarioAcao}
                campos={{ ...campos, valor: u.exigeIndividual ? "nao" : "sim" }}
                rotulo={u.exigeIndividual ? "Deixar de exigir individualmente" : "Exigir deste usuário"}
              />
            </div>
          )}

          <h3 className="text-text mb-2 text-sm font-medium">Fatores da conta</h3>
          <ul className="divide-border border-border mb-2 divide-y rounded-md border text-sm">
            {u.fatores.passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-text">
                  Passkey: {p.nome ?? "sem nome"}
                  {p.criadoEm && (
                    <span className="text-muted"> · desde {p.criadoEm.toLocaleDateString("pt-BR")}</span>
                  )}
                </span>
                <BotaoDeAcao
                  acao={removerPasskeyAcao}
                  campos={{ ...campos, passkey: p.id }}
                  rotulo="Remover"
                  confirmar="Remover esta passkey (aparelho perdido ou roubado)? As sessões da pessoa serão encerradas."
                  perigo
                />
              </li>
            ))}
            {u.fatores.autenticador && (
              <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-text">Aplicativo autenticador</span>
                <BotaoDeAcao
                  acao={removerAutenticadorAcao}
                  campos={campos}
                  rotulo="Remover"
                  confirmar="Remover o aplicativo autenticador? As sessões da pessoa serão encerradas."
                  perigo
                />
              </li>
            )}
            {!u.temDoisFatores && <li className="text-muted px-3 py-2">Nenhum fator configurado.</li>}
          </ul>
          <p className="text-muted mb-4 text-xs">
            Remover um aparelho só é possível se restar outro fator. Se a pessoa perdeu tudo, use a
            redefinição completa: ela configura de novo no próximo acesso.
          </p>
          {u.temDoisFatores && (
            <div className="mb-6">
              <BotaoDeAcao
                acao={redefinirDoisFatoresAcao}
                campos={campos}
                rotulo="Redefinir 2FA"
                confirmar="Apagar todos os fatores desta pessoa e encerrar as sessões dela?"
                perigo
              />
            </div>
          )}

          {!u.ehVoce && (
            <>
              <h2 className="text-text mb-2 text-sm font-semibold">Acesso</h2>
              <BotaoDeAcao
                acao={revogarAcessoAcao}
                campos={campos}
                rotulo="Revogar acesso"
                confirmar="Revogar o acesso desta pessoa a este tenant agora? As sessões dela aqui serão encerradas."
                perigo
              />
            </>
          )}
        </Cartao>

        <Cartao largura="max-w-xl">
          <Titulo sobre="Permissões">Perfis no tenant</Titulo>
          {u.administrador && (
            <p className="text-text mb-4 text-sm">
              Como administrador, esta pessoa tem acesso total, independentemente dos perfis.
            </p>
          )}
          <FormPerfisDoUsuario
            usuarioId={u.id}
            perfis={permissoes.disponiveis}
            marcados={permissoes.atribuidos.map((p) => p.id)}
          />
          {permissoes.modo === "usuario" && permissoes.atribuidos.length > 0 && (
            <>
              <h3 className="text-text mt-6 mb-2 text-sm font-semibold">
                Permissões próprias (modo por usuário)
              </h3>
              <ul className="mb-2 text-sm">
                {permissoes.atribuidos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-text">
                      {p.nome}
                      <span className="text-muted">
                        {" "}
                        · {p.personalizada ? "personalizadas" : "como o perfil"}
                      </span>
                    </span>
                    <Link
                      href={`/usuarios/${u.id}/permissoes/${p.id}`}
                      className="text-primary text-xs font-medium"
                    >
                      Ajustar
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="text-text mt-6 mb-2 text-sm font-semibold">Resultado (soma dos perfis)</h3>
          <GradeDaMatriz recursos={recursosDaCamada("tenant")} matriz={permissoes.efetiva} />
        </Cartao>
      </main>
    </>
  );
}

export default function Page({ params }: PageProps<"/t/[slug]/usuarios/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Detalhe id={params.then((p) => p.id)} />
    </Suspense>
  );
}
