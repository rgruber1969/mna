import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  boolean,
  check,
  customType,
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
  type AnyPgColumn,
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
  /** Retenção da auditoria, em meses, definida pela RGRUBER no console (padrão 60 = 5 anos). */
  retencaoAuditoriaMeses: integer("retencao_auditoria_meses").notNull().default(60),
  /** Modo de permissões do tenant (ADR-0013, elemento 5). */
  modoPermissoes: text("modo_permissoes").$type<"perfil" | "usuario">().notNull().default("perfil"),
  // Identidade visual (white label, ADR-0010), editada pelo administrador do
  // tenant. Vazio = padrão RGRUBER. Imagens: chaves no armazenamento (PNG).
  nomeExibicao: text("nome_exibicao"),
  corPrimaria: text("cor_primaria"),
  /** Cor secundária (tom da mesma família da primária; nome antigo da coluna: "destaque"). */
  corDestaque: text("cor_destaque"),
  /** Cor de destaque (acento do 2 + 1): só o botão principal de cada tela; matiz oposto à primária. */
  corAcento: text("cor_acento"),
  fonte: text("fonte"),
  /** Tamanho base do texto em px (14 a 18); vazio = 16, o padrão. Escala toda a interface. */
  tamanhoFonte: integer("tamanho_fonte"),
  logoClaro: text("logo_claro"),
  logoEscuro: text("logo_escuro"),
  icone: text("icone"),
  /** Configurações gerais do tenant: dias de antecedência dos avisos de fim da exclusividade. */
  diasAvisoExclusividade: jsonb("dias_aviso_exclusividade").$type<number[]>().notNull().default([15, 5]),
  /** Dias antes do prazo para lembrar os responsáveis por uma tarefa (0 = no dia). */
  diasLembreteTarefa: jsonb("dias_lembrete_tarefa").$type<number[]>().notNull().default([2, 0]),
  /** Painel principal: dias antes do vencimento em que um prazo fica amarelo (semáforo). */
  diasAvisoPrazo: integer("dias_aviso_prazo").notNull().default(7),
  /** Intervalo, em horas, do resumo de mensagens novas por e-mail (M2). */
  horasResumoMensagens: integer("horas_resumo_mensagens").notNull().default(1),
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
  /** Menu lateral no tema oposto ao da tela. */
  menuInvertido: boolean("menu_invertido").notNull().default(false),
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
    /** Recebe o resumo de mensagens novas por e-mail (cada pessoa pode desligar; M2). */
    resumoMensagens: boolean("resumo_mensagens").notNull().default(true),
    /** Quando saiu o último resumo (as mensagens depois disso entram no próximo). */
    resumoMensagensEm: timestamp("resumo_mensagens_em", { withTimezone: true }),
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
    /** E-mail do setor financeiro (dados para nota fiscal e cobrança dos contratos, C3). */
    emailFinanceiro: text("email_financeiro"),
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
    /** Critério do rateio do preço entre as vendedoras (ex.: faturamento), O4. */
    criterioRateio: text("criterio_rateio"),
    valorEstimado: numeric("valor_estimado", { precision: 18, scale: 2 }),
    descricao: text("descricao"),
    situacao: text("situacao")
      .$type<"andamento" | "suspenso" | "concluido" | "encerrado">()
      .notNull()
      .default("andamento"),
    motivoEncerramento: text("motivo_encerramento"),
    encerradoEm: timestamp("encerrado_em", { withTimezone: true }),
    /** Exclusividade com a compradora escolhida (dominio.md). */
    exclusividadeEmpresaId: uuid("exclusividade_empresa_id").references(() => empresa.id, {
      onDelete: "no action",
    }),
    exclusividadeInicio: date("exclusividade_inicio"),
    exclusividadeFim: date("exclusividade_fim"),
    /** Avisos de prazo já enviados (chave "tipo:data"), para não repetir. */
    avisosEnviados: jsonb("avisos_enviados").$type<string[]>().notNull().default([]),
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
    /** Observações sobre a compradora no funil (cartão do kanban; lado vendedor). */
    observacoes: text("observacoes"),
    /** Vendedora: percentual no rateio do preço entre as vendedoras (O4). */
    percentualRateio: numeric("percentual_rateio", { precision: 7, scale: 4 }),
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
    alcance: text("alcance").$type<"deal" | "etapas">().notNull().default("deal"),
    /** Alcance "etapas": as etapas ou subetapas a que a participação dá acesso. */
    etapaIds: jsonb("etapa_ids").$type<string[]>().notNull().default([]),
    /** Último dia de acesso (opcional). */
    prazo: date("prazo"),
    /**
     * Acesso cortado (compradora descartada ou acessos externos encerrados):
     * quando e o prazo de antes, para devolver se a compradora voltar.
     */
    cortadaEm: timestamp("cortada_em", { withTimezone: true }),
    prazoAntesDoCorte: date("prazo_antes_do_corte"),
    motivoDoCorte: text("motivo_do_corte").$type<"descarte" | "externos">(),
    /** O coordenador já foi avisado do vencimento do prazo. */
    vencimentoAvisado: boolean("vencimento_avisado").notNull().default(false),
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

