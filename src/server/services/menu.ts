import { and, eq } from "drizzle-orm";
import { estaLigada, type Funcionalidade } from "@/config/funcionalidades";
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

/** Texto de cada item e grupo: `menu.itens.<id>` e `menu.grupos.<chave>` nas mensagens. */
export type ItemDoMenu = { id: string; href: string; icone: string };
export type GrupoDoMenu = { chave: string; itens: ItemDoMenu[] };
export type Menu = { grupos: GrupoDoMenu[]; favoritos: string[]; recolhido: boolean };

type Definicao = ItemDoMenu & {
  recurso?: Recurso;
  soAdministrador?: boolean;
  ouAdministrador?: boolean;
  /** Funcionalidade simulada ou ainda não real: o item some quando ela está desligada. */
  funcionalidade?: Funcionalidade;
};

const GRUPOS: { chave: string; itens: Definicao[] }[] = [
  { chave: "inicio", itens: [{ id: "painel", href: "/", icone: "casa" }] },
  {
    chave: "negocios",
    itens: [
      { id: "negocios", href: "/negocios", icone: "maleta", recurso: "deals" },
      { id: "contratos", href: "/contratos", icone: "contrato", recurso: "deals" },
      {
        id: "templates",
        href: "/templates",
        icone: "modelo",
        recurso: "deals",
        funcionalidade: "templatesDocx",
      },
    ],
  },
  {
    chave: "cadastros",
    itens: [
      { id: "empresas", href: "/empresas", icone: "predio", recurso: "empresas" },
      { id: "pessoas", href: "/pessoas", icone: "pessoas", recurso: "empresas" },
    ],
  },
  {
    chave: "administracao",
    itens: [
      { id: "usuarios", href: "/usuarios", icone: "usuario", soAdministrador: true },
      { id: "perfis", href: "/perfis", icone: "escudo", soAdministrador: true },
      {
        id: "auditoria",
        href: "/auditoria",
        icone: "historico",
        recurso: "auditoria",
        ouAdministrador: true,
      },
      {
        id: "configuracoes",
        href: "/configuracoes",
        icone: "engrenagem",
        recurso: "cadastros",
        ouAdministrador: true,
      },
    ],
  },
];

const IDS = new Set(GRUPOS.flatMap((g) => g.itens.map((i) => i.id)));

async function visivel(a: AcessoTenant, item: Definicao): Promise<boolean> {
  if (item.funcionalidade && !estaLigada(item.funcionalidade)) return false;
  if (item.soAdministrador) return a.administrador;
  if (item.ouAdministrador && a.administrador) return true;
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
    const itens = g.itens.filter((_, n) => vis[n]).map(({ id, href, icone }) => ({ id, href, icone }));
    if (itens.length) grupos.push({ chave: g.chave, itens });
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

/**
 * Nova ordem dos favoritos (arrastar no menu ou setas pelo teclado). Só reordena
 * os que já são favoritos: itens desconhecidos são ignorados e os que faltarem
 * continuam no fim. Devolve a lista gravada.
 */
export async function ordenarFavoritos(acesso: Acesso | null, ordem: string[]): Promise<string[]> {
  const a = exigirTenant(acesso);
  const atuais = (await preferencias(a)).favoritos;
  const pedidos = [...new Set(ordem)].filter((id) => atuais.includes(id));
  const favoritos = [...pedidos, ...atuais.filter((id) => !pedidos.includes(id))];
  await gravar(a, { favoritos });
  return favoritos;
}
