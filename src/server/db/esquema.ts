import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
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
  /** Tema da interface escolhido pela pessoa: claro, escuro ou igual ao sistema. */
  tema: text("tema").$type<"claro" | "escuro" | "sistema">().notNull().default("claro"),
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

// --- Empresas, papéis e pessoas (dominio.md; item 7 da V1) -----------------------

const isolamento = () =>
  pgPolicy("isolamento_tenant", {
    for: "all",
    to: "mna_app",
    using: doTenantAtual,
    withCheck: doTenantAtual,
  });

const doTenant = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" });

/** Endereço completo (empresas e pessoas); preenchível pelo CEP. */
const endereco = () => ({
  cep: text("cep"),
  logradouro: text("logradouro"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  uf: text("uf"),
  pais: text("pais").notNull().default("Brasil"),
});

/** Grupo econômico: cadastro simples, sem hierarquia na V1. */
export const grupoEconomico = pgTable(
  "grupo_economico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    nome: text("nome").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("grupo_economico_nome_uq").on(t.tenantId, t.nome), isolamento()],
).enableRLS();

/** Empresa (pessoa jurídica) do tenant. Nome e CNPJ de empresa não são dados pessoais. */
export const empresa = pgTable(
  "empresa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    /** Só dígitos; vazio em empresa estrangeira. */
    cnpj: text("cnpj"),
    /** Empresa estrangeira: identificador do país de origem. */
    identificadorEstrangeiro: text("identificador_estrangeiro"),
    razaoSocial: text("razao_social").notNull(),
    nomeFantasia: text("nome_fantasia"),
    cnae: text("cnae"),
    ...endereco(),
    site: text("site"),
    telefone: text("telefone"),
    email: text("email"),
    observacoes: text("observacoes"),
    grupoId: uuid("grupo_id").references(() => grupoEconomico.id, { onDelete: "set null" }),
    /** Empresa do próprio contratante: criada com o tenant, não pode ser excluída. */
    doContratante: boolean("do_contratante").notNull().default(false),
    inativaEm: timestamp("inativa_em", { withTimezone: true }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex("empresa_cnpj_uq")
      .on(t.tenantId, t.cnpj)
      .where(sql`cnpj is not null`),
    isolamento(),
  ],
).enableRLS();

/** Papel que uma empresa assume num deal (cadastro extensível do tenant). */
export const papelEmpresa = pgTable(
  "papel_empresa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    nome: text("nome").notNull(),
    /** Perfil de deal sugerido às pessoas da empresa com este papel. */
    perfilSugeridoId: uuid("perfil_sugerido_id").references(() => perfil.id, { onDelete: "set null" }),
    /** Lado no negócio de quem tem este papel; vazio = papel sem lado. */
    lado: text("lado").$type<"vendedor" | "comprador">(),
    padrao: text("padrao"),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("papel_empresa_nome_uq").on(t.tenantId, t.nome), isolamento()],
).enableRLS();

/** Tipo de vínculo entre pessoa e empresa (cadastro extensível do tenant). */
export const tipoVinculo = pgTable(
  "tipo_vinculo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    nome: text("nome").notNull(),
    /** Pede percentual de participação (ex.: sócio). */
    comPercentual: boolean("com_percentual").notNull().default(false),
    padrao: text("padrao"),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("tipo_vinculo_nome_uq").on(t.tenantId, t.nome), isolamento()],
).enableRLS();

/**
 * Pessoa física do tenant, com ou sem conta (dados-pessoais.md). Campos
 * terminados em "Cifrado" são sensíveis: criptografados com a chave do tenant
 * (services/cripto); o CPF tem índice cego para achar duplicidade.
 */
export const pessoa = pgTable(
  "pessoa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    nome: text("nome").notNull(),
    /** Minúsculo; único no tenant quando preenchido. */
    email: text("email"),
    telefone: text("telefone"),
    nacionalidade: text("nacionalidade"),
    estadoCivil: text("estado_civil"),
    profissao: text("profissao"),
    dataNascimento: date("data_nascimento"),
    ...endereco(),
    cpfCifrado: text("cpf_cifrado"),
    cpfIndice: text("cpf_indice"),
    rgCifrado: text("rg_cifrado"),
    rgOrgao: text("rg_orgao"),
    rgUf: text("rg_uf"),
    documentoEstrangeiroCifrado: text("documento_estrangeiro_cifrado"),
    conjugeNome: text("conjuge_nome"),
    conjugeEmail: text("conjuge_email"),
    conjugeCpfCifrado: text("conjuge_cpf_cifrado"),
    conjugeRgCifrado: text("conjuge_rg_cifrado"),
    conjugeRegimeCifrado: text("conjuge_regime_cifrado"),
    /** Conta ligada (pessoa que é usuária do tenant). */
    usuarioId: uuid("usuario_id").references(() => usuario.id, { onDelete: "set null" }),
    inativaEm: timestamp("inativa_em", { withTimezone: true }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex("pessoa_cpf_uq")
      .on(t.tenantId, t.cpfIndice)
      .where(sql`cpf_indice is not null`),
    uniqueIndex("pessoa_email_uq")
      .on(t.tenantId, t.email)
      .where(sql`email is not null`),
    uniqueIndex("pessoa_usuario_uq")
      .on(t.tenantId, t.usuarioId)
      .where(sql`usuario_id is not null`),
    isolamento(),
  ],
).enableRLS();

