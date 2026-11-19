import { inArray } from "drizzle-orm";
import { banco } from "@/server/db/cliente";
import { usuario } from "@/server/db/esquema";
import { enviarEmail } from "@/server/email/enviar";
import { montarEmail } from "@/server/email/modelo";
import { urlDaArea } from "@/server/enderecos";
import { tradutor } from "@/i18n/servidor";
import { marcaParaEmail } from "./marca";

/**
 * E-mails dos negócios (dominio.md, "Avisos"): sempre com número + codinome,
 * nunca com o nome interno ou a vendedora. Falha no envio não desfaz a
 * operação (o aviso no sino já foi criado).
 */

export type TipoDeAvisoPorEmail =
  | "incluido"
  | "situacao"
  | "exclusividadeInicio"
  | "exclusividadeAviso"
  | "exclusividadeFim"
  | "participacaoVencida"
  | "tarefaPrazo";

export async function avisarPorEmail(
  a: { tenant: { id: string; slug: string } },
  usuarioIds: string[],
  tipo: TipoDeAvisoPorEmail,
  negocio: string,
  dealId: string,
  parametros: Record<string, string | number> = {},
): Promise<void> {
  const ids = [...new Set(usuarioIds)];
  if (ids.length === 0) return;
  try {
    const [destinos, t, marca] = await Promise.all([
      banco()
        .select({ nome: usuario.name, email: usuario.email })
        .from(usuario)
        .where(inArray(usuario.id, ids)),
      tradutor(),
      marcaParaEmail(a.tenant.id),
    ]);
    const url = urlDaArea({ tipo: "tenant", slug: a.tenant.slug }, `/negocios/${dealId}`);
    const p = { negocio, ...parametros };
    for (const d of destinos)
      await enviarEmail(
        montarEmail({
          para: d.email,
          assunto: t(`emails.negocio.${tipo}.assunto`, p),
          saudacao: t("emails.saudacao", { nome: d.nome }),
          paragrafos: [t(`emails.negocio.${tipo}.paragrafo`, p)],
          link: { texto: t("emails.negocio.botao"), url },
          linkAlternativo: t("emails.linkAlternativo"),
          marca,
        }),
      );
  } catch {
    // Sem log do conteúdo nem do destinatário (ADR-0007); o aviso no sino continua.
  }
}