/** Prorrogações do período de exclusividade (histórico). */
export const prorrogacaoExclusividade = pgTable(
  "prorrogacao_exclusividade",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    fimAnterior: date("fim_anterior").notNull(),
    novoFim: date("novo_fim").notNull(),
    motivo: text("motivo"),
    criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [index("prorrogacao_exclusividade_deal_idx").on(t.tenantId, t.dealId), isolamento()],
).enableRLS();

// --- Etapas (itens 9 e 10; dominio.md, "Etapas"; respostas E1–E7) -----------

/**
 * Etapa padrão do tenant (cadastro auxiliar), copiada para cada negócio novo.
 * `paiId` preenchido = subetapa padrão (um nível só).
 */
export const etapaPadrao = pgTable(
  "etapa_padrao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    paiId: uuid("pai_id"),
    nome: text("nome").notNull(),
    ordem: integer("ordem").notNull(),
    ativa: boolean("ativa").notNull().default(true),
    /** Escala da etapa na linha do tempo (100 = tamanho real; ex.: 20 para o pós-closing, que dura anos). */
    escala: integer("escala").notNull().default(100),
    padrao: text("padrao"),
    criadoEm: criadoEm(),
  },
  (t) => [index("etapa_padrao_tenant_idx").on(t.tenantId, t.paiId, t.ordem), isolamento()],
).enableRLS();

/** Etapa (ou subetapa, com `paiId`) de um negócio, adaptável por negócio. */
export const dealEtapa = pgTable(
  "deal_etapa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    paiId: uuid("pai_id"),
    /** Etapa padrão de origem (para agrupar negócios por etapa no kanban). */
    etapaPadraoId: uuid("etapa_padrao_id"),
    nome: text("nome").notNull(),
    ordem: integer("ordem").notNull(),
    /** Escala na linha do tempo (copiada da etapa padrão; 100 = real). */
    escala: integer("escala").notNull().default(100),
    situacao: text("situacao")
      .$type<"nao_iniciada" | "andamento" | "concluida" | "pulada">()
      .notNull()
      .default("nao_iniciada"),
    inicioPrevisto: date("inicio_previsto"),
    fimPrevisto: date("fim_previsto"),
    inicioReal: date("inicio_real"),
    fimReal: date("fim_real"),
    /** Etapa que deveria terminar antes (só avisa; não bloqueia). */
    dependeDeId: uuid("depende_de_id"),
    /** Responsáveis (pessoas) da subetapa. */
    responsaveis: jsonb("responsaveis").$type<string[]>().notNull().default([]),
    observacoes: text("observacoes"),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("deal_etapa_deal_idx").on(t.tenantId, t.dealId, t.paiId, t.ordem), isolamento()],
).enableRLS();

