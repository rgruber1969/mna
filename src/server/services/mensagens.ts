import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { tradutor } from "@/i18n/servidor";
import { banco, comTenant } from "@/server/db/cliente";
import {
  deal,
  empresa,
  mensagem,
  mensagemLeitura,
  participacaoDeal,
  pessoa,
  tenant,
  usuario,
  vinculoTenant,
} from "@/server/db/esquema";
import { enviarEmail } from "@/server/email/enviar";
import { montarEmail } from "@/server/email/modelo";
import { urlDaArea } from "@/server/enderecos";
import { exigirAdministrador, exigirTenant, tenantPorSlug, type Acesso, type AcessoTenant } from "./acesso";
import { dataRoomDoNegocio } from "./documentos";
import { auditar } from "./empresas";
import { contextoDeEtapas } from "./etapas";
import { marcaParaEmail } from "./marca";
import { avisarPorEmail } from "./negocios-avisos";
import {
  ladoDaParticipacao,
  negocioFechado,
  nomeVisivel,
  visaoDoNegocio,
  type EmpresaNoNegocio,
  type Visao,
} from "./negocios";
import { notificar } from "./notificacoes";
import { concede } from "./permissoes/catalogo";
import { criarTarefa, ordenarEtapas, tarefasDoNegocio } from "./tarefas";

/**
 * Mensageria (item 16; dominio.md, "Mensageria e avisos"; M1–M3).
 *
 * - Conversas no negócio (geral), em cada etapa, em cada versão de
 *   documento e em cada tarefa; quem vê o item vê a conversa.
 * - Sigilo entre compradoras (dominio.md, "Compradoras potenciais"): cada
 *   conversa tem canais. "vendedor" é da equipe do lado vendedor;
 *   "equipe:<compradora>" é da equipe de uma compradora; "entre:<compradora>"
 *   reúne o lado vendedor e aquela compradora, depois do NDA dela. Ninguém do
 *   lado comprador vê canal de outra compradora. Administradores veem todos.
 * - Imutáveis (o banco só deixa incluir); sem conversa privada; sem tempo real.
 * - Menções avisam no sino e por e-mail, sem o texto da mensagem; resumo
 *   de mensagens novas por e-mail no intervalo do tenant (padrão 1 hora),
 *   que cada pessoa pode desligar.
 */

export type AlvoTipo = "deal" | "etapa" | "versao" | "tarefa";
export type Alvo = { tipo: AlvoTipo; id: string | null };
export const TIPOS_DE_ALVO: AlvoTipo[] = ["deal", "etapa", "versao", "tarefa"];

export type CanalNaTela = {
  id: string;
  tipo: "vendedor" | "equipe" | "entre";
  /** Nome da compradora (canais "equipe" e "entre"). */
  compradora: string | null;
  naoLidas: number;
};

export type MensagemNaTela = {
  id: string;
  autor: string | null;
  minha: boolean;
  texto: string;
  mencoes: string[];
  em: string;
  tarefaId: string | null;
};

export type Conversa = {
  alvo: Alvo;
  /** Nome do item (etapa, documento e versão, tarefa); vazio na conversa geral. */
  rotulo: string;
  canais: CanalNaTela[];
  canal: string | null;
  mensagens: MensagemNaTela[];
  /** Quem pode ser mencionado neste canal. */
  pessoas: { id: string; nome: string }[];
  podeEscrever: boolean;
  podeVirarTarefa: boolean;
};

export type ResumoDeConversa = {
  alvo: Alvo;
  rotulo: string;
  total: number;
  naoLidas: number;
  ultimaEm: string | null;
};

export type MensagemRecente = {
  dealId: string;
  negocio: string;
  alvo: Alvo;
  rotulo: string;
  canal: CanalNaTela;
  autor: string | null;
  trecho: string;
  em: string;
  naoLidas: number;
  link: string;
};

const uuidValido = (id: string | null | undefined) => Boolean(id && z.uuid().safeParse(id).success);
const TAMANHO_MAXIMO = 5000;
/** Janela das listas gerais (tela principal, ícone e resumo por e-mail). */
const DIAS_RECENTES = 30;

