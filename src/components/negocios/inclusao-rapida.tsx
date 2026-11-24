"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormEmpresa, FormPessoa } from "@/components/cadastros/formularios";
import { Janela } from "@/components/ui/janela";

/**
 * Inclusão rápida de empresa ou pessoa sem sair do negócio: o cadastro abre
 * numa janela; ao salvar, a janela fecha e as listas do negócio atualizam, já
 * com a nova empresa ou pessoa para vincular.
 */
export function InclusaoRapida({
  qual,
  grupos,
}: {
  qual: "empresa" | "pessoa";
  grupos: { id: string; nome: string }[];
}) {
  const t = useTranslations("negocios.inclusaoRapida");
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="text-primary hover:bg-primary-soft rounded-md px-2 py-1 text-xs font-semibold"
      >
        + {t(qual === "empresa" ? "novaEmpresa" : "novaPessoa")}
      </button>
      {aberta && (
        <Janela
          titulo={t(qual === "empresa" ? "tituloEmpresa" : "tituloPessoa")}
          rotuloFechar={t("fechar")}
          fechar={() => setAberta(false)}
          largura={qual === "empresa" ? "max-w-4xl" : "max-w-xl"}
        >
          <p className="text-muted mb-3 text-xs">{t("explicacao")}</p>
          {qual === "empresa" ? (
            <FormEmpresa
              inicial={{ pais: "Brasil" }}
              grupos={grupos}
              podeSalvar
              aoSalvarNaTela={() => setAberta(false)}
            />
          ) : (
            <FormPessoa
              inicial={{ pais: "Brasil" }}
              mascarados={{}}
              podeSalvar
              curto
              aoSalvarNaTela={() => setAberta(false)}
            />
          )}
        </Janela>
      )}
    </>
  );
}
