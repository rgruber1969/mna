import { and, count, eq, inArray } from "drizzle-orm";
import { banco, comTenant } from "@/server/db/cliente";
import {
  empresa,
  papelEmpresa,
  perfil,
  tenant,
  tipoVinculo,
  usuario,
  vinculoTenant,
} from "@/server/db/esquema";
import { copiarPerfisPadrao } from "./perfis";
import { ligarContaAPessoa } from "./pessoas";

/**
 * Cadastros que todo tenant recebe ao nascer (dominio.md), como os perfis
 * padrão: depois da cópia, são do tenant e editáveis.
 */

/** Papéis de empresa padrão, com o perfil de deal sugerido (código do perfil padrão). */
export const PAPEIS_PADRAO: { codigo: string; nome: string; perfil: string | null }[] = [
  { codigo: "vendedora", nome: "Vendedora", perfil: "vendedora" },
  { codigo: "compradora", nome: "Compradora", perfil: "compradora" },
  { codigo: "advisor-vendedora", nome: "Advisor da vendedora", perfil: "advisor-vendedora" },
  { codigo: "advisor-compradora", nome: "Advisor da compradora", perfil: "advisor-compradora" },
  {
    codigo: "escritorio-vendedora",
    nome: "Escritório de advocacia da vendedora",
    perfil: "advogado-vendedora",
  },
  {
    codigo: "escritorio-compradora",
    nome: "Escritório de advocacia da compradora",
    perfil: "advogado-compradora",
  },
  { codigo: "contabilidade-vendedora", nome: "Contabilidade da vendedora", perfil: "contador-vendedora" },
  { codigo: "contabilidade-compradora", nome: "Contabilidade da compradora", perfil: "contador-compradora" },
  { codigo: "auditora-vendedora", nome: "Auditora da vendedora", perfil: "auditor" },
  { codigo: "auditora-compradora", nome: "Auditora da compradora", perfil: "auditor" },
  { codigo: "investidores-compradora", nome: "Investidores e sócios da compradora", perfil: "compradora" },
  { codigo: "socios-vendedora", nome: "Sócios da vendedora", perfil: "vendedora" },
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