export const chaveDaConversa = (alvo: Alvo, canal: string) => `${alvo.tipo}:${alvo.id ?? "-"}:${canal}`;

export function linkDaConversa(dealId: string, alvo: Alvo, canal?: string): string {
  const q = new URLSearchParams({ aba: "mensagens", conversa: `${alvo.tipo}:${alvo.id ?? "-"}` });
  if (canal) q.set("canal", canal);
  return `/negocios/${dealId}?${q.toString()}`;
}

/** "etapa:<id>" → alvo (o que vem do endereço ou da tela). */
export function lerAlvo(texto: string | null | undefined): Alvo | null {
  if (!texto) return { tipo: "deal", id: null };
  const [tipo, id] = texto.split(":");
  if (!TIPOS_DE_ALVO.includes(tipo as AlvoTipo)) return null;
  if (tipo === "deal") return { tipo: "deal", id: null };
  return uuidValido(id) ? { tipo: tipo as AlvoTipo, id } : null;
}

// --- Canais ------------------------------------------------------------------------------

const APOS_NDA = new Set(["nda", "proposta", "escolhida"]);

/** Canais que a pessoa vê no negócio (sigilo entre compradoras). */
function canaisDaPessoa(v: Visao, empresas: EmpresaNoNegocio[], nomes: Map<string, string>) {
  const compradoras = empresas.filter((e) => e.compradora);
  const canais: Omit<CanalNaTela, "naoLidas">[] = [];
  const vendedor = v.administrador || v.lados.has("vendedor");
  if (vendedor) canais.push({ id: "vendedor", tipo: "vendedor", compradora: null });
  for (const c of compradoras) {
    const nome = nomes.get(c.empresaId) ?? "";
    const minha = v.minhasCompradoras.has(c.empresaId);
    if (v.administrador || minha)
      canais.push({ id: `equipe:${c.empresaId}`, tipo: "equipe", compradora: nome });
    if ((vendedor || minha) && c.situacaoFunil && APOS_NDA.has(c.situacaoFunil))
      canais.push({ id: `entre:${c.empresaId}`, tipo: "entre", compradora: nome });
  }
  return canais;
}

/** Usuários participantes que veem um canal (para menções e avisos). */
async function pessoasDoCanal(a: AcessoTenant, dealId: string, empresas: EmpresaNoNegocio[], canal: string) {
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        usuarioId: pessoa.usuarioId,
        nome: usuario.name,
        empresaId: participacaoDeal.empresaId,
        lado: participacaoDeal.lado,
      })
      .from(participacaoDeal)
      .innerJoin(pessoa, eq(pessoa.id, participacaoDeal.pessoaId))
      .innerJoin(usuario, eq(usuario.id, pessoa.usuarioId))
      .where(
        and(
          eq(participacaoDeal.dealId, dealId),
          isNotNull(pessoa.usuarioId),
          sql`(${participacaoDeal.prazo} is null or ${participacaoDeal.prazo} >= current_date)`,
        ),
      ),
  );
  const [tipo, compradoraId] = canal.split(":");
  const grupoDe = (empresaId: string | null) => {
    const e = empresas.find((x) => x.empresaId === empresaId);
    return e?.compradora ? e.empresaId : (e?.atuaParaId ?? null);
  };
  const veCanal = (l: (typeof linhas)[number]) => {
    const lado = ladoDaParticipacao(empresas, { empresaId: l.empresaId, lado: l.lado });
    if (lado === "vendedor") return tipo === "vendedor" || tipo === "entre";
    if (lado === "comprador") return tipo !== "vendedor" && grupoDe(l.empresaId) === compradoraId;
    return false;
  };
  const vistos = new Map<string, string>();
  for (const l of linhas) if (veCanal(l) && !vistos.has(l.usuarioId!)) vistos.set(l.usuarioId!, l.nome);
  return [...vistos].map(([id, nome]) => ({ id, nome })).sort((x, y) => x.nome.localeCompare(y.nome));
}

// --- Contexto de um negócio ----------------------------------------------------------------

async function contextoSemErro(a: AcessoTenant, dealId: string) {
  try {
    return await contexto(a, dealId);
  } catch {
    return null;
  }
}

