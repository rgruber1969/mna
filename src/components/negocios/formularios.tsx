"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  adicionarEmpresaAoNegocioAcao,
  adicionarParticipanteAcao,
  criarNegocioAcao,
  editarNegocioAcao,
  salvarTipoDeOperacaoAcao,
} from "@/app/acoes/negocios";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { useAbas } from "@/components/ui/abas";
import { Aviso, Botao } from "@/components/ui/basicos";

/** Formulários dos negócios (dominio.md, "Deal (Negócio)"). */

const estiloCampo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

type Opcao = { id: string; nome: string };
type TipoOpcao = Opcao & { comPercentual: boolean };
type PapelOpcao = Opcao & { lado: "vendedor" | "comprador" | null };

function Mensagem({ estado }: { estado?: { erro?: string; ok?: string } }) {
  if (estado?.erro) return <Aviso>{estado.erro}</Aviso>;
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return null;
}

/** Erro do servidor com nome de campo: abre a aba dele. */
function useCampoComErro(estado: { campo?: string } | undefined) {
  const abas = useAbas();
  useEffect(() => {
    if (estado?.campo) abas?.revelarCampo(estado.campo);
  }, [estado, abas]);
}

/** Valores controlados (o formulário não se esvazia quando o servidor recusa). */
function useValores(inicial: Record<string, string>) {
  const [valores, setValores] = useState(inicial);
  return [valores, (nome: string, valor: string) => setValores((v) => ({ ...v, [nome]: valor }))] as const;
}

function Rotulo({
  texto,
  children,
  className = "",
}: {
  texto: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`mb-3 block ${className}`}>
      <span className="text-text mb-1 block text-sm font-medium">{texto}</span>
      {children}
    </label>
  );
}

