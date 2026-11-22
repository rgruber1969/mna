"use client";

import { useId, useEffect, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  adicionarParticipacaoAcao,
  adicionarVinculoAcao,
  cadastrarSocioAcao,
  consultarCepAcao,
  consultarCnpjAcao,
  criarGrupoAcao,
  revelarDadosSensiveisAcao,
  salvarEmpresaAcao,
  salvarPessoaAcao,
  type EstadoEmpresa,
} from "@/app/acoes/cadastros";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { PainelDeAba, SoNasAbas, useAbas } from "@/components/ui/abas";
import { Aviso, Botao } from "@/components/ui/basicos";
import { cepValido, cnpjValido, formatarCep, formatarCnpj, soDigitos } from "@/config/documentos";

type Valores = Record<string, string>;

const estiloCampo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

function Campo({
  rotulo,
  nome,
  valores,
  mudar,
  ajuda,
  className = "",
  ...props
}: {
  rotulo: string;
  nome: string;
  valores: Valores;
  mudar: (nome: string, valor: string) => void;
  ajuda?: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"input">, "name" | "value" | "onChange">) {
  const idAjuda = useId();
  return (
    <div className={`mb-3 ${className}`}>
      <label className="block">
        <span className="text-text mb-1 block text-sm font-medium">{rotulo}</span>
        <input
          {...props}
          name={nome}
          value={valores[nome] ?? ""}
          onChange={(e) => mudar(nome, e.target.value)}
          aria-describedby={ajuda ? idAjuda : undefined}
          className={estiloCampo}
        />
      </label>
      {ajuda && (
        <span id={idAjuda} className="text-muted mt-1 block text-xs">
          {ajuda}
        </span>
      )}
    </div>
  );
}

/** Abre a aba do campo apontado pelo servidor (erro de validação). */
function useCampoComErro(estado: { campo?: string } | undefined) {
  const abas = useAbas();
  useEffect(() => {
    if (estado?.campo) abas?.revelarCampo(estado.campo);
  }, [estado, abas]);
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="border-border mb-4 border-t pt-3">
      <legend className="text-accent pr-2 text-xs font-semibold tracking-widest uppercase">{titulo}</legend>
      <div className="grid gap-x-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Mensagem({ estado }: { estado?: { erro?: string; ok?: string } }) {
  if (estado?.erro) return <Aviso>{estado.erro}</Aviso>;
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return null;
}

/** Campos de endereço; o CEP preenche o restante (ViaCEP / BrasilAPI pelo servidor). */
function CamposDeEndereco({
  valores,
  mudar,
}: {
  valores: Valores;
  mudar: (nome: string, valor: string) => void;
}) {
  const t = useTranslations("cadastros.formularios");
  const [buscando, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  function buscarCep(cep: string) {
    if (!cepValido(cep)) return;
    iniciar(async () => {
      const e = await consultarCepAcao(cep);
      if (!e) return setAviso(t("cepNaoEncontrado"));
      setAviso(null);
      for (const [k, v] of Object.entries(e)) if (v && k !== "cep") mudar(k, v);
      mudar("cep", formatarCep(e.cep));
    });
  }
  return (
    <Secao titulo={t("endereco")}>
      <Campo
        rotulo={t("cep")}
        nome="cep"
        valores={valores}
        mudar={(n, v) => {
          mudar(n, v);
          if (soDigitos(v).length === 8) buscarCep(v);
        }}
        inputMode="numeric"
        ajuda={buscando ? t("buscandoEndereco") : (aviso ?? t("cepAjuda"))}
      />
      <Campo
        rotulo={t("pais")}
        nome="pais"
        valores={valores}
        mudar={mudar}
        placeholder={t("paisPlaceholder")}
      />
      <Campo
        rotulo={t("logradouro")}
        nome="logradouro"
        valores={valores}
        mudar={mudar}
        className="sm:col-span-2"
      />
      <Campo rotulo={t("numero")} nome="numero" valores={valores} mudar={mudar} />
      <Campo rotulo={t("complemento")} nome="complemento" valores={valores} mudar={mudar} />
      <Campo rotulo={t("bairro")} nome="bairro" valores={valores} mudar={mudar} />
      <Campo rotulo={t("cidade")} nome="cidade" valores={valores} mudar={mudar} />
      <Campo rotulo={t("uf")} nome="uf" valores={valores} mudar={mudar} maxLength={2} />
    </Secao>
  );
}

function useValores(inicial: Valores) {
  const [valores, setValores] = useState<Valores>(inicial);
  const mudar = (nome: string, valor: string) => setValores((v) => ({ ...v, [nome]: valor }));
  return [valores, mudar] as const;
}

// --- Empresa ---------------------------------------------------------------------------

export function FormEmpresa({
  id,
  inicial,
  grupos,
  podeSalvar,
}: {
  id?: string;
  inicial: Valores;
  grupos: { id: string; nome: string }[];
  podeSalvar: boolean;
}) {
  const t = useTranslations("cadastros.formularios");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarEmpresaAcao);
  const parecida = (estado as EstadoEmpresa)?.parecida;
  useCampoComErro(estado);
  const [valores, mudar] = useValores(inicial);
  const [buscando, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  function buscarCnpj() {
    if (!cnpjValido(valores.cnpj ?? "")) return setAviso(t("cnpjInvalido"));
    iniciar(async () => {
      const d = await consultarCnpjAcao(valores.cnpj);
      if (!d) return setAviso(t("cnpjIndisponivel"));
      setAviso(t("receitaPreenchida", { n: d.socios.length }));
      mudar("cnpj", formatarCnpj(valores.cnpj));
      const campos: Valores = {
        razaoSocial: d.razaoSocial,
        nomeFantasia: d.nomeFantasia,
        cnae: d.cnae,
        telefone: d.telefone,
        email: d.email,
        numero: d.numero,
        ...d.endereco,
        cep: d.endereco.cep ? formatarCep(d.endereco.cep) : "",
      };
      for (const [k, v] of Object.entries(campos)) if (v) mudar(k, v);
    });
  }

  return (
    <form action={salvar}>
      {id && <input type="hidden" name="id" value={id} />}
      {parecida ? (
        <div
          role="alert"
          className="border-warning bg-warning-surface mb-4 rounded-md border px-3 py-3 text-sm"
        >
          <p className="text-text mb-2">{estado?.erro}</p>
          <input type="hidden" name="parecidaId" value={parecida.id} />
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" name="decisao" value="completar" disabled={salvando}>
              {t("completarExistente", { nome: parecida.nome })}
            </Botao>
            <button
              type="submit"
              name="decisao"
              value="criar"
              disabled={salvando}
              className="border-border text-text rounded-md border px-3 py-2 text-sm font-medium"
            >
              {t("criarOutra")}
            </button>
          </div>
        </div>
      ) : (
        <Mensagem estado={estado} />
      )}
      <fieldset disabled={!podeSalvar}>
        <PainelDeAba id="dados">
          <Secao titulo={t("identificacao")}>
            <div className="sm:col-span-2">
              <span className="text-text mb-1 block text-sm font-medium">{t("cnpj")}</span>
              <div className="mb-1 flex gap-2">
                <input
                  name="cnpj"
                  aria-label={t("cnpj")}
                  value={valores.cnpj ?? ""}
                  onChange={(e) => mudar("cnpj", e.target.value)}
                  inputMode="numeric"
                  className={estiloCampo}
                />
                <button
                  type="button"
                  onClick={buscarCnpj}
                  disabled={buscando}
                  className="border-border text-primary shrink-0 rounded-md border px-3 text-sm font-medium"
                >
                  {buscando ? t("buscando") : t("buscarDados")}
                </button>
              </div>
              <span className="text-muted mb-3 block text-xs">{aviso ?? t("cnpjAjuda")}</span>
            </div>
            <Campo
              rotulo={t("razaoSocial")}
              nome="razaoSocial"
              valores={valores}
              mudar={mudar}
              required
              className="sm:col-span-2"
            />
            <Campo rotulo={t("nomeFantasia")} nome="nomeFantasia" valores={valores} mudar={mudar} />
            <Campo
              rotulo={t("identificadorEstrangeiro")}
              nome="identificadorEstrangeiro"
              valores={valores}
              mudar={mudar}
            />
            <Campo rotulo={t("cnae")} nome="cnae" valores={valores} mudar={mudar} className="sm:col-span-2" />
            <label className="mb-3 block sm:col-span-2">
              <span className="text-text mb-1 block text-sm font-medium">{t("grupoEconomico")}</span>
              <select
                name="grupoId"
                value={valores.grupoId ?? ""}
                onChange={(e) => mudar("grupoId", e.target.value)}
                className={estiloCampo}
              >
                <option value="">{t("nenhum")}</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </label>
          </Secao>
        </PainelDeAba>
        <PainelDeAba id="endereco">
          <CamposDeEndereco valores={valores} mudar={mudar} />
        </PainelDeAba>
        <PainelDeAba id="dados">
          <Secao titulo={t("contato")}>
            <Campo rotulo={t("telefone")} nome="telefone" valores={valores} mudar={mudar} />
            <Campo rotulo={t("emailGeral")} nome="email" valores={valores} mudar={mudar} type="email" />
            <Campo
              rotulo={t("emailFinanceiro")}
              nome="emailFinanceiro"
              valores={valores}
              mudar={mudar}
              type="email"
            />
            <Campo rotulo={t("site")} nome="site" valores={valores} mudar={mudar} className="sm:col-span-2" />
          </Secao>
          <label className="mb-4 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("observacoes")}</span>
            <textarea
              name="observacoes"
              value={valores.observacoes ?? ""}
              onChange={(e) => mudar("observacoes", e.target.value)}
              rows={3}
              className={estiloCampo}
            />
          </label>
        </PainelDeAba>
        {podeSalvar && (
          <SoNasAbas ids={["dados", "endereco"]}>
            <Botao type="submit" disabled={salvando}>
              {salvando ? t("salvando") : id ? t("salvarEmpresa") : t("cadastrarEmpresa")}
            </Botao>
          </SoNasAbas>
        )}
      </fieldset>
    </form>
  );
}

/** Sócios do quadro societário da Receita, sugeridos como pessoas (o usuário confirma cada um). */
export function SociosDaReceita({
  empresaId,
  cnpj,
  jaCadastrados,
}: {
  empresaId: string;
  cnpj: string;
  jaCadastrados: string[];
}) {
  const t = useTranslations("cadastros.formularios");
  const [estado, cadastrar, cadastrando] = useAcaoComAtualizacao(cadastrarSocioAcao);
  const [socios, setSocios] = useState<
    { nome: string; qualificacao: string; documentoParcial: string; tipo: string }[] | null
  >(null);
  const [buscando, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const normalizar = (n: string) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const existentes = new Set(jaCadastrados.map(normalizar));
  // Sócios já ligados como pessoas ou como empresas sócias.
  return (
    <div>
      <Mensagem estado={estado} />
      {aviso && <p className="text-muted mb-3 text-sm">{aviso}</p>}
      {socios === null ? (
        <button
          type="button"
          disabled={buscando}
          onClick={() =>
            iniciar(async () => {
              const d = await consultarCnpjAcao(cnpj);
              if (!d) return setAviso(t("consultaIndisponivel"));
              setSocios(d.socios);
              setAtualizadoEm(d.sociosAtualizadosEm);
              if (d.socios.length === 0) setAviso(t("semSocios"));
            })
          }
          className="text-primary text-sm font-medium"
        >
          {buscando ? t("consultando") : t("consultarSocios")}
        </button>
      ) : (
        <ul className="divide-border divide-y text-sm">
          {socios.map((s) => (
            <li key={s.nome} className="flex items-center justify-between gap-3 py-2">
              <span>
                {s.nome}
                <span className="text-muted block text-xs">
                  {[s.qualificacao, s.tipo === "pj" && t("empresaSocia")].filter(Boolean).join(" · ")}
                </span>
              </span>
              {existentes.has(normalizar(s.nome)) ? (
                <span className="text-success text-xs font-medium">{t("jaCadastrado")}</span>
              ) : (
                <form action={cadastrar}>
                  <input type="hidden" name="empresaId" value={empresaId} />
                  <input type="hidden" name="nome" value={s.nome} />
                  <input type="hidden" name="qualificacao" value={s.qualificacao} />
                  <input type="hidden" name="tipo" value={s.tipo} />
                  <input type="hidden" name="documento" value={s.documentoParcial} />
                  <button
                    type="submit"
                    disabled={cadastrando}
                    className="text-primary text-right text-xs font-medium"
                  >
                    {s.tipo === "pj"
                      ? t("cadastrarEmpresaSocia")
                      : t("cadastrarPessoaComo", { qualificacao: s.qualificacao || t("socio") })}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {socios && socios.length > 0 && (
        <p className="text-muted mt-3 text-xs">
          {atualizadoEm
            ? t("baseDaReceitaDe", { data: atualizadoEm.split("-").reverse().join("/") })
            : t("baseDaReceita")}
        </p>
      )}
    </div>
  );
}

export function FormNovoGrupo() {
  const t = useTranslations("cadastros.formularios");
  const [estado, criar, criando] = useAcaoComAtualizacao(criarGrupoAcao);
  return (
    <form action={criar} className="mt-3">
      <Mensagem estado={estado} />
      <div className="flex gap-2">
        <input
          name="nome"
          aria-label={t("nomeDoGrupo")}
          placeholder={t("nomeDoGrupo")}
          required
          className={estiloCampo}
        />
        <button
          type="submit"
          disabled={criando}
          className="bg-primary text-primary-foreground shrink-0 rounded-md px-3 text-sm font-medium"
        >
          {t("criarGrupo")}
        </button>
      </div>
    </form>
  );
}

// --- Pessoa ----------------------------------------------------------------------------

const SENSIVEIS = ["cpf", "rg", "documentoEstrangeiro", "conjugeCpf", "conjugeRg", "conjugeRegime"] as const;

type Sensivel = (typeof SENSIVEIS)[number];

function CampoSensivel({
  campo,
  mascarado,
  valores,
  mudar,
}: {
  campo: Sensivel;
  mascarado: string | null;
  valores: Valores;
  mudar: (nome: string, valor: string) => void;
}) {
  const t = useTranslations("cadastros.formularios");
  return (
    <div className="mb-3">
      <Campo
        rotulo={t(`sensiveis.${campo}`)}
        nome={campo}
        valores={valores}
        mudar={mudar}
        className="mb-0"
        placeholder={mascarado ? t("atual", { valor: mascarado }) : ""}
        autoComplete="off"
        ajuda={mascarado ? t("manterAtual") : t("criptografadoAoSalvar")}
      />
      {mascarado && (
        <label className="text-muted mt-1 flex items-center gap-1 text-xs">
          <input type="checkbox" name="limpar" value={campo} /> {t("remover")}
        </label>
      )}
    </div>
  );
}

export function FormPessoa({
  id,
  inicial,
  mascarados,
  podeSalvar,
  emailDeLogin,
  curto = false,
}: {
  id?: string;
  inicial: Valores;
  mascarados: Partial<Record<Sensivel, string | null>>;
  podeSalvar: boolean;
  /** Pessoa com conta: o e-mail é o de login e só muda pela própria conta. */
  emailDeLogin?: boolean;
  /** Criação: só o essencial (nome, e-mail, telefone e CPF); o resto, depois, nas abas. */
  curto?: boolean;
}) {
  const t = useTranslations("cadastros.formularios");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarPessoaAcao);
  const [valores, mudar] = useValores(inicial);
  useCampoComErro(estado);
  const sensivel = (campo: Sensivel) => (
    <CampoSensivel campo={campo} mascarado={mascarados[campo] ?? null} valores={valores} mudar={mudar} />
  );
  if (curto)
    return (
      <form action={salvar}>
        <Mensagem estado={estado} />
        <p className="text-muted mb-4 text-sm">{t("criacaoCurta")}</p>
        <Secao titulo={t("dadosPessoais")}>
          <Campo
            rotulo={t("nomeCompleto")}
            nome="nome"
            valores={valores}
            mudar={mudar}
            required
            className="sm:col-span-2"
          />
          <Campo rotulo={t("email")} nome="email" valores={valores} mudar={mudar} type="email" />
          <Campo rotulo={t("telefone")} nome="telefone" valores={valores} mudar={mudar} />
          {sensivel("cpf")}
        </Secao>
        <Botao type="submit" disabled={salvando}>
          {salvando ? t("salvando") : t("cadastrarPessoa")}
        </Botao>
      </form>
    );
  return (
    <form action={salvar}>
      {id && <input type="hidden" name="id" value={id} />}
      <Mensagem estado={estado} />
      <fieldset disabled={!podeSalvar}>
        <PainelDeAba id="dados">
          <Secao titulo={t("dadosPessoais")}>
            <Campo
              rotulo={t("nomeCompleto")}
              nome="nome"
              valores={valores}
              mudar={mudar}
              required
              className="sm:col-span-2"
            />
            <Campo
              rotulo={t("email")}
              nome="email"
              valores={valores}
              mudar={mudar}
              type="email"
              readOnly={emailDeLogin}
              ajuda={emailDeLogin ? t("emailDeLogin") : undefined}
            />
            <Campo rotulo={t("telefone")} nome="telefone" valores={valores} mudar={mudar} />
            <Campo rotulo={t("nacionalidade")} nome="nacionalidade" valores={valores} mudar={mudar} />
            <Campo rotulo={t("estadoCivil")} nome="estadoCivil" valores={valores} mudar={mudar} />
            <Campo rotulo={t("profissao")} nome="profissao" valores={valores} mudar={mudar} />
            <Campo
              rotulo={t("dataNascimento")}
              nome="dataNascimento"
              valores={valores}
              mudar={mudar}
              type="date"
            />
          </Secao>
        </PainelDeAba>
        <PainelDeAba id="documentos">
          <Secao titulo={t("documentos")}>
            {sensivel("cpf")}
            {sensivel("rg")}
            <Campo rotulo={t("rgOrgao")} nome="rgOrgao" valores={valores} mudar={mudar} />
            <Campo rotulo={t("rgUf")} nome="rgUf" valores={valores} mudar={mudar} maxLength={2} />
            {sensivel("documentoEstrangeiro")}
          </Secao>
        </PainelDeAba>
        <PainelDeAba id="endereco">
          <CamposDeEndereco valores={valores} mudar={mudar} />
        </PainelDeAba>
        <PainelDeAba id="conjuge">
          <Secao titulo={t("conjuge")}>
            <Campo rotulo={t("conjugeNome")} nome="conjugeNome" valores={valores} mudar={mudar} />
            <Campo
              rotulo={t("conjugeEmail")}
              nome="conjugeEmail"
              valores={valores}
              mudar={mudar}
              type="email"
            />
            {sensivel("conjugeCpf")}
            {sensivel("conjugeRg")}
            {sensivel("conjugeRegime")}
          </Secao>
        </PainelDeAba>
        {podeSalvar && (
          <SoNasAbas ids={["dados", "documentos", "endereco", "conjuge"]}>
            <Botao type="submit" disabled={salvando}>
              {salvando ? t("salvando") : id ? t("salvarPessoa") : t("cadastrarPessoa")}
            </Botao>
          </SoNasAbas>
        )}
      </fieldset>
    </form>
  );
}

/** Mostra os dados sensíveis legíveis (auditado no servidor). */
export function MostrarDadosSensiveis({ pessoaId }: { pessoaId: string }) {
  const t = useTranslations("cadastros.formularios");
  const [dados, setDados] = useState<Record<string, string | null> | null>(null);
  const [carregando, iniciar] = useTransition();
  if (dados)
    return (
      <div
        role="region"
        aria-label={t("dadosSensiveis")}
        className="border-warning bg-warning-surface rounded-md border p-3 text-sm"
      >
        <p className="text-warning mb-2 text-xs font-medium">{t("visualizacaoRegistrada")}</p>
        <dl className="grid grid-cols-2 gap-1">
          {SENSIVEIS.map((c) => (
            <div key={c} className="contents">
              <dt className="text-muted">{t(`sensiveis.${c}`)}</dt>
              <dd className="text-text">{dados[c] ?? "—"}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => setDados(null)}
          className="text-primary mt-2 text-xs font-medium"
        >
          {t("ocultar")}
        </button>
      </div>
    );
  return (
    <button
      type="button"
      disabled={carregando}
      onClick={() => iniciar(async () => setDados(await revelarDadosSensiveisAcao(pessoaId)))}
      className="text-primary text-sm font-medium"
    >
      {carregando ? t("abrindo") : t("mostrarDadosSensiveis")}
    </button>
  );
}

export function FormNovoVinculo({
  pessoaId,
  empresaId,
  empresas,
  pessoas,
  tipos,
}: {
  pessoaId?: string;
  empresaId?: string;
  empresas?: { id: string; nome: string }[];
  pessoas?: { id: string; nome: string }[];
  tipos: { id: string; nome: string; comPercentual: boolean }[];
}) {
  const t = useTranslations("cadastros.formularios");
  const [estado, adicionar, adicionando] = useAcaoComAtualizacao(adicionarVinculoAcao);
  const [tipoId, setTipoId] = useState("");
  const comPercentual = tipos.find((t) => t.id === tipoId)?.comPercentual;
  return (
    <form action={adicionar} className="mt-3">
      <Mensagem estado={estado} />
      {pessoaId && <input type="hidden" name="pessoaId" value={pessoaId} />}
      {empresaId && <input type="hidden" name="empresaId" value={empresaId} />}
      <div className="grid gap-2 sm:grid-cols-2">
        {empresas && (
          <select name="empresaId" aria-label={t("empresa")} required className={estiloCampo} defaultValue="">
            <option value="" disabled>
              {t("empresa")}
            </option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
        {pessoas && (
          <select name="pessoaId" aria-label={t("pessoa")} required className={estiloCampo} defaultValue="">
            <option value="" disabled>
              {t("pessoa")}
            </option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        )}
        <select
          name="tipoId"
          aria-label={t("tipoDeVinculo")}
          required
          value={tipoId}
          onChange={(e) => setTipoId(e.target.value)}
          className={estiloCampo}
        >
          <option value="" disabled>
            {t("tipoDeVinculo")}
          </option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <input
          name="cargo"
          aria-label={t("cargo")}
          placeholder={t("cargoOpcional")}
          className={estiloCampo}
        />
        {comPercentual && (
          <input
            name="percentual"
            aria-label={t("percentualAria")}
            placeholder={t("percentualPlaceholder")}
            inputMode="decimal"
            className={estiloCampo}
          />
        )}
      </div>
      <button
        type="submit"
        disabled={adicionando}
        className="bg-primary text-primary-foreground mt-2 rounded-md px-3 py-1.5 text-sm font-medium"
      >
        {t("adicionarVinculo")}
      </button>
    </form>
  );
}

// --- Cadastros gerais ------------------------------------------------------------------

/** Liga uma empresa já cadastrada como sócia desta empresa. */
export function FormNovaParticipacao({
  empresaId,
  empresas,
}: {
  empresaId: string;
  empresas: { id: string; nome: string }[];
}) {
  const t = useTranslations("cadastros.participacoes");
  const [estado, adicionar, adicionando] = useAcaoComAtualizacao(adicionarParticipacaoAcao);
  return (
    <form action={adicionar} className="border-border mt-4 border-t pt-3">
      <p className="text-text mb-2 text-sm font-medium">{t("adicionarTitulo")}</p>
      <Mensagem estado={estado} />
      <input type="hidden" name="empresaId" value={empresaId} />
      <label className="mb-3 block">
        <span className="text-text mb-1 block text-sm font-medium">{t("socia")}</span>
        <select name="sociaId" required defaultValue="" className={estiloCampo}>
          <option value="" disabled />
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <label className="mb-3 block">
          <span className="text-text mb-1 block text-sm font-medium">{t("qualificacao")}</span>
          <input name="qualificacao" maxLength={120} className={estiloCampo} />
        </label>
        <label className="mb-3 block">
          <span className="text-text mb-1 block text-sm font-medium">{t("percentual")}</span>
          <input name="percentual" inputMode="decimal" className={estiloCampo} />
        </label>
      </div>
      <Botao type="submit" disabled={adicionando}>
        {t("adicionar")}
      </Botao>
    </form>
  );
}