/** Visão, canais e o que a pessoa vê no negócio (lança AcessoNegado se não participa). */
async function contexto(a: AcessoTenant, dealId: string) {
  const { visao, empresas } = await visaoDoNegocio(a, dealId);
  const etapas = await contextoDeEtapas(a, dealId);
  const ids = empresas.filter((e) => e.compradora).map((e) => e.empresaId);
  const nomes = new Map(
    ids.length
      ? (
          await comTenant(a.tenant.id, (tx) =>
            tx
              .select({
                id: empresa.id,
                nome: sql<string>`coalesce(${empresa.nomeFantasia}, ${empresa.razaoSocial})`,
              })
              .from(empresa)
              .where(inArray(empresa.id, ids)),
          )
        ).map((e) => [e.id, e.nome])
      : [],
  );
  const canais = canaisDaPessoa(visao, empresas, nomes);
  let versoes: Map<string, { rotulo: string; etapaId: string | null }> | null = null;
  let tarefas: Map<string, { rotulo: string; etapaId: string | null }> | null = null;
  const carregarVersoes = async () => {
    if (versoes) return versoes;
    const dr = await dataRoomDoNegocio(a, dealId).catch(() => null);
    versoes = new Map();
    for (const d of dr?.documentos ?? [])
      for (const v of d.versoes)
        versoes.set(v.id, { rotulo: `${d.titulo} (v${v.numero})`, etapaId: d.etapaId });
    return versoes;
  };
  const carregarTarefas = async () => {
    if (tarefas) return tarefas;
    const q = await tarefasDoNegocio(a, dealId).catch(() => null);
    tarefas = new Map((q?.tarefas ?? []).map((t) => [t.id, { rotulo: t.titulo, etapaId: t.etapaId }]));
    return tarefas;
  };
  /** Nome e etapa do item, se a pessoa o vê; null se não vê. */
  const item = async (alvo: Alvo): Promise<{ rotulo: string; etapaId: string | null } | null> => {
    if (alvo.tipo === "deal") return { rotulo: "", etapaId: null };
    if (!alvo.id) return null;
    if (alvo.tipo === "etapa") {
      const e = etapas.etapas.find((x) => x.id === alvo.id);
      return e && etapas.podeNa(e.id, "ver") ? { rotulo: e.nome, etapaId: e.id } : null;
    }
    if (alvo.tipo === "versao") return (await carregarVersoes()).get(alvo.id) ?? null;
    return (await carregarTarefas()).get(alvo.id) ?? null;
  };
  const canalVisivel = (canal: string) => canais.some((c) => c.id === canal);
  return { visao, empresas, etapas, canais, item, canalVisivel };
}

type Ctx = Awaited<ReturnType<typeof contexto>>;

async function leiturasDe(a: AcessoTenant, chaves: string[]) {
  if (chaves.length === 0) return new Map<string, Date>();
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ chave: mensagemLeitura.chave, lidaEm: mensagemLeitura.lidaEm })
      .from(mensagemLeitura)
      .where(and(eq(mensagemLeitura.usuarioId, a.usuario.id), inArray(mensagemLeitura.chave, chaves))),
  );
  return new Map(linhas.map((l) => [l.chave, l.lidaEm]));
}

async function marcarLida(a: AcessoTenant, dealId: string, chave: string) {
  await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(mensagemLeitura)
      .values({ tenantId: a.tenant.id, usuarioId: a.usuario.id, dealId, chave, lidaEm: new Date() })
      .onConflictDoUpdate({
        target: [mensagemLeitura.tenantId, mensagemLeitura.usuarioId, mensagemLeitura.chave],
        set: { lidaEm: new Date() },
      }),
  );
}

const naoLida = (a: AcessoTenant, m: { autorId: string | null; criadoEm: Date }, lidaEm?: Date) =>
  m.autorId !== a.usuario.id && (!lidaEm || m.criadoEm > lidaEm);

// --- Conversa ------------------------------------------------------------------------------

/**
 * Uma conversa: canais da pessoa (com as não lidas), mensagens do canal
 * escolhido (marcado como lido) e quem pode ser mencionado.
 */