function CampoTipo({
  tipos,
  valores,
  mudar,
  desabilitado,
}: {
  tipos: TipoOpcao[];
  valores: Record<string, string>;
  mudar: (n: string, v: string) => void;
  desabilitado?: boolean;
}) {
  const t = useTranslations("negocios.campos");
  const comPercentual = tipos.find((x) => x.id === valores.tipoOperacaoId)?.comPercentual;
  return (
    <>
      <Rotulo texto={t("tipo")}>
        <select
          name="tipoOperacaoId"
          required
          disabled={desabilitado}
          value={valores.tipoOperacaoId ?? ""}
          onChange={(e) => mudar("tipoOperacaoId", e.target.value)}
          className={estiloCampo}
        >
          <option value="" disabled />
          {tipos.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </Rotulo>
      {comPercentual && (
        <Rotulo texto={t("percentual")}>
          <input
            name="percentual"
            inputMode="decimal"
            required
            disabled={desabilitado}
            value={valores.percentual ?? ""}
            onChange={(e) => mudar("percentual", e.target.value)}
            className={estiloCampo}
          />
        </Rotulo>
      )}
    </>
  );
}

/** Criação: formulário curto; o restante fica nas abas do negócio. */
export function FormNovoNegocio({
  tipos,
  papeis,
  empresas,
  grupos,
  hoje,
}: {
  tipos: TipoOpcao[];
  papeis: PapelOpcao[];
  empresas: (Opcao & { doContratante: boolean })[];
  grupos: Opcao[];
  hoje: string;
}) {
  const t = useTranslations("negocios.campos");
  const tn = useTranslations("negocios.novo");
  const [estado, criar, criando] = useAcaoComAtualizacao(criarNegocioAcao);
  const [valores, mudar] = useValores({ objeto: "empresas", dataInicio: hoje });
  const [vendedoras, setVendedoras] = useState<string[]>([]);
  const lado = papeis.find((p) => p.id === valores.papelContratanteId)?.lado;
  return (
    <form action={criar}>
      <Mensagem estado={estado} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Rotulo texto={t("codinome")}>
          <input
            name="codinome"
            required
            maxLength={120}
            value={valores.codinome ?? ""}
            onChange={(e) => mudar("codinome", e.target.value)}
            className={estiloCampo}
          />
          <span className="text-muted mt-1 block text-xs">{t("codinomeAjuda")}</span>
        </Rotulo>
        <Rotulo texto={t("nomeInterno")}>
          <input
            name="nomeInterno"
            required
            maxLength={200}
            value={valores.nomeInterno ?? ""}
            onChange={(e) => mudar("nomeInterno", e.target.value)}
            className={estiloCampo}
          />
          <span className="text-muted mt-1 block text-xs">{t("nomeInternoAjuda")}</span>
        </Rotulo>
        <CampoTipo tipos={tipos} valores={valores} mudar={mudar} />
        <Rotulo texto={t("dataInicio")}>
          <input
            type="date"
            name="dataInicio"
            required
            value={valores.dataInicio ?? ""}
            onChange={(e) => mudar("dataInicio", e.target.value)}
            className={estiloCampo}
          />
        </Rotulo>
      </div>
      <Rotulo texto={t("papelContratante")}>
        <select
          name="papelContratanteId"
          required
          value={valores.papelContratanteId ?? ""}
          onChange={(e) => mudar("papelContratanteId", e.target.value)}
          className={estiloCampo}
        >
          <option value="" disabled />
          {papeis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <span className="text-muted mt-1 block text-xs">
          {lado
            ? t(lado === "vendedor" ? "ladoVendedorAjuda" : "ladoCompradorAjuda")
            : t("papelContratanteAjuda")}
        </span>
      </Rotulo>
      <fieldset className="border-border mb-3 border-t pt-3">
        <legend className="text-accent pr-2 text-xs font-semibold tracking-widest uppercase">
          {t("objeto")}
        </legend>
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          {(["empresas", "grupo"] as const).map((o) => (
            <label key={o} className="flex items-center gap-2">
              <input
                type="radio"
                name="objeto"
                value={o}
                checked={valores.objeto === o}
                onChange={() => mudar("objeto", o)}
              />
              {t(o === "empresas" ? "objetoEmpresas" : "objetoGrupo")}
            </label>
          ))}
        </div>
        {valores.objeto === "grupo" ? (
          <Rotulo texto={t("grupo")}>
            <select
              name="grupoId"
              required
              value={valores.grupoId ?? ""}
              onChange={(e) => mudar("grupoId", e.target.value)}
              className={estiloCampo}
            >
              <option value="" disabled />
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
            <span className="text-muted mt-1 block text-xs">{t("grupoAjuda")}</span>
          </Rotulo>
        ) : (
          <div className="mb-3">
            <span className="text-text mb-1 block text-sm font-medium">{t("vendedoras")}</span>
            <div className="border-border max-h-56 overflow-y-auto rounded-md border p-2 text-sm">
              {empresas.map((e) => (
                <label key={e.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    name="vendedoras"
                    value={e.id}
                    checked={vendedoras.includes(e.id)}
                    onChange={(ev) =>
                      setVendedoras((v) => (ev.target.checked ? [...v, e.id] : v.filter((x) => x !== e.id)))
                    }
                  />
                  {e.nome}
                </label>
              ))}
            </div>
            <span className="text-muted mt-1 block text-xs">{t("vendedorasAjuda")}</span>
          </div>
        )}
      </fieldset>
      <Botao type="submit" disabled={criando}>
        {criando ? tn("criando") : tn("criar")}
      </Botao>
    </form>
  );
}

/** Aba Resumo: dados do negócio, com um único Salvar. */
export function FormDadosDoNegocio({
  id,
  inicial,
  tipos,
  podeSalvar,
  mostraNomeInterno,
}: {
  id: string;
  inicial: Record<string, string>;
  tipos: TipoOpcao[];
  podeSalvar: boolean;
  mostraNomeInterno: boolean;
}) {
  const t = useTranslations("negocios.campos");
  const tc = useTranslations("comum");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(editarNegocioAcao);
  useCampoComErro(estado);
  const [valores, mudar] = useValores(inicial);
  const campo = (nome: string, rotulo: string, props: React.ComponentProps<"input"> = {}) => (
    <Rotulo texto={rotulo}>
      <input
        {...props}
        name={nome}
        disabled={!podeSalvar}
        value={valores[nome] ?? ""}
        onChange={(e) => mudar(nome, e.target.value)}
        className={estiloCampo}
      />
    </Rotulo>
  );
  return (
    <form action={salvar}>
      <Mensagem estado={estado} />
      <input type="hidden" name="id" value={id} />
      {!mostraNomeInterno && <input type="hidden" name="nomeInterno" value="--" />}
      <div className="grid gap-x-4 sm:grid-cols-2">
        {campo("codinome", t("codinome"), { required: true, maxLength: 120 })}
        {mostraNomeInterno && campo("nomeInterno", t("nomeInterno"), { required: true, maxLength: 200 })}
        <CampoTipo tipos={tipos} valores={valores} mudar={mudar} desabilitado={!podeSalvar} />
        {campo("dataInicio", t("dataInicio"), { type: "date", required: true })}
        {campo("previsaoFechamento", t("previsaoFechamento"), { type: "date" })}
        {campo("valorEstimado", t("valorEstimado"), { inputMode: "decimal" })}
      </div>
      <Rotulo texto={t("descricao")}>
        <textarea
          name="descricao"
          rows={4}
          maxLength={4000}
          disabled={!podeSalvar}
          value={valores.descricao ?? ""}
          onChange={(e) => mudar("descricao", e.target.value)}
          className={estiloCampo}
        />
      </Rotulo>
      {podeSalvar && (
        <div className="max-w-xs">
          <Botao type="submit" disabled={salvando}>
            {tc("salvar")}
          </Botao>
        </div>
      )}
    </form>
  );
}

export function FormIncluirEmpresa({
  dealId,
  papeis,
  empresas,
  compradoras,
}: {
  dealId: string;
  papeis: (PapelOpcao & { padrao: string | null })[];
  empresas: Opcao[];
  compradoras: { empresaId: string; nome: string }[];
}) {
  const t = useTranslations("negocios.empresas");
  const [estado, incluir, incluindo] = useAcaoComAtualizacao(adicionarEmpresaAoNegocioAcao);
  const [papelId, setPapelId] = useState("");
  const papel = papeis.find((p) => p.id === papelId);
  // Escritório, advisor etc. do lado comprador: com várias compradoras, escolhe para qual trabalha.
  const pedeCompradora =
    papel?.lado === "comprador" && papel.padrao !== "compradora" && compradoras.length > 1;
  return (
    <form action={incluir} className="border-border mt-4 max-w-md border-t pt-3">
      <p className="text-text mb-2 text-sm font-medium">{t("incluirTitulo")}</p>
      <Mensagem estado={estado} />
      <input type="hidden" name="dealId" value={dealId} />
      <Rotulo texto={t("empresa")}>
        <select name="empresaId" required defaultValue="" className={estiloCampo}>
          <option value="" disabled />
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </Rotulo>
      <Rotulo texto={t("papel")}>
        <select
          name="papelId"
          required
          value={papelId}
          onChange={(e) => setPapelId(e.target.value)}
          className={estiloCampo}
        >
          <option value="" disabled />
          {papeis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Rotulo>
      {pedeCompradora && (
        <Rotulo texto={t("atuaPara")}>
          <select name="atuaParaId" required defaultValue="" className={estiloCampo}>
            <option value="" disabled />
            {compradoras.map((c) => (
              <option key={c.empresaId} value={c.empresaId}>
                {c.nome}
              </option>
            ))}
          </select>
          <span className="text-muted mt-1 block text-xs">{t("atuaParaAjuda")}</span>
        </Rotulo>
      )}
      <Botao type="submit" disabled={incluindo}>
        {t("incluir")}
      </Botao>
    </form>
  );
}

export function FormIncluirParticipante({
  dealId,
  pessoas,
  perfis,
}: {
  dealId: string;
  pessoas: (Opcao & { temUsuario: boolean; empresas: Opcao[] })[];
  perfis: Opcao[];
}) {
  const t = useTranslations("negocios.participantes");
  const [estado, incluir, incluindo] = useAcaoComAtualizacao(adicionarParticipanteAcao);
  const [pessoaId, setPessoaId] = useState("");
  const escolhida = pessoas.find((p) => p.id === pessoaId);
  const empresas = escolhida?.empresas ?? [];
  return (
    <form action={incluir} className="border-border mt-4 max-w-md border-t pt-3">
      <p className="text-text mb-2 text-sm font-medium">{t("incluirTitulo")}</p>
      <Mensagem estado={estado} />
      <input type="hidden" name="dealId" value={dealId} />
      <Rotulo texto={t("pessoa")}>
        <select
          name="pessoaId"
          required
          value={pessoaId}
          onChange={(e) => setPessoaId(e.target.value)}
          className={estiloCampo}
        >
          <option value="" disabled />
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.temUsuario ? p.nome : `${p.nome} (${t("semUsuario")})`}
            </option>
          ))}
        </select>
      </Rotulo>
      {escolhida && !escolhida.temUsuario && <p className="text-muted mb-3 text-xs">{t("contatoAjuda")}</p>}
      {escolhida?.temUsuario && (
        <Rotulo texto={t("perfil")}>
          <select name="perfilId" required defaultValue="" className={estiloCampo}>
            <option value="" disabled />
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Rotulo>
      )}
      {escolhida && empresas.length > 1 && (
        <Rotulo texto={t("representa")}>
          <select name="empresaId" required defaultValue="" className={estiloCampo}>
            <option value="" disabled />
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </Rotulo>
      )}
      {escolhida && empresas.length === 1 && (
        <p className="text-muted mb-3 text-xs">{t("representaUnica", { empresa: empresas[0].nome })}</p>
      )}
      {escolhida && empresas.length === 0 && (
        <Rotulo texto={t("lado")}>
          <select name="lado" required defaultValue="" className={estiloCampo}>
            <option value="" disabled />
            <option value="vendedor">{t("ladoVendedor")}</option>
            <option value="comprador">{t("ladoComprador")}</option>
          </select>
          <span className="text-muted mt-1 block text-xs">{t("semEmpresaAjuda")}</span>
        </Rotulo>
      )}
      <Rotulo texto={t("prazo")}>
        <input type="date" name="prazo" className={estiloCampo} />
        <span className="text-muted mt-1 block text-xs">{t("prazoAjuda")}</span>
      </Rotulo>
      <Botao type="submit" disabled={incluindo}>
        {t("incluir")}
      </Botao>
    </form>
  );
}

/** Cadastro auxiliar: novo tipo de operação. */
export function FormNovoTipoDeOperacao() {
  const t = useTranslations("negocios.tipos");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarTipoDeOperacaoAcao);
  return (
    <form action={salvar} className="border-border mt-4 border-t pt-3">
      <Mensagem estado={estado} />
      <Rotulo texto={t("nome")}>
        <input name="nome" required maxLength={120} className={estiloCampo} />
      </Rotulo>
      <label className="text-text mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" name="comPercentual" value="sim" /> {t("comPercentual")}
      </label>
      <Botao type="submit" disabled={salvando}>
        {t("adicionar")}
      </Botao>
    </form>
  );
}
