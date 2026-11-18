import { and, eq } from "drizzle-orm";
import { comTenant } from "@/server/db/cliente";
import { preferenciaMenu } from "@/server/db/esquema";
import { exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import type { Recurso } from "./permissoes/catalogo";
import { pode } from "./permissoes/verificador";

/**
 * Menu lateral das telas do tenant (decisão menor "Menu das áreas logadas"):
 * grupos de itens, mostrados só a quem pode vê-los (a decisão continua nos
 * serviços de cada tela), com favoritos e estado recolhido guardados por
 * usuário e tenant.
 */

export type ItemDoMenu = { id: string; rotulo: string; href: string; icone: string };
export type GrupoDoMenu = { titulo: string; itens: ItemDoMenu[] };
export type Menu = { grupos: GrupoDoMenu[]; favoritos: string[]; recolhido: boolean };

type Definicao = ItemDoMenu & { recurso?: Recurso; soAdministrador?: boolean };

const GRUPOS: { titulo: string; itens: Definicao[] }[] = [
  { titulo: "Início", itens: [{ id: "painel", rotulo: "Painel", href: "/", icone: "casa" }] },
  {
    titulo: "Cadastros",
    itens: [
      { id: "empresas", rotulo: "Empresas", href: "/empresas", icone: "predio", recurso: "empresas" },
      { id: "pessoas", rotulo: "Pessoas", href: "/pessoas", icone: "pessoas", recurso: "empresas" },
      {
        id: "cadastros-auxiliares",
        rotulo: "Cadastros auxiliares",
        href: "/cadastros",
        icone: "lista",
        recurso: "cadastros",
      },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { id: "usuarios", rotulo: "Usuários", href: "/usuarios", icone: "usuario", soAdministrador: true },
      { id: "perfis", rotulo: "Perfis", href: "/perfis", icone: "escudo", soAdministrador: true },
      {
        id: "identidade-visual",
        rotulo: "Identidade visual",
        href: "/identidade-visual",
        icone: "paleta",
        soAdministrador: true,
      },
    ],
  },
];

const IDS = new Set(GRUPOS.flatMap((g) => g.itens.map((i) => i.id)));

async function visivel(a: AcessoTenant, item: Definicao): Promise<boolean> {
  if (item.soAdministrador) return a.administrador;
  return item.recurso ? pode(a, item.recurso, "ver") : true;
}

async function preferencias(a: AcessoTenant) {
  const [p] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ favoritos: preferenciaMenu.favoritos, recolhido: preferenciaMenu.recolhido })
      .from(preferenciaMenu)
      .where(eq(preferenciaMenu.usuarioId, a.usuario.id)),
  );
  return p ?? { favoritos: [], recolhido: false };
}

export async function menuDoUsuario(acesso: Acesso | null): Promise<Menu> {
  const a = exigirTenant(acesso);
  const grupos: GrupoDoMenu[] = [];
  for (const g of GRUPOS) {
    const vis = await Promise.all(g.itens.map((i) => visivel(a, i)));
    const itens = g.itens
      .filter((_, n) => vis[n])
      .map(({ id, rotulo, href, icone }) => ({ id, rotulo, href, icone }));
    if (itens.length) grupos.push({ titulo: g.titulo, itens });
  }
  const p = await preferencias(a);
  const visiveis = new Set(grupos.flatMap((g) => g.itens.map((i) => i.id)));
  return { grupos, favoritos: p.favoritos.filter((f) => visiveis.has(f)), recolhido: p.recolhido };
}

async function gravar(a: AcessoTenant, valores: { favoritos?: string[]; recolhido?: boolean }) {
  await comTenant(a.tenant.id, async (tx) => {
    const feito = await tx
      .update(preferenciaMenu)
      .set({ ...valores, atualizadoEm: new Date() })
      .where(and(eq(preferenciaMenu.usuarioId, a.usuario.id), eq(preferenciaMenu.tenantId, a.tenant.id)))
      .returning({ u: preferenciaMenu.usuarioId });
    if (feito.length === 0)
      await tx.insert(preferenciaMenu).values({ tenantId: a.tenant.id, usuarioId: a.usuario.id, ...valores });
  });
}

/** Marca ou desmarca um item como favorito. Devolve a lista nova. */
export async function alternarFavorito(acesso: Acesso | null, itemId: string): Promise<string[]> {
  const a = exigirTenant(acesso);
  if (!IDS.has(itemId)) return (await preferencias(a)).favoritos;
  const atuais = (await preferencias(a)).favoritos;
  const favoritos = atuais.includes(itemId) ? atuais.filter((f) => f !== itemId) : [...atuais, itemId];
  await gravar(a, { favoritos });
  return favoritos;
}

export async function definirMenuRecolhido(acesso: Acesso | null, recolhido: boolean): Promise<void> {
  await gravar(exigirTenant(acesso), { recolhido });
}