// --- Data room (item 11; dominio.md, "Documentos"; respostas D1–D8) --------

/** Categoria de documento (cadastro auxiliar do tenant). */
export const categoriaDocumento = pgTable(
  "categoria_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    nome: text("nome").notNull(),
    padrao: text("padrao"),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("categoria_documento_nome_uq").on(t.tenantId, t.nome), isolamento()],
).enableRLS();

/** Documento do negócio (entidade com versões); `etapaId` vazio = geral (vale para o negócio todo). */
export const documento = pgTable(
  "documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    etapaId: uuid("etapa_id").references(() => dealEtapa.id, { onDelete: "set null" }),
    categoriaId: uuid("categoria_id").references(() => categoriaDocumento.id, { onDelete: "set null" }),
    titulo: text("titulo").notNull(),
    criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("documento_deal_idx").on(t.tenantId, t.dealId, t.etapaId), isolamento()],
).enableRLS();

/**
 * Versão de um documento: o arquivo vai direto do navegador ao armazenamento
 * (link temporário) e só fica "disponível" depois da verificação (ADR-0016).
 */
export const documentoVersao = pgTable(
  "documento_versao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => documento.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    nomeArquivo: text("nome_arquivo").notNull(),
    tipoDeConteudo: text("tipo_de_conteudo"),
    tamanho: bigint("tamanho", { mode: "number" }).notNull(),
    chave: text("chave").notNull(),
    /** enviando, disponivel ou bloqueado. */
    situacao: text("situacao").$type<"enviando" | "disponivel" | "bloqueado">().notNull().default("enviando"),
    comentario: text("comentario"),
    /** Visível a todos os participantes do negócio (os dois lados, inclusive quem entrar depois). */
    todos: boolean("todos").notNull().default(false),
    enviadoPor: uuid("enviado_por").references(() => usuario.id, { onDelete: "set null" }),
    /** Alguém além de quem enviou já baixou (depois disso a versão não pode ser excluída). */
    baixadaPorOutros: boolean("baixada_por_outros").notNull().default(false),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("documento_versao_uq").on(t.tenantId, t.documentoId, t.numero), isolamento()],
).enableRLS();

/** Lista de acesso de uma versão: por perfil e/ou usuário (quem enviou e administradores sempre veem). */
export const versaoAcesso = pgTable(
  "versao_acesso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    versaoId: uuid("versao_id")
      .notNull()
      .references(() => documentoVersao.id, { onDelete: "cascade" }),
    perfilId: uuid("perfil_id").references(() => perfil.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuario.id, { onDelete: "cascade" }),
  },
  (t) => [
    check("versao_acesso_alvo_ck", sql`(perfil_id is null) <> (usuario_id is null)`),
    index("versao_acesso_versao_idx").on(t.tenantId, t.versaoId),
    isolamento(),
  ],
).enableRLS();

// --- Tarefas (item 27; dominio.md, "Tarefas e pendências"; respostas T1–T5) ---

/** Tarefa de um negócio (opcionalmente de uma etapa ou subetapa). */
export const tarefa = pgTable(
  "tarefa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    etapaId: uuid("etapa_id").references(() => dealEtapa.id, { onDelete: "set null" }),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    /** baixa, normal, alta ou urgente (só para ordenar e filtrar). */
    prioridade: text("prioridade")
      .$type<"baixa" | "normal" | "alta" | "urgente">()
      .notNull()
      .default("normal"),
    prazo: date("prazo"),
    situacao: text("situacao")
      .$type<"a_fazer" | "andamento" | "aguardando" | "concluida" | "cancelada">()
      .notNull()
      .default("a_fazer"),
    /** Lado de quem criou: a tarefa é vista por esse lado, pelos responsáveis e pelos administradores. */
    lado: text("lado").$type<"vendedor" | "comprador">(),
    /** Lado comprador: a compradora de quem criou (as outras compradoras nunca veem a tarefa). */
    compradoraId: uuid("compradora_id").references(() => empresa.id, { onDelete: "set null" }),
    concluidaPor: uuid("concluida_por").references(() => usuario.id, { onDelete: "set null" }),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
    /** Gerada por gatilho automático (simulado na V1). */
    automatica: boolean("automatica").notNull().default(false),
    lembretesEnviados: jsonb("lembretes_enviados").$type<string[]>().notNull().default([]),
    criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("tarefa_deal_idx").on(t.tenantId, t.dealId, t.situacao), isolamento()],
).enableRLS();