/** Vínculo de uma pessoa com uma empresa (pode haver vários, até com a mesma empresa). */
export const vinculoPessoaEmpresa = pgTable(
  "vinculo_pessoa_empresa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoa.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    tipoId: uuid("tipo_id")
      .notNull()
      .references(() => tipoVinculo.id),
    cargo: text("cargo"),
    percentual: numeric("percentual", { precision: 7, scale: 4 }),
    criadoEm: criadoEm(),
  },
  (t) => [index("vinculo_pessoa_empresa_empresa_idx").on(t.tenantId, t.empresaId), isolamento()],
).enableRLS();

/**
 * Participação de uma empresa no capital de outra (empresa sócia; dominio.md).
 * `empresaId` é a empresa que tem a sócia; `sociaId`, a empresa sócia.
 */
export const participacaoEmpresa = pgTable(
  "participacao_empresa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    sociaId: uuid("socia_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "cascade" }),
    qualificacao: text("qualificacao"),
    percentual: numeric("percentual", { precision: 7, scale: 4 }),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex("participacao_empresa_uq").on(t.tenantId, t.empresaId, t.sociaId),
    index("participacao_empresa_socia_idx").on(t.tenantId, t.sociaId),
    check("participacao_empresa_diferentes_ck", sql`empresa_id <> socia_id`),
    isolamento(),
  ],
).enableRLS();

/**
 * Anexo do cadastro de uma empresa ou de uma pessoa (ex.: comprovante de CNPJ,
 * contrato social, RG). O arquivo vai para o armazenamento já criptografado
 * com a chave do tenant (ADR-0017, adendo de 2026-11-19) e só é baixado pelo
 * servidor, com permissão e auditoria. O nome do arquivo pode conter dado
 * pessoal: fica criptografado também.
 */
