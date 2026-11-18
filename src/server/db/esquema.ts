import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Esquema do banco (ADR-0009, ADR-0018).
 *
 * Regras:
 * - Toda tabela de negócio tem `tenant_id` + RLS ativado e forçado, com a
 *   política `isolamento_tenant`. O teste `rls.test.ts` falha se alguma
 *   tabela com `tenant_id` ficar sem RLS.
 * - A aplicação conecta com o papel `mna_app` (sem privilégio de contornar
 *   RLS). O tenant da transação vem de `set_config('app.tenant_id', ...)`.
 * - Tabelas globais (sem `tenant_id`) são exceções documentadas aqui.
 */

/** Condição de isolamento: a linha pertence ao tenant da transação atual. */
const doTenantAtual = sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`;

// ---------------------------------------------------------------------------
// Tabelas globais (exceções sem tenant_id)
// ---------------------------------------------------------------------------

/** Tenants (contratantes). Global: administrado pelo console da RGRUBER. */
export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  /** 2FA exigido de todos os usuários do tenant (autenticacao-e-sessao.md). */
  exigeDoisFatoresDeTodos: boolean("exige_2fa_de_todos").notNull().default(false),
  /** Suspenso pela RGRUBER: ninguém entra; dados preservados (perfis-e-permissoes.md). */
  suspensoEm: timestamp("suspenso_em", { withTimezone: true }),
  /** Modo de permissões do tenant (ADR-0013, elemento 5). */
  modoPermissoes: text("modo_permissoes").$type<"perfil" | "usuario">().notNull().default("perfil"),
  // Identidade visual (white label, ADR-0010), editada pelo administrador do
  // tenant. Vazio = padrão RGRUBER. Imagens: chaves no armazenamento (PNG).
  nomeExibicao: text("nome_exibicao"),
  corPrimaria: text("cor_primaria"),
  corDestaque: text("cor_destaque"),
  fonte: text("fonte"),
  logoClaro: text("logo_claro"),
  logoEscuro: text("logo_escuro"),
  icone: text("icone"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

// --- Identidade (ADR-0005, ADR-0019) ---------------------------------------
// Tabelas do Better Auth: globais porque a conta é única na plataforma. As
// chaves das propriedades seguem os nomes exigidos pelo Better Auth; o
// acesso fica restrito a src/server/auth e à camada de serviços.

const criadoEm = () => timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();
const atualizadoEm = () => timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow();

/** Conta (Better Auth "user"). Dados pessoais: nome e e-mail. */
export const usuario = pgTable("usuario", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("nome").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verificado").notNull().default(false),
  image: text("imagem"),
  twoFactorEnabled: boolean("dois_fatores_ativo").notNull().default(false),
  /** Papel na plataforma (console). Só vale no endereço do console. */
  papelPlataforma: text("papel_plataforma"),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
});

/** Sessão (Better Auth "session"), ligada à área onde foi criada. */
export const sessao = pgTable(
  "sessao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    /** "console" ou "tenant:<id>" (ADR-0019, regra 7). */
    area: text("area").notNull(),
    /** Entrou com dois fatores (senha/link + código, ou passkey). */
    segundoFator: boolean("segundo_fator").notNull().default(false),
    expiresAt: timestamp("expira_em", { withTimezone: true }).notNull(),
    ipAddress: text("endereco_ip"),
    userAgent: text("navegador"),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [index("sessao_usuario_area_idx").on(t.userId, t.area)],
);

/** Credenciais e logins sociais (Better Auth "account"). */
export const conta = pgTable(
  "conta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    accountId: text("id_no_provedor").notNull(),
    providerId: text("provedor").notNull(),
    accessToken: text("token_acesso"),
    refreshToken: text("token_renovacao"),
    idToken: text("token_id"),
    accessTokenExpiresAt: timestamp("token_acesso_expira_em", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("token_renovacao_expira_em", { withTimezone: true }),
    scope: text("escopo"),
    password: text("senha_hash"),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [index("conta_usuario_idx").on(t.userId)],
);

/** Tokens temporários do Better Auth (ex.: link mágico, redefinição). */
export const verificacao = pgTable(
  "verificacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identificador").notNull(),
    value: text("valor").notNull(),
    expiresAt: timestamp("expira_em", { withTimezone: true }).notNull(),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [index("verificacao_identificador_idx").on(t.identifier)],
);

/** Segredo do aplicativo autenticador e códigos de recuperação. */
export const doisFatores = pgTable(
  "dois_fatores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    secret: text("segredo").notNull(),
    backupCodes: text("codigos_recuperacao").notNull(),
    verified: boolean("verificado").notNull().default(true),
    failedVerificationCount: integer("tentativas_falhas").notNull().default(0),
    lockedUntil: timestamp("bloqueado_ate", { withTimezone: true }),
  },
  (t) => [index("dois_fatores_usuario_idx").on(t.userId), index("dois_fatores_segredo_idx").on(t.secret)],
);

/** Passkeys (chaves de acesso) da conta. Só a chave pública fica no servidor. */
export const chaveDeAcesso = pgTable(
  "chave_de_acesso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    name: text("nome"),
    publicKey: text("chave_publica").notNull(),
    credentialID: text("id_credencial").notNull(),
    counter: integer("contador").notNull(),
    deviceType: text("tipo_dispositivo").notNull(),
    backedUp: boolean("com_copia").notNull(),
    transports: text("transportes"),
    aaguid: text("aaguid"),
    createdAt: timestamp("criado_em", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("chave_de_acesso_usuario_idx").on(t.userId),
    index("chave_de_acesso_credencial_idx").on(t.credentialID),
  ],
);

/** Limite de tentativas (Better Auth "rateLimit"), compartilhado entre instâncias. */
export const limiteTentativas = pgTable("limite_tentativas", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("chave").notNull().unique(),
  count: integer("contagem").notNull(),
  lastRequest: bigint("ultima_requisicao", { mode: "number" }).notNull(),
});

/** Convites para o console (usuários da plataforma). Token só como hash. */
export const convitePlataforma = pgTable("convite_plataforma", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  nome: text("nome").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  aceitoEm: timestamp("aceito_em", { withTimezone: true }),
  criadoEm: criadoEm(),
});

/** Auditoria das ações da plataforma (console). Imutável; só identificadores. */
export const eventoPlataforma = pgTable(
  "evento_plataforma",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipo: text("tipo").notNull(),
    atorId: uuid("ator_id"),
    alvoTipo: text("alvo_tipo"),
    alvoId: uuid("alvo_id"),
    detalhes: jsonb("detalhes").$type<Record<string, string | number | boolean | null>>(),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evento_plataforma_ocorrido_idx").on(t.ocorridoEm)],
);

// ---------------------------------------------------------------------------
// Tabelas de negócio (sempre com tenant_id + RLS)
// ---------------------------------------------------------------------------

/** Vínculo da conta com o tenant (ADR-0019, regra 3). */
export const vinculoTenant = pgTable(
  "vinculo_tenant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    situacao: text("situacao").$type<"ativo" | "revogado">().notNull(),
    administrador: boolean("administrador").notNull().default(false),
    /** 2FA exigido individualmente (soma-se às demais regras). */
    exigeDoisFatores: boolean("exige_2fa").notNull().default(false),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex("vinculo_tenant_usuario_uq").on(t.tenantId, t.usuarioId),
    pgPolicy("isolamento_tenant", {
      for: "all",
      to: "mna_app",
      using: doTenantAtual,
      withCheck: doTenantAtual,
    }),
  ],
).enableRLS();

/** Convite para o tenant (ADR-0019, regra 4). Token só como hash. */
export const convite = pgTable(
  "convite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    nome: text("nome").notNull(),
    administrador: boolean("administrador").notNull().default(false),
    /** Perfis do tenant atribuídos ao aceitar (identificadores de `perfil`). */
    perfis: jsonb("perfis").$type<string[]>().notNull().default([]),
    /** Marcação individual de 2FA ao aceitar (o convite vem marcado por padrão). */
    exigeDoisFatores: boolean("exige_2fa").notNull().default(true),
    tokenHash: text("token_hash").notNull().unique(),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    aceitoEm: timestamp("aceito_em", { withTimezone: true }),
    criadoPor: uuid("criado_por"),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("convite_tenant_idx").on(t.tenantId),
    pgPolicy("isolamento_tenant", {
      for: "all",
      to: "mna_app",
      using: doTenantAtual,
      withCheck: doTenantAtual,
    }),
  ],
).enableRLS();

/**
 * Trilha de auditoria (ADR-0007, docs/projeto/dados-pessoais.md).
 * Sem dados pessoais: só identificadores. Imutável: a aplicação só insere e lê.
 */
export const eventoAuditoria = pgTable(
  "evento_auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    atorId: uuid("ator_id"),
    alvoTipo: text("alvo_tipo"),
    alvoId: uuid("alvo_id"),
    detalhes: jsonb("detalhes").$type<Record<string, string | number | boolean | null>>(),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("evento_auditoria_tenant_ocorrido_idx").on(t.tenantId, t.ocorridoEm),
    pgPolicy("isolamento_tenant", {
      for: "all",
      to: "mna_app",
      using: doTenantAtual,
      withCheck: doTenantAtual,
    }),
  ],
).enableRLS();

// --- Permissões (ADR-0013; docs/projeto/perfis-e-permissoes.md) -------------

/** Matriz recurso × ações (catálogo em src/server/services/permissoes/catalogo.ts). */
type MatrizGravada = Record<string, string[]>;

/** Perfil do tenant ou de deal, sempre cadastrado no tenant. */
export const perfil = pgTable(
  "perfil",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    camada: text("camada").$type<"tenant" | "deal">().notNull(),
    nome: text("nome").notNull(),
    /** Para que serve o perfil, em linguagem simples (mostrado ao atribuir). */
    descricao: text("descricao").notNull().default(""),
    matriz: jsonb("matriz").$type<MatrizGravada>().notNull().default({}),
    /** Perfil do tenant que exige 2FA de quem o tem (soma-se às demais regras). */
    exigeDoisFatores: boolean("exige_2fa").notNull().default(false),
    /** Código do perfil padrão de origem (só informativo; o perfil é do tenant). */
    padrao: text("padrao"),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex("perfil_nome_uq").on(t.tenantId, t.camada, t.nome),
    pgPolicy("isolamento_tenant", {
      for: "all",
      to: "mna_app",
      using: doTenantAtual,
      withCheck: doTenantAtual,
    }),
  ],
).enableRLS();

/** Perfil do tenant atribuído a cada usuário (um por pessoa; os de deal ficam nas participações). */
export const perfilUsuario = pgTable(
  "perfil_usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    /** Perfil em uso não pode ser excluído ("no action": apagar o tenant inteiro continua possível). */
    perfilId: uuid("perfil_id")
      .notNull()
      .references(() => perfil.id, { onDelete: "no action" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    // Um único perfil do tenant por pessoa (decisão de 2026-11-18).
    uniqueIndex("perfil_usuario_uq").on(t.tenantId, t.usuarioId),
    pgPolicy("isolamento_tenant", {
      for: "all",
      to: "mna_app",
      using: doTenantAtual,
      withCheck: doTenantAtual,
    }),
  ],
).enableRLS();

/**
 * Matriz individual (modo "por usuário"): usuário × perfil. Guardada mesmo
 * quando o tenant volta ao modo "por perfil" (ADR-0013, adendo de 2026-11-18).
 */
export const matrizUsuario = pgTable(
  "matriz_usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    perfilId: uuid("perfil_id")
      .notNull()
      .references(() => perfil.id, { onDelete: "cascade" }),
    matriz: jsonb("matriz").$type<MatrizGravada>().notNull().default({}),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex("matriz_usuario_uq").on(t.tenantId, t.usuarioId, t.perfilId),
    pgPolicy("isolamento_tenant", {
      for: "all",
      to: "mna_app",
      using: doTenantAtual,
      withCheck: doTenantAtual,
    }),
  ],
).enableRLS();

// --- Criptografia (ADR-0007, ADR-0017) --------------------------------------

/**
 * Chave de dados de cada tenant, guardada TRANCADA pela chave mestra (cofre:
 * `.env` fora da produção, AWS KMS na produção). Nunca legível no banco.
 * Excluir o tenant apaga as chaves (destruição criptográfica).
 */
export const chaveTenant = pgTable(
  "chave_tenant",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    /** Versão da chave (rotação): gravada em cada dado criptografado. */
    versao: integer("versao").notNull(),
    /** Chave de dados trancada pela chave mestra, com a etiqueta do cofre. */
    chaveTrancada: text("chave_trancada").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex("chave_tenant_uq").on(t.tenantId, t.versao),
    pgPolicy("isolamento_tenant", {
      for: "all",
      to: "mna_app",
      using: doTenantAtual,
      withCheck: doTenantAtual,
    }),
  ],
).enableRLS();