/** Responsável pela tarefa: um usuário ou um perfil (todos com aquele perfil no negócio). */
export const tarefaResponsavel = pgTable(
  "tarefa_responsavel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefa.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuario.id, { onDelete: "cascade" }),
    perfilId: uuid("perfil_id").references(() => perfil.id, { onDelete: "cascade" }),
  },
  (t) => [
    check("tarefa_responsavel_alvo_ck", sql`(usuario_id is null) <> (perfil_id is null)`),
    index("tarefa_responsavel_tarefa_idx").on(t.tenantId, t.tarefaId),
    isolamento(),
  ],
).enableRLS();

/** Item do checklist da tarefa. */
export const tarefaItem = pgTable(
  "tarefa_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefa.id, { onDelete: "cascade" }),
    texto: text("texto").notNull(),
    feito: boolean("feito").notNull().default(false),
    ordem: integer("ordem").notNull(),
  },
  (t) => [index("tarefa_item_tarefa_idx").on(t.tenantId, t.tarefaId), isolamento()],
).enableRLS();

/** Documento do data room ligado à tarefa. */
export const tarefaDocumento = pgTable(
  "tarefa_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefa.id, { onDelete: "cascade" }),
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => documento.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("tarefa_documento_uq").on(t.tenantId, t.tarefaId, t.documentoId), isolamento()],
).enableRLS();

/**
 * Mensagem de uma conversa (item 16; dominio.md, "Mensageria e avisos").
 * Conversa = negócio (geral), etapa, versão de documento ou tarefa, em um
 * canal: "vendedor" (equipe do lado vendedor), "equipe:<compradora>" (equipe
 * de uma compradora) ou "entre:<compradora>" (lado vendedor e aquela
 * compradora, depois do NDA). Imutável: o banco só permite incluir e ligar
 * a uma tarefa (GRANT por coluna na migração).
 */
export const mensagem = pgTable(
  "mensagem",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    alvoTipo: text("alvo_tipo").$type<"deal" | "etapa" | "versao" | "tarefa">().notNull(),
    /** Etapa, versão ou tarefa (vazio na conversa geral do negócio). */
    alvoId: uuid("alvo_id"),
    canal: text("canal").notNull(),
    autorId: uuid("autor_id").references(() => usuario.id, { onDelete: "set null" }),
    texto: text("texto").notNull(),
    /** Usuários mencionados (@pessoa). */
    mencoes: jsonb("mencoes").$type<string[]>().notNull().default([]),
    /** Tarefa criada a partir da mensagem ("marcar como tarefa"). */
    tarefaId: uuid("tarefa_id").references(() => tarefa.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("mensagem_conversa_idx").on(t.tenantId, t.dealId, t.alvoTipo, t.alvoId, t.canal, t.criadoEm),
    index("mensagem_recentes_idx").on(t.tenantId, t.criadoEm),
    isolamento(),
  ],
).enableRLS();

/** Até quando a pessoa leu cada conversa (para as não lidas). */
export const mensagemLeitura = pgTable(
  "mensagem_leitura",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    /** "<alvoTipo>:<alvoId ou ->:<canal>". */
    chave: text("chave").notNull(),
    lidaEm: timestamp("lida_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mensagem_leitura_uq").on(t.tenantId, t.usuarioId, t.chave), isolamento()],
).enableRLS();