export const anexoCadastro = pgTable(
  "anexo_cadastro",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    empresaId: uuid("empresa_id").references(() => empresa.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id").references(() => pessoa.id, { onDelete: "cascade" }),
    /** Categoria fixa (ex.: "contrato-social", "rg"); o texto vem das mensagens. */
    categoria: text("categoria").notNull(),
    descricao: text("descricao"),
    nomeArquivoCifrado: text("nome_arquivo_cifrado").notNull(),
    tipoDeConteudo: text("tipo_de_conteudo").notNull(),
    tamanho: integer("tamanho").notNull(),
    chave: text("chave").notNull(),
    /** Verificação de antivírus (ADR-0016): verificando, disponivel ou bloqueado. */
    situacao: text("situacao").notNull().default("verificando"),
    enviadoPor: uuid("enviado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    check("anexo_cadastro_alvo_ck", sql`(empresa_id is null) <> (pessoa_id is null)`),
    index("anexo_cadastro_empresa_idx").on(t.tenantId, t.empresaId),
    index("anexo_cadastro_pessoa_idx").on(t.tenantId, t.pessoaId),
    isolamento(),
  ],
).enableRLS();

/** Preferências do menu lateral de cada usuário no tenant: favoritos e recolhido. */
export const preferenciaMenu = pgTable(
  "preferencia_menu",
  {
    tenantId: doTenant(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    /** Identificadores dos itens favoritos, na ordem em que foram marcados. */
    favoritos: jsonb("favoritos").$type<string[]>().notNull().default([]),
    recolhido: boolean("recolhido").notNull().default(false),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [uniqueIndex("preferencia_menu_uq").on(t.tenantId, t.usuarioId), isolamento()],
).enableRLS();

/**
 * Notificação para um usuário no tenant (sino do cabeçalho). Guarda o tipo e
 * os parâmetros, não a frase: o texto vem dos arquivos de mensagens, no idioma
 * de quem lê (ADR-0020). Parâmetros sem dados pessoais sensíveis.
 */
export const notificacao = pgTable(
  "notificacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    parametros: jsonb("parametros").$type<Record<string, string>>().notNull().default({}),
    /** Endereço aberto ao clicar (dentro do tenant). */
    link: text("link"),
    lidaEm: timestamp("lida_em", { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [index("notificacao_usuario_idx").on(t.tenantId, t.usuarioId, t.criadoEm), isolamento()],
).enableRLS();

// --- Negócios (deals; dominio.md, "Deal (Negócio)") --------------------------

/** Tipo de operação do negócio (cadastro auxiliar do tenant). */
export const tipoOperacao = pgTable(
  "tipo_operacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    nome: text("nome").notNull(),
    /** Pede percentual (ex.: aquisição parcial). */
    comPercentual: boolean("com_percentual").notNull().default(false),
    padrao: text("padrao"),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("tipo_operacao_nome_uq").on(t.tenantId, t.nome), isolamento()],
).enableRLS();

/** Negócio (deal). Número sequencial por tenant; nas telas, "número + codinome". */
export const deal = pgTable(
  "deal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    numero: integer("numero").notNull(),
    nomeInterno: text("nome_interno").notNull(),
    codinome: text("codinome").notNull(),
    tipoOperacaoId: uuid("tipo_operacao_id").references(() => tipoOperacao.id, { onDelete: "no action" }),
    /** Percentual da operação (ex.: aquisição parcial). */
    percentual: numeric("percentual", { precision: 7, scale: 4 }),
    /** "empresas": empresas específicas; "grupo": o grupo econômico inteiro. */
    objeto: text("objeto").$type<"empresas" | "grupo">().notNull().default("empresas"),
    grupoId: uuid("grupo_id").references(() => grupoEconomico.id, { onDelete: "set null" }),
    dataInicio: date("data_inicio").notNull(),
    previsaoFechamento: date("previsao_fechamento"),
    valorEstimado: numeric("valor_estimado", { precision: 18, scale: 2 }),
    descricao: text("descricao"),
    situacao: text("situacao")
      .$type<"andamento" | "suspenso" | "concluido" | "encerrado">()
      .notNull()
      .default("andamento"),
    motivoEncerramento: text("motivo_encerramento"),
    criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [uniqueIndex("deal_numero_uq").on(t.tenantId, t.numero), isolamento()],
).enableRLS();

/** Empresa num negócio, com um papel (a mesma empresa pode ter vários papéis do mesmo lado). */
export const dealEmpresa = pgTable(
  "deal_empresa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id, { onDelete: "no action" }),
    papelId: uuid("papel_id")
      .notNull()
      .references(() => papelEmpresa.id, { onDelete: "no action" }),
    /** Situação no funil (só compradoras potenciais). */
    situacaoFunil: text("situacao_funil").$type<
      "prospectada" | "teaser" | "nda" | "proposta" | "escolhida" | "descartada"
    >(),
    /**
     * Empresa do lado comprador que não é a compradora (escritório, advisor
     * etc.): a compradora para quem trabalha. Vê o negócio como ela.
     */
    atuaParaId: uuid("atua_para_id").references(() => empresa.id, { onDelete: "no action" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex("deal_empresa_uq").on(t.tenantId, t.dealId, t.empresaId, t.papelId),
    index("deal_empresa_empresa_idx").on(t.tenantId, t.empresaId),
    isolamento(),
  ],
).enableRLS();

/**
 * Participação de uma pessoa num negócio (ADR-0013): perfil de deal (vazio =
 * contato sem acesso), empresa que representa (o lado vem do papel dela) ou
 * lado escolhido (pessoa sem empresa), alcance e prazo opcional.
 */
export const participacaoDeal = pgTable(
  "participacao_deal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoa.id, { onDelete: "no action" }),
    empresaId: uuid("empresa_id").references(() => empresa.id, { onDelete: "no action" }),
    lado: text("lado").$type<"vendedor" | "comprador">(),
    perfilId: uuid("perfil_id").references(() => perfil.id, { onDelete: "no action" }),
    /** "deal": o negócio inteiro (por etapas chega com o item 9). */
    alcance: text("alcance").$type<"deal">().notNull().default("deal"),
    /** Último dia de acesso (opcional). */
    prazo: date("prazo"),
    criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("participacao_deal_deal_idx").on(t.tenantId, t.dealId),
    index("participacao_deal_pessoa_idx").on(t.tenantId, t.pessoaId),
    isolamento(),
  ],
).enableRLS();

/**
 * Conta bancária e chave Pix de uma empresa ou pessoa (ex.: para pagamento de
 * honorários de assessores). Agência, conta e chave Pix são criptografadas com
 * a chave do tenant (dados-pessoais.md): na pessoa são dados pessoais; na
 * empresa, a mesma regra, por simplicidade. Banco (código e nome) fica legível.
 */
export const contaBancaria = pgTable(
  "conta_bancaria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    empresaId: uuid("empresa_id").references(() => empresa.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id").references(() => pessoa.id, { onDelete: "cascade" }),
    /** Código de compensação do banco (3 dígitos, ex.: "237"). */
    bancoCodigo: text("banco_codigo"),
    bancoNome: text("banco_nome"),
    agenciaCifrada: text("agencia_cifrada"),
    contaCifrada: text("conta_cifrada"),
    /** corrente, poupanca ou pagamento. */
    tipoConta: text("tipo_conta").$type<"corrente" | "poupanca" | "pagamento">(),
    chavePixCifrada: text("chave_pix_cifrada"),
    tipoChavePix: text("tipo_chave_pix").$type<"cnpj" | "cpf" | "email" | "telefone" | "aleatoria">(),
    /** Conta usada por padrão (ex.: no anexo de contas de um contrato). */
    principal: boolean("principal").notNull().default(false),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check("conta_bancaria_alvo_ck", sql`(empresa_id is null) <> (pessoa_id is null)`),
    index("conta_bancaria_empresa_idx").on(t.tenantId, t.empresaId),
    index("conta_bancaria_pessoa_idx").on(t.tenantId, t.pessoaId),
    isolamento(),
  ],
).enableRLS();
