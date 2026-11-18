import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { obterAcesso } from "@/server/services/acesso";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Cartao, Carregando, Moldura, Titulo } from "@/components/ui/basicos";

/** Tela inicial provisória do tenant; a tela principal (KPIs, deals) vem depois. */
async function Inicio() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  return (
    <EstruturaDoTenant acesso={acesso}>
      <Moldura>
        <Cartao largura="max-w-xl">
          <Titulo sobre={acesso.administrador ? "Administrador" : "Usuário"}>
            Olá, {acesso.usuario.nome}
          </Titulo>
          <p className="text-muted text-sm">
            Acesso confirmado. A tela principal com os deals vem nas próximas etapas.
          </p>
        </Cartao>
      </Moldura>
    </EstruturaDoTenant>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Inicio />
    </Suspense>
  );
}