export async function obterConversa(
  acesso: Acesso | null,
  dealId: string,
  alvo: Alvo,
  canalPedido?: string | null,
): Promise<Conversa | null> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return null;
  const ctx = await contextoSemErro(a, dealId);
  if (!ctx) return null;
  const it = await ctx.item(alvo);
  if (!it) return null;
  const vazia: Conversa = {
    alvo,
    rotulo: it.rotulo,
    canais: [],
    canal: null,
    mensagens: [],
    pessoas: [],
    podeEscrever: false,
    podeVirarTarefa: false,
  };
  if (ctx.canais.length === 0) return vazia;
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        id: mensagem.id,
        canal: mensagem.canal,
        autorId: mensagem.autorId,
        autor: usuario.name,
        texto: mensagem.texto,
        mencoes: mensagem.mencoes,
        tarefaId: mensagem.tarefaId,
        criadoEm: mensagem.criadoEm,
      })
      .from(mensagem)
      .leftJoin(usuario, eq(usuario.id, mensagem.autorId))
      .where(
        and(
          eq(mensagem.dealId, dealId),
          eq(mensagem.alvoTipo, alvo.tipo),
          alvo.id ? eq(mensagem.alvoId, alvo.id) : isNull(mensagem.alvoId),
          inArray(
            mensagem.canal,
            ctx.canais.map((c) => c.id),
          ),
        ),
      )
      .orderBy(mensagem.criadoEm),
  );
  const leituras = await leiturasDe(
    a,
    ctx.canais.map((c) => chaveDaConversa(alvo, c.id)),
  );
  const canais = ctx.canais.map((c) => ({
    ...c,
    naoLidas: linhas.filter(
      (m) => m.canal === c.id && naoLida(a, m, leituras.get(chaveDaConversa(alvo, c.id))),
    ).length,
  }));
  const canal =
    (canalPedido && canais.find((c) => c.id === canalPedido)?.id) ||
    canais.find((c) => c.naoLidas > 0)?.id ||
    canais[0].id;
  const doCanal = linhas.filter((m) => m.canal === canal);
  const ids = [...new Set(doCanal.flatMap((m) => m.mencoes))];
  const nomes = new Map(
    ids.length
      ? (
          await comTenant(a.tenant.id, (tx) =>
            tx.select({ id: usuario.id, nome: usuario.name }).from(usuario).where(inArray(usuario.id, ids)),
          )
        ).map((u) => [u.id, u.nome])
      : [],
  );
  const [pessoas, fechado] = await Promise.all([
    pessoasDoCanal(a, dealId, ctx.empresas, canal),
    negocioFechado(a, dealId),
  ]);
  await marcarLida(a, dealId, chaveDaConversa(alvo, canal));
  return {
    alvo,
    rotulo: it.rotulo,
    canais: canais.map((c) => (c.id === canal ? { ...c, naoLidas: 0 } : c)),
    canal,
    mensagens: doCanal.map((m) => ({
      id: m.id,
      autor: m.autor,
      minha: m.autorId === a.usuario.id,
      texto: m.texto,
      mencoes: m.mencoes.map((id) => nomes.get(id) ?? "").filter(Boolean),
      em: m.criadoEm.toISOString(),
      tarefaId: m.tarefaId,
    })),
    pessoas: pessoas.filter((p) => p.id !== a.usuario.id),
    podeEscrever: !fechado,
    podeVirarTarefa: !fechado && concede(ctx.etapas.matrizNa(it.etapaId), "tarefas", "criar"),
  };
}

const DadosMensagem = z.object({
  texto: z
    .string()
    .trim()
    .min(1, "mensagens.erros.textoObrigatorio")
    .max(TAMANHO_MAXIMO, "mensagens.erros.textoLongo"),
  mencoes: z.array(z.string()).max(50).default([]),
});

