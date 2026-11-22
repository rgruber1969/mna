import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { minhasMensagens, obterHorasDoResumo, obterMeuResumo } from "@/server/services/mensagens";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { MensagensRecentes, OpcaoDoResumo } from "@/components/mensagens/recentes";
import { ResumoDeMensagens } from "@/components/mensagens/resumo";
import { resumoDasMensagens } from "@/server/services/resumos";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Conversas com mensagens recentes de todos os negócios que a pessoa vê (item 16). */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const [{ conversas }, resumo, horas, t, resumoLocal] = await Promise.all([
    minhasMensagens(acesso, 100),
    obterMeuResumo(acesso),
    obterHorasDoResumo(acesso),
    getTranslations("mensagens"),
    resumoDasMensagens(acesso),
  ]);
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-3xl">
          <Titulo sobre={t("paginaAjuda")}>{t("titulo")}</Titulo>
          <ResumoDeMensagens resumo={resumoLocal} />
          <OpcaoDoResumo ligado={resumo} horas={horas} />
          <MensagensRecentes conversas={conversas} />
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