/** Vetor da busca textual do PostgreSQL (ADR-0022). */
const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

/**
 * Texto extraído de uma versão do data room para a busca por conteúdo
 * (ADR-0022). Mesma proteção dos arquivos; nunca vai para logs.
 */
export const documentoTexto = pgTable(
  "documento_texto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    versaoId: uuid("versao_id")
      .notNull()
      .references(() => documentoVersao.id, { onDelete: "cascade" }),
    texto: text("texto").notNull(),
    /** to_tsvector('portuguese', unaccent(texto)), gravado junto com o texto. */
    busca: tsvector("busca").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex("documento_texto_versao_uq").on(t.tenantId, t.versaoId),
    index("documento_texto_busca_idx").using("gin", t.busca),
    isolamento(),
  ],
).enableRLS();

/**
 * Chave de API (ADR-0013, regra 11; autenticacao-e-sessao.md): gerada só por
 * administradores; age como um usuário de serviço do tenant, com perfil
 * próprio. O segredo é mostrado uma vez; aqui fica só o hash.
 */
export const chaveApi = pgTable(
  "chave_api",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    nome: text("nome").notNull(),
    /** Começo visível do segredo, para reconhecer a chave na lista. */
    prefixo: text("prefixo").notNull(),
    hash: text("hash").notNull(),
    /** Usuário de serviço da chave (com vínculo, perfil e pessoa no tenant). */
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    expiraEm: date("expira_em"),
    ultimoUsoEm: timestamp("ultimo_uso_em", { withTimezone: true }),
    revogadaEm: timestamp("revogada_em", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("chave_api_hash_uq").on(t.hash),
    index("chave_api_tenant_idx").on(t.tenantId),
    isolamento(),
  ],
).enableRLS();

/**
 * Anexo de mensagem (item 16): enviado antes da mensagem (direto ao
 * armazenamento, com antivírus) e ligado a ela no envio; depois disso não
 * muda (a mensagem é imutável). Pode virar documento do negócio.
 */