/** Envia uma mensagem (imutável) e avisa as pessoas mencionadas. */
export async function enviarMensagem(
  acesso: Acesso | null,
  dealId: string,
  alvo: Alvo,
  canal: string,
  dados: z.input<typeof DadosMensagem>,
): Promise<{ id: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const d = DadosMensagem.safeParse(dados);
  if (!d.success) return { erro: d.error.issues[0].message, campo: "texto" };
  if (!uuidValido(dealId)) return { erro: "mensagens.erros.naoEncontrada" };
  const ctx = await contextoSemErro(a, dealId);
  if (!ctx || !(await ctx.item(alvo)) || !ctx.canalVisivel(canal))
    return { erro: "mensagens.erros.naoEncontrada" };
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const pessoas = await pessoasDoCanal(a, dealId, ctx.empresas, canal);
  const mencoes = [...new Set(d.data.mencoes)].filter(
    (id) => id !== a.usuario.id && pessoas.some((p) => p.id === id),
  );
  const [n] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ numero: deal.numero, codinome: deal.codinome }).from(deal).where(eq(deal.id, dealId)),
  );
  const negocio = nomeVisivel(n.numero, n.codinome);
  const link = linkDaConversa(dealId, alvo, canal);
  const id = await comTenant(a.tenant.id, async (tx) => {
    const [m] = await tx
      .insert(mensagem)
      .values({
        tenantId: a.tenant.id,
        dealId,
        alvoTipo: alvo.tipo,
        alvoId: alvo.id,
        canal,
        autorId: a.usuario.id,
        texto: d.data.texto,
        mencoes,
      })
      .returning({ id: mensagem.id });
    // O aviso não leva o texto: só quem vê a conversa lê a mensagem.
    for (const u of mencoes)
      await notificar(tx, a.tenant.id, u, "mensagem_mencao", { autor: a.usuario.nome, negocio }, link);
    return m.id;
  });
  await auditar(a, "mensagem.enviada", "deal", dealId, { alvo: alvo.tipo, canal, mencoes: mencoes.length });
  await marcarLida(a, dealId, chaveDaConversa(alvo, canal));
  if (mencoes.length)
    await avisarPorEmail(a, mencoes, "mencao", negocio, dealId, { autor: a.usuario.nome }, link);
  return { id };
}

/** "Marcar como tarefa": cria uma tarefa (sem responsável) com o texto da mensagem. */
export async function mensagemParaTarefa(
  acesso: Acesso | null,
  mensagemId: string,
): Promise<{ tarefaId: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!uuidValido(mensagemId)) return { erro: "mensagens.erros.naoEncontrada" };
  const [m] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ m: mensagem, autor: usuario.name })
      .from(mensagem)
      .leftJoin(usuario, eq(usuario.id, mensagem.autorId))
      .where(eq(mensagem.id, mensagemId)),
  );
  if (!m) return { erro: "mensagens.erros.naoEncontrada" };
  const ctx = await contextoSemErro(a, m.m.dealId);
  const alvo: Alvo = { tipo: m.m.alvoTipo, id: m.m.alvoId };
  const it = ctx ? await ctx.item(alvo) : null;
  if (!ctx || !it || !ctx.canalVisivel(m.m.canal)) return { erro: "mensagens.erros.naoEncontrada" };
  if (m.m.tarefaId) return { erro: "mensagens.erros.jaVirouTarefa" };
  const t = await tradutor();
  const primeira = m.m.texto.split("\n")[0].trim();
  const titulo = primeira.length >= 2 ? primeira.slice(0, 200) : t("mensagens.tarefaDaMensagem");
  const r = await criarTarefa(a, m.m.dealId, {
    titulo,
    descricao: `${m.m.texto}\n\n${t("mensagens.origemDaTarefa", {
      autor: m.autor ?? "—",
      data: m.m.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    })}`.slice(0, 4000),
    etapaId: it.etapaId ?? "",
    prazo: "",
  });
  if ("erro" in r) return r;
  await comTenant(a.tenant.id, (tx) =>
    tx.update(mensagem).set({ tarefaId: r.id }).where(eq(mensagem.id, mensagemId)),
  );
  return { tarefaId: r.id };
}

// --- Listas ------------------------------------------------------------------------------

/**
 * Conversas do negócio para a aba Mensagens: a geral, a de cada etapa que
 * a pessoa vê e as de documentos e tarefas que já têm mensagens.
 */
