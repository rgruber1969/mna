import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { obterAcesso } from "@/server/services/acesso";
import { obterIdentidade } from "@/server/services/identidade-visual";
import { enderecoDaImagem } from "@/config/marca";
import { Cabecalho } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormIdentidade, FormImagemDaMarca } from "@/components/identidade/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/** Identidade visual do tenant (white label, ADR-0010): só administradores. */
async function Painel() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!acesso.administrador) notFound();
  const id = await obterIdentidade(acesso);
  const url = (chave: string | null) => enderecoDaImagem(acesso.tenant.id, chave);

  return (
    <>
      <Cabecalho
        area={acesso.tenant.nomeExibido}
        logo={acesso.tenant.logo}
        usuario={acesso.usuario}
        tenant={acesso}
        administrador
      />
      <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
        <Cartao largura="max-w-lg">
          <Titulo sobre="Administração">Identidade visual</Titulo>
          <p className="text-muted mb-4 text-sm">
            Nome, cores e fonte das telas e dos e-mails do tenant. As cores precisam ser legíveis: combinações
            com pouco contraste são recusadas.
          </p>
          <FormIdentidade inicial={id} />
        </Cartao>
        <Cartao largura="max-w-lg">
          <Titulo sobre="Administração">Logos e ícone</Titulo>
          <p className="text-muted mb-4 text-sm">
            JPG, PNG ou WebP, até 2 MB. Prefira fundo transparente. O sistema reduz e regrava a imagem.
          </p>
          <FormImagemDaMarca
            tipo="logoClaro"
            titulo="Logo para fundo claro"
            explicacao="Topo das telas e e-mails."
            atual={url(id.logoClaro)}
            nome={acesso.tenant.nomeExibido}
          />
          <FormImagemDaMarca
            tipo="logoEscuro"
            titulo="Logo para fundo escuro"
            explicacao="Tela de entrada (fundo escuro). Sem ela, a de fundo claro aparece sobre uma placa clara."
            atual={url(id.logoEscuro)}
            nome={acesso.tenant.nomeExibido}
            fundoEscuro
          />
          <FormImagemDaMarca
            tipo="icone"
            titulo="Ícone da aba"
            explicacao="Símbolo quadrado mostrado na aba do navegador."
            atual={url(id.icone)}
            nome={acesso.tenant.nomeExibido}
          />
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