export const mensagemAnexo = pgTable(
  "mensagem_anexo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    mensagemId: uuid("mensagem_id").references(() => mensagem.id, { onDelete: "cascade" }),
    nomeArquivo: text("nome_arquivo").notNull(),
    tamanho: bigint("tamanho", { mode: "number" }).notNull(),
    tipoDeConteudo: text("tipo_de_conteudo"),
    chave: text("chave").notNull(),
    situacao: text("situacao").$type<"enviando" | "disponivel" | "bloqueado">().notNull().default("enviando"),
    enviadoPor: uuid("enviado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [index("mensagem_anexo_mensagem_idx").on(t.tenantId, t.mensagemId), isolamento()],
).enableRLS();

// --- Contratos de serviço (item 17; dominio.md, "Contrato de serviço"; C1–C4) ---

/**
 * Contrato de prestação de serviço (mandato do advisor, honorários
 * advocatícios, outros). Pode nascer avulso (sem negócio) e ser ligado a um
 * negócio depois (C2).
 */
export const contrato = pgTable(
  "contrato",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id").references(() => deal.id, { onDelete: "set null" }),
    /** mandato, honorarios ou outro. */
    tipo: text("tipo").$type<"mandato" | "honorarios" | "outro">().notNull(),
    titulo: text("titulo").notNull(),
    objeto: text("objeto"),
    dataAssinatura: date("data_assinatura"),
    inicio: date("inicio"),
    fim: date("fim"),
    exclusivo: boolean("exclusivo").notNull().default(false),
    exclusividadeAte: date("exclusividade_ate"),
    /** Honorários fixos (retainer): valor por período. */
    honorarioFixo: numeric("honorario_fixo", { precision: 18, scale: 2 }),
    periodicidade: text("periodicidade").$type<"unico" | "mensal" | "trimestral" | "semestral" | "anual">(),
    /** Os honorários fixos pagos são descontados do success fee (C1). */
    retainerDescontado: boolean("retainer_descontado").notNull().default(false),
    /**
     * Honorários variáveis apurados mês a mês (combináveis com os fixos): por horas
     * trabalhadas (valor-hora), por percentual sobre uma base ou outro critério descrito.
     */
    honorarioVariavel: boolean("honorario_variavel").notNull().default(false),
    variavelCriterio: text("variavel_criterio").$type<"horas" | "percentual" | "outro">(),
    variavelValorHora: numeric("variavel_valor_hora", { precision: 18, scale: 2 }),
    variavelPercentual: numeric("variavel_percentual", { precision: 7, scale: 4 }),
    /** Base do percentual ou descrição do critério ("outro"). */
    variavelBase: text("variavel_base"),
    /** Limite mensal opcional dos variáveis. */
    variavelTeto: numeric("variavel_teto", { precision: 18, scale: 2 }),
    /** Dia do mês do fechamento da apuração (1 a 28). */
    variavelDiaApuracao: integer("variavel_dia_apuracao"),
    successFeePercentual: numeric("success_fee_percentual", { precision: 7, scale: 4 }),
    successFeeMinimo: numeric("success_fee_minimo", { precision: 18, scale: 2 }),
    formaPagamento: text("forma_pagamento"),
    /** Conta da contratada para o pagamento (cadastro de contas da empresa). */
    contaBancariaId: uuid("conta_bancaria_id").references(() => contaBancaria.id, { onDelete: "set null" }),
    /** Como a contratada recebe: na conta (agência e conta) ou pela chave PIX da mesma conta. */
    meioRecebimento: text("meio_recebimento").$type<"conta" | "pix">().notNull().default("conta"),
    observacoes: text("observacoes"),
    criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
    financeiroAvisadoEm: timestamp("financeiro_avisado_em", { withTimezone: true }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("contrato_deal_idx").on(t.tenantId, t.dealId), isolamento()],
).enableRLS();

/** Partes do contrato: uma ou mais contratantes e contratadas (C1). */
export const contratoParte = pgTable(
  "contrato_parte",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    contratoId: uuid("contrato_id")
      .notNull()
      .references(() => contrato.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id),
    papel: text("papel").$type<"contratante" | "contratada">().notNull(),
  },
  (t) => [uniqueIndex("contrato_parte_uq").on(t.tenantId, t.contratoId, t.empresaId, t.papel), isolamento()],
).enableRLS();

/** Quem vê o contrato: perfis (do negócio) e/ou usuários; quem criou e administradores sempre veem. */
export const contratoAcesso = pgTable(
  "contrato_acesso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    contratoId: uuid("contrato_id")
      .notNull()
      .references(() => contrato.id, { onDelete: "cascade" }),
    perfilId: uuid("perfil_id").references(() => perfil.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuario.id, { onDelete: "cascade" }),
  },
  (t) => [
    check("contrato_acesso_alvo_ck", sql`(perfil_id is null) <> (usuario_id is null)`),
    index("contrato_acesso_contrato_idx").on(t.tenantId, t.contratoId),
    isolamento(),
  ],
).enableRLS();