export async function conversasDoNegocio(
  acesso: Acesso | null,
  dealId: string,
): Promise<ResumoDeConversa[] | null> {
  const a = exigirTenant(acesso);
  if (!uuidValido(dealId)) return null;
  const ctx = await contextoSemErro(a, dealId);
  if (!ctx) return null;
  const canais = ctx.canais.map((c) => c.id);
  const linhas = canais.length
    ? await comTenant(a.tenant.id, (tx) =>
        tx
          .select({
            alvoTipo: mensagem.alvoTipo,
            alvoId: mensagem.alvoId,
            canal: mensagem.canal,
            autorId: mensagem.autorId,
            criadoEm: mensagem.criadoEm,
          })
          .from(mensagem)
          .where(and(eq(mensagem.dealId, dealId), inArray(mensagem.canal, canais))),
      )
    : [];
  const leituras = await leiturasDe(a, [
    ...new Set(linhas.map((m) => chaveDaConversa({ tipo: m.alvoTipo, id: m.alvoId }, m.canal))),
  ]);
  const resumo = (alvo: Alvo, rotulo: string): ResumoDeConversa => {
    const doAlvo = linhas.filter((m) => m.alvoTipo === alvo.tipo && (m.alvoId ?? null) === alvo.id);
    const ultima = doAlvo.reduce<Date | null>((x, m) => (!x || m.criadoEm > x ? m.criadoEm : x), null);
    return {
      alvo,
      rotulo,
      total: doAlvo.length,
      naoLidas: doAlvo.filter((m) => naoLida(a, m, leituras.get(chaveDaConversa(alvo, m.canal)))).length,
      ultimaEm: ultima?.toISOString() ?? null,
    };
  };
  const lista: ResumoDeConversa[] = [resumo({ tipo: "deal", id: null }, "")];
  for (const e of ordenarEtapas(ctx.etapas.etapas))
    if (ctx.etapas.podeNa(e.id, "ver")) lista.push(resumo({ tipo: "etapa", id: e.id }, e.nome));
  const outros = new Map<string, Alvo>();
  for (const m of linhas)
    if ((m.alvoTipo === "versao" || m.alvoTipo === "tarefa") && m.alvoId)
      outros.set(`${m.alvoTipo}:${m.alvoId}`, { tipo: m.alvoTipo, id: m.alvoId });
  for (const alvo of outros.values()) {
    const it = await ctx.item(alvo);
    if (it) lista.push(resumo(alvo, it.rotulo));
  }
  return lista;
}

/** Mensagens recentes (30 dias) que a pessoa vê, por conversa, e o total de não lidas. */
async function recentesDe(a: AcessoTenant, desde?: Date) {
  const limite = desde ?? new Date(Date.now() - DIAS_RECENTES * 86_400_000);
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({
        dealId: mensagem.dealId,
        numero: deal.numero,
        codinome: deal.codinome,
        alvoTipo: mensagem.alvoTipo,
        alvoId: mensagem.alvoId,
        canal: mensagem.canal,
        autorId: mensagem.autorId,
        autor: usuario.name,
        texto: mensagem.texto,
        criadoEm: mensagem.criadoEm,
      })
      .from(mensagem)
      .innerJoin(deal, eq(deal.id, mensagem.dealId))
      .leftJoin(usuario, eq(usuario.id, mensagem.autorId))
      .where(gte(mensagem.criadoEm, limite))
      .orderBy(desc(mensagem.criadoEm))
      .limit(3000),
  );
  const porNegocio = new Map<string, typeof linhas>();
  for (const l of linhas) porNegocio.set(l.dealId, [...(porNegocio.get(l.dealId) ?? []), l]);
  const visiveis: ((typeof linhas)[number] & {
    rotulo: string;
    canalNaTela: Omit<CanalNaTela, "naoLidas">;
  })[] = [];
  for (const [dealId, doNegocio] of porNegocio) {
    const ctx: Ctx | null = await contextoSemErro(a, dealId);
    if (!ctx) continue;
    for (const l of doNegocio) {
      const canal = ctx.canais.find((c) => c.id === l.canal);
      if (!canal) continue;
      const it = await ctx.item({ tipo: l.alvoTipo, id: l.alvoId });
      if (it) visiveis.push({ ...l, rotulo: it.rotulo, canalNaTela: canal });
    }
  }
  const leituras = await leiturasDe(a, [
    ...new Set(visiveis.map((m) => chaveDaConversa({ tipo: m.alvoTipo, id: m.alvoId }, m.canal))),
  ]);
  return visiveis.map((m) => ({
    ...m,
    chave: `${m.dealId}|${chaveDaConversa({ tipo: m.alvoTipo, id: m.alvoId }, m.canal)}`,
    naoLida: naoLida(a, m, leituras.get(chaveDaConversa({ tipo: m.alvoTipo, id: m.alvoId }, m.canal))),
  }));
}

