import { and, count, eq, inArray } from "drizzle-orm";
import { banco, comTenant } from "@/server/db/cliente";
import {
  categoriaDocumento,
  empresa,
  papelEmpresa,
  perfil,
  tenant,
  tipoOperacao,
  tipoVinculo,
  usuario,
  vinculoTenant,
} from "@/server/db/esquema";
import { completarEtapasPadrao } from "./etapas";
import { CATEGORIAS_PADRAO } from "./documentos";
import { copiarPerfisPadrao } from "./perfis";
import { ligarContaAPessoa } from "./pessoas";

/**
 * Cadastros que todo tenant recebe ao nascer (dominio.md), como os perfis
 * padrão: depois da cópia, são do tenant e editáveis.
 */

/** Papéis de empresa padrão, com o perfil de deal sugerido (código do perfil padrão). */
export const PAPEIS_PADRAO: { codigo: string; nome: string; perfil: string | null }[] = [
  { codigo: "vendedora", nome: "Vendedora", perfil: "representante" },
  { codigo: "compradora", nome: "Compradora", perfil: "representante" },
  { codigo: "advisor-vendedora", nome: "Advisor da vendedora", perfil: "advisor" },
  { codigo: "advisor-compradora", nome: "Advisor da compradora", perfil: "advisor" },
  {
    codigo: "escritorio-vendedora",
    nome: "Escritório de advocacia da vendedora",
    perfil: "advogado",
  },
  {
    codigo: "escritorio-compradora",
    nome: "Escritório de advocacia da compradora",
    perfil: "advogado",
  },
  { codigo: "contabilidade-vendedora", nome: "Contabilidade da vendedora", perfil: "contador" },
  { codigo: "contabilidade-compradora", nome: "Contabilidade da compradora", perfil: "contador" },
  { codigo: "auditora-vendedora", nome: "Auditora da vendedora", perfil: "auditor" },
  { codigo: "auditora-compradora", nome: "Auditora da compradora", perfil: "auditor" },
  { codigo: "investidores-compradora", nome: "Investidores e sócios da compradora", perfil: "representante" },
  { codigo: "socios-vendedora", nome: "Sócios da vendedora", perfil: "representante" },
];

/** Lado do papel padrão, pelo código ("-vendedora" / "-compradora"). */
export function ladoDoPapelPadrao(codigo: string): "vendedor" | "comprador" | null {
  if (codigo === "vendedora" || codigo.endsWith("-vendedora")) return "vendedor";
  if (codigo === "compradora" || codigo.endsWith("-compradora")) return "comprador";
  return null;
}

/** Tipos de operação padrão dos negócios. */
export const TIPOS_DE_OPERACAO_PADRAO: { codigo: string; nome: string; comPercentual: boolean }[] = [
  { codigo: "aquisicao-total", nome: "Aquisição total", comPercentual: false },
  { codigo: "aquisicao-parcial", nome: "Aquisição parcial", comPercentual: true },
  { codigo: "fusao", nome: "Fusão", comPercentual: false },
  { codigo: "incorporacao", nome: "Incorporação", comPercentual: false },
  { codigo: "investimento", nome: "Investimento (aporte)", comPercentual: false },
];

/** Tipos de vínculo padrão entre pessoa e empresa. */
export const VINCULOS_PADRAO: { codigo: string; nome: string; comPercentual: boolean }[] = [
  { codigo: "socio", nome: "Sócio", comPercentual: true },
  { codigo: "administrador", nome: "Administrador", comPercentual: false },
  { codigo: "representante-legal", nome: "Representante legal", comPercentual: false },
  { codigo: "procurador", nome: "Procurador", comPercentual: false },
  { codigo: "funcionario", nome: "Funcionário", comPercentual: false },
  { codigo: "contato", nome: "Contato", comPercentual: false },
];

/**
 * Completa o que faltar no tenant: perfis padrão (se não tiver nenhum),
 * papéis e tipos de vínculo (se não tiver nenhum) e a empresa do contratante
 * (se não existir). Idempotente: pode rodar de novo sem duplicar.
 */
export async function completarCadastrosPadrao(tenantId: string): Promise<void> {
  await copiarPerfisPadrao(tenantId);
  const [t] = await banco()
    .select({ nome: tenant.nome, nomeExibicao: tenant.nomeExibicao })
    .from(tenant)
    .where(eq(tenant.id, tenantId));
  if (!t) return;
  await comTenant(tenantId, async (tx) => {
    const [{ papeis }] = await tx.select({ papeis: count() }).from(papelEmpresa);
    if (papeis === 0) {
      const perfis = await tx
        .select({ id: perfil.id, padrao: perfil.padrao })
        .from(perfil)
        .where(
          and(
            eq(perfil.camada, "deal"),
            inArray(
              perfil.padrao,
              PAPEIS_PADRAO.flatMap((p) => (p.perfil ? [p.perfil] : [])),
            ),
          ),
        );
      const idDo = new Map(perfis.map((p) => [p.padrao, p.id]));
      await tx.insert(papelEmpresa).values(
        PAPEIS_PADRAO.map((p) => ({
          tenantId,
          nome: p.nome,
          padrao: p.codigo,
          lado: ladoDoPapelPadrao(p.codigo),
          perfilSugeridoId: (p.perfil && idDo.get(p.perfil)) || null,
        })),
      );
    }
    const [{ vinculos }] = await tx.select({ vinculos: count() }).from(tipoVinculo);
    if (vinculos === 0)
      await tx.insert(tipoVinculo).values(
        VINCULOS_PADRAO.map((v) => ({
          tenantId,
          nome: v.nome,
          padrao: v.codigo,
          comPercentual: v.comPercentual,
        })),
      );
    const [{ tipos }] = await tx.select({ tipos: count() }).from(tipoOperacao);
    if (tipos === 0)
      await tx.insert(tipoOperacao).values(
        TIPOS_DE_OPERACAO_PADRAO.map((o) => ({
          tenantId,
          nome: o.nome,
          padrao: o.codigo,
          comPercentual: o.comPercentual,
        })),
      );
    await completarEtapasPadrao(tx, tenantId);
    const [{ categorias }] = await tx.select({ categorias: count() }).from(categoriaDocumento);
    if (categorias === 0)
      await tx
        .insert(categoriaDocumento)
        .values(CATEGORIAS_PADRAO.map(([padrao, nome]) => ({ tenantId, nome, padrao })));
    const [doContratante] = await tx
      .select({ id: empresa.id })
      .from(empresa)
      .where(eq(empresa.doContratante, true));
    if (!doContratante)
      await tx
        .insert(empresa)
        .values({ tenantId, razaoSocial: t.nomeExibicao || t.nome, doContratante: true });
    // Usuários que entraram antes das pessoas existirem também viram pessoas.
    const ativos = await tx
      .select({ usuarioId: usuario.id, nome: usuario.name, email: usuario.email })
      .from(vinculoTenant)
      .innerJoin(usuario, eq(usuario.id, vinculoTenant.usuarioId))
      .where(eq(vinculoTenant.situacao, "ativo"));
    for (const u of ativos) await ligarContaAPessoa(tx, tenantId, u);
  });
}

/** Para tenants criados antes destes cadastros (script de manutenção). */
export async function completarCadastrosPadraoParaTodos(): Promise<number> {
  const tenants = await banco().select({ id: tenant.id }).from(tenant);
  for (const t of tenants) await completarCadastrosPadrao(t.id);
  return tenants.length;
}
