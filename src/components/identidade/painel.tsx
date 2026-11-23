import { getTranslations } from "next-intl/server";
import { enderecoDaImagem } from "@/config/marca";
import type { AcessoTenant } from "@/server/services/acesso";
import { obterIdentidade } from "@/server/services/identidade-visual";
import { FormIdentidade, FormImagemDaMarca } from "@/components/identidade/formularios";

/** Identidade visual do tenant (white label, ADR-0010), dentro de Configurações: só administradores. */
export async function PainelDeIdentidade({ acesso }: { acesso: AcessoTenant }) {
  const id = await obterIdentidade(acesso);
  const t = await getTranslations("administracao.identidade");
  const url = (chave: string | null) => enderecoDaImagem(acesso.tenant.id, chave);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="text-text mb-1 text-base font-semibold">{t("titulo")}</h2>
        <p className="text-muted mb-4 text-sm">{t("texto")}</p>
        <FormIdentidade inicial={id} />
      </section>
      <section>
        <h2 className="text-text mb-1 text-base font-semibold">{t("logosTitulo")}</h2>
        <p className="text-muted mb-4 text-sm">{t("logosTexto")}</p>
        <FormImagemDaMarca
          tipo="logoClaro"
          titulo={t("logoClaro.titulo")}
          explicacao={t("logoClaro.explicacao")}
          atual={url(id.logoClaro)}
          nome={acesso.tenant.nomeExibido}
        />
        <FormImagemDaMarca
          tipo="logoEscuro"
          titulo={t("logoEscuro.titulo")}
          explicacao={t("logoEscuro.explicacao")}
          atual={url(id.logoEscuro)}
          nome={acesso.tenant.nomeExibido}
          fundoEscuro
        />
        <FormImagemDaMarca
          tipo="icone"
          titulo={t("icone.titulo")}
          explicacao={t("icone.explicacao")}
          atual={url(id.icone)}
          nome={acesso.tenant.nomeExibido}
        />
      </section>
    </div>
  );
}