/** Últimas conversas com mensagens (tela principal e página de mensagens) e o total de não lidas. */
export async function minhasMensagens(
  acesso: Acesso | null,
  limite = 10,
): Promise<{ conversas: MensagemRecente[]; naoLidas: number }> {
  const a = exigirTenant(acesso);
  const lista = await recentesDe(a);
  const conversas = new Map<string, MensagemRecente>();
  for (const m of lista) {
    const atual = conversas.get(m.chave);
    if (atual) {
      if (m.naoLida) atual.naoLidas++;
      continue;
    }
    const alvo: Alvo = { tipo: m.alvoTipo, id: m.alvoId };
    conversas.set(m.chave, {
      dealId: m.dealId,
      negocio: nomeVisivel(m.numero, m.codinome),
      alvo,
      rotulo: m.rotulo,
      canal: { ...m.canalNaTela, naoLidas: 0 },
      autor: m.autor,
      trecho: m.texto.length > 140 ? `${m.texto.slice(0, 140)}…` : m.texto,
      em: m.criadoEm.toISOString(),
      naoLidas: m.naoLida ? 1 : 0,
      link: linkDaConversa(m.dealId, alvo, m.canal),
    });
  }
  return {
    conversas: [...conversas.values()].slice(0, limite),
    naoLidas: lista.filter((m) => m.naoLida).length,
  };
}

// --- Resumo por e-mail (M2) ---------------------------------------------------------------

export async function obterHorasDoResumo(acesso: Acesso | null): Promise<number> {
  const a = exigirTenant(acesso);
  const [c] = await banco()
    .select({ horas: tenant.horasResumoMensagens })
    .from(tenant)
    .where(eq(tenant.id, a.tenant.id));
  return c?.horas ?? 1;
}

/** Intervalo do resumo de mensagens por e-mail (administradores): 1 a 72 horas. */
export async function salvarHorasDoResumo(
  acesso: Acesso | null,
  texto: string,
): Promise<{ ok: true } | ErroDeServico> {
  const a = exigirAdministrador(acesso);
  const horas = Number(texto.trim());
  if (!Number.isInteger(horas) || horas < 1 || horas > 72)
    return { erro: "mensagens.erros.horasInvalidas", campo: "horasResumo" };
  await banco().update(tenant).set({ horasResumoMensagens: horas }).where(eq(tenant.id, a.tenant.id));
  await auditar(a, "tenant.configuracoes_alteradas", "tenant", a.tenant.id, { horasResumoMensagens: horas });
  return { ok: true };
}

export async function obterMeuResumo(acesso: Acesso | null): Promise<boolean> {
  const a = exigirTenant(acesso);
  const [v] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ resumo: vinculoTenant.resumoMensagens })
      .from(vinculoTenant)
      .where(and(eq(vinculoTenant.tenantId, a.tenant.id), eq(vinculoTenant.usuarioId, a.usuario.id))),
  );
  return v?.resumo ?? true;
}

/** Cada pessoa liga ou desliga o próprio resumo de mensagens por e-mail. */
export async function definirMeuResumo(acesso: Acesso | null, ligado: boolean): Promise<{ ok: true }> {
  const a = exigirTenant(acesso);
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(vinculoTenant)
      .set({ resumoMensagens: ligado })
      .where(and(eq(vinculoTenant.tenantId, a.tenant.id), eq(vinculoTenant.usuarioId, a.usuario.id))),
  );
  return { ok: true };
}

/**
 * Resumo de mensagens novas (não lidas) por e-mail, no máximo uma vez a cada
 * intervalo do tenant: "5 mensagens novas em 2 negócios", sem o texto delas.
 */