/** Arquivos do contrato, em versões (como os documentos): conferidos e só então disponíveis. */
export const contratoArquivo = pgTable(
  "contrato_arquivo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    contratoId: uuid("contrato_id")
      .notNull()
      .references(() => contrato.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    nomeArquivo: text("nome_arquivo").notNull(),
    tamanho: bigint("tamanho", { mode: "number" }).notNull(),
    tipoDeConteudo: text("tipo_de_conteudo"),
    chave: text("chave").notNull(),
    situacao: text("situacao").$type<"enviando" | "disponivel" | "bloqueado">().notNull().default("enviando"),
    comentario: text("comentario"),
    enviadoPor: uuid("enviado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("contrato_arquivo_uq").on(t.tenantId, t.contratoId, t.numero), isolamento()],
).enableRLS();

// --- Ofertas recebidas (item 32; dominio.md, "Ofertas"; O1–O4) ---

/** Parcela a prazo de uma oferta. */
export type ParcelaDaOferta = { valor: string; data: string };
/** Percentual de cada vendedora no rateio de uma oferta (O4). */
export type RateioDaOferta = { empresaId: string; percentual: string };

/**
 * Oferta de uma compradora; uma contraproposta é outra oferta ligada à
 * anterior (O2, rodadas).
 */
export const oferta = pgTable(
  "oferta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    compradoraId: uuid("compradora_id")
      .notNull()
      .references(() => empresa.id),
    anteriorId: uuid("anterior_id").references((): AnyPgColumn => oferta.id, { onDelete: "set null" }),
    rodada: integer("rodada").notNull().default(1),
    data: date("data").notNull(),
    /** informal, term_sheet, loi ou mou. */
    instrumento: text("instrumento").$type<"informal" | "term_sheet" | "loi" | "mou">().notNull(),
    enterpriseValue: numeric("enterprise_value", { precision: 18, scale: 2 }),
    equityValue: numeric("equity_value", { precision: 18, scale: 2 }),
    parcelaVista: numeric("parcela_vista", { precision: 18, scale: 2 }),
    parcelas: jsonb("parcelas").$type<ParcelaDaOferta[]>().notNull().default([]),
    earnout: text("earnout"),
    earnoutValor: numeric("earnout_valor", { precision: 18, scale: 2 }),
    retencao: text("retencao"),
    retencaoValor: numeric("retencao_valor", { precision: 18, scale: 2 }),
    condicoesPrecedentes: text("condicoes_precedentes"),
    validade: date("validade"),
    garantiasCompradora: text("garantias_compradora"),
    garantiasVendedora: text("garantias_vendedora"),
    correcaoParcelas: text("correcao_parcelas"),
    condicoesTransicao: text("condicoes_transicao"),
    exclusividade: text("exclusividade"),
    naoConcorrencia: text("nao_concorrencia"),
    observacoes: text("observacoes"),
    /** Rateio próprio desta oferta (vazio: o do negócio), com o critério. */
    rateio: jsonb("rateio").$type<RateioDaOferta[]>().notNull().default([]),
    criterioRateio: text("criterio_rateio"),
    criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("oferta_deal_idx").on(t.tenantId, t.dealId, t.compradoraId), isolamento()],
).enableRLS();

/** Quem vê a oferta: perfis do negócio e/ou usuários; quem registrou e administradores sempre veem. */
export const ofertaAcesso = pgTable(
  "oferta_acesso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    ofertaId: uuid("oferta_id")
      .notNull()
      .references(() => oferta.id, { onDelete: "cascade" }),
    perfilId: uuid("perfil_id").references(() => perfil.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuario.id, { onDelete: "cascade" }),
  },
  (t) => [
    check("oferta_acesso_alvo_ck", sql`(perfil_id is null) <> (usuario_id is null)`),
    index("oferta_acesso_oferta_idx").on(t.tenantId, t.ofertaId),
    isolamento(),
  ],
).enableRLS();

/** Arquivos da oferta (Term Sheet, LOI etc.), conferidos antes de liberar. */
export const ofertaArquivo = pgTable(
  "oferta_arquivo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: doTenant(),
    ofertaId: uuid("oferta_id")
      .notNull()
      .references(() => oferta.id, { onDelete: "cascade" }),
    nomeArquivo: text("nome_arquivo").notNull(),
    tamanho: bigint("tamanho", { mode: "number" }).notNull(),
    tipoDeConteudo: text("tipo_de_conteudo"),
    chave: text("chave").notNull(),
    situacao: text("situacao").$type<"enviando" | "disponivel" | "bloqueado">().notNull().default("enviando"),
    enviadoPor: uuid("enviado_por").references(() => usuario.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [index("oferta_arquivo_oferta_idx").on(t.tenantId, t.ofertaId), isolamento()],
).enableRLS();
