import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { definirModoAcao } from "@/app/acoes/perfis";
import { obterAcesso } from "@/server/services/acesso";
import { listarPerfis, type PerfilResumo } from "@/server/services/perfis";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormNovoPerfil } from "@/components/perfis/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Perfis do tenant e de deal, e o modo de permissões (só administradores). */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const { modo, perfis } = await listarPerfis(acesso);

  const lista = (camada: "tenant" | "deal") => (
    <ul className="divide-border divide-y text-sm">
      {perfis
        .filter((p) => p.camada === camada)
        .map((p: PerfilResumo) => (
          <li key={p.id} className="flex items-center justify-between gap-2 py-2">
            <Link href={`/perfis/${p.id}`} className="text-primary font-medium">
              {p.nome}
            </Link>
            {camada === "tenant" && (
              <span className="text-muted text-xs">
                {p.emUso === 0 ? "sem usuários" : `${p.emUso} usuário${p.emUso > 1 ? "s" : ""}`}
              </span>
            )}
          </li>
        ))}
    </ul>
  );

  return (
    <>
      <Cabecalho area={acesso.tenant.nome} usuario={acesso.usuario.nome} administrador />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Cartao largura="max-w-2xl">
            <Titulo sobre="Administração">Perfis do tenant</Titulo>
            <p className="text-muted mb-4 text-sm">
              Valem fora dos deals (painel, lista de deals, valuations avulsos, cadastros, auditoria). Cada
              usuário pode ter vários; as permissões se somam.
            </p>
            {lista("tenant")}
          </Cartao>
          <Cartao largura="max-w-2xl">
            <Titulo sobre="Administração">Perfis de deal</Titulo>
            <p className="text-muted mb-4 text-sm">
              Escolhidos para cada pessoa em cada deal em que ela participa, com o alcance (deal inteiro ou
              etapas). A participação nos deals chega junto com o cadastro de deals.
            </p>
            {lista("deal")}
          </Cartao>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Cartao largura="max-w-sm">
            <Titulo sobre="Configuração">Modo de permissões</Titulo>
            <p className="text-text mb-2 text-sm">
              Atual: <strong>{modo === "perfil" ? "por perfil" : "por usuário"}</strong>.
            </p>
            <p className="text-muted mb-4 text-sm">
              {modo === "perfil"
                ? "Todos com o mesmo perfil têm as mesmas permissões."
                : "Cada usuário pode ter permissões próprias em cada perfil (ex.: júnior com menos que sênior). Quem não foi personalizado segue a matriz do perfil."}
            </p>
            <BotaoDeAcao
              acao={definirModoAcao}
              campos={{ modo: modo === "perfil" ? "usuario" : "perfil" }}
              rotulo={modo === "perfil" ? "Passar para por usuário" : "Voltar para por perfil"}
              confirmar={
                modo === "perfil"
                  ? "Passar para o modo por usuário?"
                  : "Voltar para o modo por perfil? As personalizações ficam guardadas e voltam se o modo for trocado de novo."
              }
            />
          </Cartao>
          <Cartao largura="max-w-sm">
            <Titulo sobre="Novo">Criar perfil</Titulo>
            <FormNovoPerfil perfis={perfis} />
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