export async function enviarResumosDeMensagens(agora = new Date()): Promise<number> {
  const tenants = await banco()
    .select({ id: tenant.id, slug: tenant.slug, horas: tenant.horasResumoMensagens })
    .from(tenant);
  let enviados = 0;
  for (const t of tenants) {
    const devidos = await comTenant(t.id, async (tx) => {
      const temMensagens = await tx
        .select({ id: mensagem.id })
        .from(mensagem)
        .where(gte(mensagem.criadoEm, new Date(agora.getTime() - 72 * 3_600_000)))
        .limit(1);
      if (temMensagens.length === 0) return [];
      return tx
        .select({
          usuarioId: vinculoTenant.usuarioId,
          administrador: vinculoTenant.administrador,
          ultimo: vinculoTenant.resumoMensagensEm,
          nome: usuario.name,
          email: usuario.email,
        })
        .from(vinculoTenant)
        .innerJoin(usuario, eq(usuario.id, vinculoTenant.usuarioId))
        .where(
          and(
            eq(vinculoTenant.tenantId, t.id),
            eq(vinculoTenant.situacao, "ativo"),
            eq(vinculoTenant.resumoMensagens, true),
            sql`(${vinculoTenant.resumoMensagensEm} is null or ${vinculoTenant.resumoMensagensEm} <= ${new Date(
              agora.getTime() - t.horas * 3_600_000 + 60_000,
            )})`,
          ),
        );
    });
    if (devidos.length === 0) continue;
    const dadosDoTenant = await tenantPorSlug(t.slug);
    if (!dadosDoTenant) continue;
    const [tr, marca] = await Promise.all([tradutor(), marcaParaEmail(t.id)]);
    for (const u of devidos) {
      const a: AcessoTenant = {
        area: "tenant",
        tenant: dadosDoTenant,
        usuario: {
          id: u.usuarioId,
          nome: u.nome,
          email: u.email,
          temAutenticador: false,
          temPasskey: false,
          doisFatoresAtivo: false,
        },
        administrador: u.administrador,
        exigeDoisFatores: false,
        sessaoId: "",
        segundoFatorNaSessao: false,
      };
      const desde = u.ultimo ?? new Date(agora.getTime() - t.horas * 3_600_000);
      const novas = (await recentesDe(a, desde)).filter((m) => m.naoLida);
      await comTenant(t.id, (tx) =>
        tx
          .update(vinculoTenant)
          .set({ resumoMensagensEm: agora })
          .where(and(eq(vinculoTenant.tenantId, t.id), eq(vinculoTenant.usuarioId, u.usuarioId))),
      );
      if (novas.length === 0) continue;
      const p = { quantidade: novas.length, negocios: new Set(novas.map((m) => m.dealId)).size };
      try {
        await enviarEmail(
          montarEmail({
            para: u.email,
            assunto: tr("emails.mensagens.assunto", p),
            saudacao: tr("emails.saudacao", { nome: u.nome }),
            paragrafos: [tr("emails.mensagens.paragrafo", p), tr("emails.mensagens.comoDesligar")],
            link: {
              texto: tr("emails.mensagens.botao"),
              url: urlDaArea({ tipo: "tenant", slug: t.slug }, "/mensagens"),
            },
            linkAlternativo: tr("emails.linkAlternativo"),
            marca,
          }),
        );
        enviados++;
      } catch {
        // Sem log do destinatário nem do conteúdo (ADR-0007).
      }
    }
  }
  return enviados;
}

/** Negócio tem mensagens (a exclusão do negócio só vale sem elas). */
export async function negocioTemMensagens(a: AcessoTenant, dealId: string): Promise<boolean> {
  const l = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: mensagem.id }).from(mensagem).where(eq(mensagem.dealId, dealId)).limit(1),
  );
  return l.length > 0;
}

/** Totais para o título da aba Mensagens: mensagens que a pessoa vê e quantas não leu. */
export async function totaisDeMensagens(
  acesso: Acesso | null,
  dealId: string,
): Promise<{ total: number; novas: number } | null> {
  const lista = await conversasDoNegocio(acesso, dealId);
  if (!lista) return null;
  return {
    total: lista.reduce((s, c) => s + c.total, 0),
    novas: lista.reduce((s, c) => s + c.naoLidas, 0),
  };
}
