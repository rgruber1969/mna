import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { cancelarConviteAcao, exigirDeTodosAcao, reenviarConviteAcao } from "@/app/acoes/usuarios";
import { obterAcesso } from "@/server/services/acesso";
import { listarUsuarios } from "@/server/services/usuarios";
import { listarPerfis } from "@/server/services/perfis";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { BotaoDeAcao, FormConvidarUsuario } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Administração de usuários do tenant (só administradores). */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const { exigeDeTodos, usuarios, convites } = await listarUsuarios(acesso);
  const perfisDoTenant = (await listarPerfis(acesso)).perfis.filter((p) => p.camada === "tenant");

  return (
    <>
      <Cabecalho area={acesso.tenant.nome} usuario={acesso.usuario} administrador />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Cartao largura="max-w-2xl">
            <Titulo sobre="Administração">Usuários</Titulo>
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 font-medium">Nome</th>
                  <th className="py-2 font-medium">Papel</th>
                  <th className="py-2 font-medium">2FA</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2">
                      <Link href={`/usuarios/${u.id}`} className="text-primary font-medium">
                        {u.nome}
                      </Link>
                      <span className="text-muted block text-xs">{u.email}</span>
                    </td>
                    <td className="text-text py-2">{u.administrador ? "Administrador" : "Usuário"}</td>
                    <td className="py-2">
                      {u.temDoisFatores ? (
                        <span className="text-success">Ativo</span>
                      ) : u.exigeDoisFatores ? (
                        <span className="text-danger">Exigido, não configurado</span>
                      ) : (
                        <span className="text-muted">Não configurado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <FormConvidarUsuario perfis={perfisDoTenant} />
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
