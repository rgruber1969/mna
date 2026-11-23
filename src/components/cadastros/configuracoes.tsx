"use client";

import { Fragment, useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  excluirPapelAcao,
  excluirTipoDeVinculoAcao,
  salvarPapelAcao,
  salvarTipoDeVinculoAcao,
} from "@/app/acoes/cadastros";
import { excluirTipoDeOperacaoAcao, salvarTipoDeOperacaoAcao } from "@/app/acoes/negocios";
import { excluirCategoriaAcao, salvarCategoriaAcao } from "@/app/acoes/documentos";
import {
  definirEtapaPadraoAtivaAcao,
  excluirEtapaPadraoAcao,
  moverEtapaPadraoAcao,
  reordenarEtapasPadraoAcao,
  salvarEtapaPadraoAcao,
} from "@/app/acoes/etapas";
import { BotaoDeAcao, useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, estiloTabela } from "@/components/ui/basicos";
import { AlcaDeArrastar, useOrdenacao } from "@/components/ui/ordenacao";

/**
 * Tabelas das Configurações (cadastros auxiliares): uma linha por registro,
 * com os campos editáveis e as ações em colunas. Cada linha é um formulário
 * próprio (os campos apontam para ele pelo atributo `form`); a última linha
 * de cada tabela inclui um registro novo ("Adicionar").
 */

type Acao = Parameters<typeof useAcaoComAtualizacao>[0];
const campo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-2 py-1 text-sm outline-none";
const botao =
  "border-primary text-primary rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-60";

/** Formulário invisível da linha + mensagem de erro dela. */
function useLinha(acao: Acao) {
  const id = useId();
  const [estado, enviar, enviando] = useAcaoComAtualizacao(acao);
  const form = (ocultos: Record<string, string>) => (
    <form id={id} action={enviar} className="hidden">
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </form>
  );
  return { id, estado, enviando, form };
}

function Tabela({ colunas, children }: { colunas: string[]; children: ReactNode }) {
  return (
    <div className="-mx-2 mb-6 overflow-x-auto">
      <table className={estiloTabela.tabela}>
        <thead className={estiloTabela.cabecalho}>
          <tr>
            {colunas.map((c, i) => (
              <th key={i} className={estiloTabela.th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Erro({ estado }: { estado?: { erro?: string } }) {
  return estado?.erro ? (
    <tr>
      <td colSpan={9} className="px-2">
        <Aviso>{estado.erro}</Aviso>
      </td>
    </tr>
  ) : null;
}

// --- Papéis de empresa (agrupados por lado) --------------------------------------------

type Papel = { id: string; nome: string; perfilSugeridoId: string | null; lado: string | null };

function LinhaPapel({
  papel,
  perfis,
  podeEditar,
  podeExcluir,
  lado,
}: {
  papel?: Papel;
  perfis: { id: string; nome: string }[];
  podeEditar: boolean;
  podeExcluir: boolean;
  lado: string;
}) {
  const t = useTranslations("configuracoes");
  const tc = useTranslations("comum");
  const l = useLinha(salvarPapelAcao);
  const editavel = papel ? podeEditar : true;
  return (
    <>
      <tr className={estiloTabela.linha}>
        <td className={estiloTabela.td}>
          {l.form(papel ? { id: papel.id } : {})}
          <input
            form={l.id}
            name="nome"
            required
            maxLength={120}
            defaultValue={papel?.nome}
            placeholder={papel ? undefined : t("novoPapel")}
            disabled={!editavel}
            aria-label={papel ? t("nomeDe", { nome: papel.nome }) : t("novoPapel")}
            className={campo}
          />
        </td>
        <td className={estiloTabela.td}>
          <select
            form={l.id}
            name="perfilSugeridoId"
            defaultValue={papel?.perfilSugeridoId ?? ""}
            disabled={!editavel}
            aria-label={t("perfilSugerido")}
            className={campo}
          >
            <option value="">{t("semPerfil")}</option>
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </td>
        <td className={estiloTabela.td}>
          <select
            form={l.id}
            name="lado"
            defaultValue={papel?.lado ?? lado}
            disabled={!editavel}
            aria-label={t("lado")}
            className={campo}
          >
            <option value="">{t("semLado")}</option>
            <option value="vendedor">{t("ladoVendedor")}</option>
            <option value="comprador">{t("ladoComprador")}</option>
          </select>
        </td>
        <td className={`${estiloTabela.td} whitespace-nowrap`}>
          <span className="flex gap-2">
            {editavel && (
              <button form={l.id} type="submit" disabled={l.enviando} className={botao}>
                {papel ? tc("salvar") : t("adicionar")}
              </button>
            )}
            {papel && podeExcluir && (
              <BotaoDeAcao
                acao={excluirPapelAcao}
                campos={{ id: papel.id }}
                rotulo={tc("excluir")}
                confirmar={t("confirmarExcluir", { nome: papel.nome })}
                perigo
              />
            )}
          </span>
        </td>
      </tr>
      <Erro estado={l.estado} />
    </>
  );
}

export function TabelaDePapeis({
  papeis,
  perfis,
  podeCriar,
  podeEditar,
  podeExcluir,
}: {
  papeis: Papel[];
  perfis: { id: string; nome: string }[];
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const t = useTranslations("configuracoes");
  const grupos = [
    { lado: "vendedor", titulo: t("ladoVendedor") },
    { lado: "comprador", titulo: t("ladoComprador") },
    { lado: "", titulo: t("semLado") },
  ];
  const [lado, setLado] = useState("vendedor");
  const doGrupo = papeis.filter((p) => (p.lado ?? "") === lado);
  return (
    <div>
      <p className="text-muted mb-3 text-sm">{t("papeisExplicacao")}</p>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label={t("lado")}>
        {grupos.map((g) => {
          const n = papeis.filter((p) => (p.lado ?? "") === g.lado).length;
          return (
            <button
              key={g.lado}
              type="button"
              role="tab"
              aria-selected={lado === g.lado}
              onClick={() => setLado(g.lado)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${lado === g.lado ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted"}`}
            >
              {g.titulo} ({n})
            </button>
          );
        })}
      </div>
      <Tabela colunas={[t("nome"), t("perfilSugerido"), t("lado"), t("acoes")]}>
        {doGrupo.map((p) => (
          <LinhaPapel
            key={p.id}
            papel={p}
            perfis={perfis}
            podeEditar={podeEditar}
            podeExcluir={podeExcluir}
            lado={lado}
          />
        ))}
        {podeCriar && (
          <LinhaPapel key={`novo-${lado}`} perfis={perfis} podeEditar podeExcluir={false} lado={lado} />
        )}
      </Tabela>
    </div>
  );
}

// --- Tipos com "pede percentual" (vínculo e operação) --------------------------------------

type Tipo = { id: string; nome: string; comPercentual: boolean; emUso: number };

function LinhaTipo({
  tipo,
  salvar,
  excluir,
  podeEditar,
  podeExcluir,
  rotuloNovo,
  semPercentual = false,
}: {
  semPercentual?: boolean;
  tipo?: Tipo;
  salvar: Acao;
  excluir: Acao;
  podeEditar: boolean;
  podeExcluir: boolean;
  rotuloNovo: string;
}) {
  const t = useTranslations("configuracoes");
  const tc = useTranslations("comum");
  const l = useLinha(salvar);
  const editavel = tipo ? podeEditar : true;
  return (
    <>
      <tr className={estiloTabela.linha}>
        <td className={estiloTabela.td}>
          {l.form(tipo ? { id: tipo.id } : {})}
          <input
            form={l.id}
            name="nome"
            required
            maxLength={120}
            defaultValue={tipo?.nome}
            placeholder={tipo ? undefined : rotuloNovo}
            disabled={!editavel}
            aria-label={tipo ? t("nomeDe", { nome: tipo.nome }) : rotuloNovo}
            className={campo}
          />
        </td>
        {!semPercentual && (
          <td className={`${estiloTabela.td} text-center`}>
            <input
              form={l.id}
              type="checkbox"
              name="comPercentual"
              value="sim"
              defaultChecked={tipo?.comPercentual}
              disabled={!editavel}
              aria-label={t("pedePercentual")}
            />
          </td>
        )}
        <td className={`${estiloTabela.td} text-muted text-xs`}>{tipo ? t("uso", { n: tipo.emUso }) : ""}</td>
        <td className={`${estiloTabela.td} whitespace-nowrap`}>
          <span className="flex gap-2">
            {editavel && (
              <button form={l.id} type="submit" disabled={l.enviando} className={botao}>
                {tipo ? tc("salvar") : t("adicionar")}
              </button>
            )}
            {tipo && podeExcluir && tipo.emUso === 0 && (
              <BotaoDeAcao
                acao={excluir}
                campos={{ id: tipo.id }}
                rotulo={tc("excluir")}
                confirmar={t("confirmarExcluir", { nome: tipo.nome })}
                perigo
              />
            )}
          </span>
        </td>
      </tr>
      <Erro estado={l.estado} />
    </>
  );
}

export function TabelaDeTipos({
  tipos,
  qual,
  podeCriar,
  podeEditar,
  podeExcluir,
}: {
  tipos: Tipo[];
  qual: "vinculo" | "operacao" | "categoria";
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const t = useTranslations("configuracoes");
  const [salvar, excluir] =
    qual === "vinculo"
      ? [salvarTipoDeVinculoAcao, excluirTipoDeVinculoAcao]
      : qual === "operacao"
        ? [salvarTipoDeOperacaoAcao, excluirTipoDeOperacaoAcao]
        : [salvarCategoriaAcao, excluirCategoriaAcao];
  const novo =
    qual === "vinculo" ? t("novoVinculo") : qual === "operacao" ? t("novaOperacao") : t("novaCategoria");
  const semPercentual = qual === "categoria";
  return (
    <div>
      <p className="text-muted mb-3 text-sm">
        {qual === "vinculo"
          ? t("vinculosExplicacao")
          : qual === "operacao"
            ? t("operacoesExplicacao")
            : t("categoriasExplicacao")}
      </p>
      <Tabela
        colunas={
          semPercentual
            ? [t("nome"), t("emUso"), t("acoes")]
            : [t("nome"), t("pedePercentual"), t("emUso"), t("acoes")]
        }
      >
        {tipos.map((x) => (
          <LinhaTipo
            key={x.id}
            tipo={x}
            salvar={salvar}
            excluir={excluir}
            podeEditar={podeEditar}
            podeExcluir={podeExcluir}
            rotuloNovo={novo}
            semPercentual={semPercentual}
          />
        ))}
        {podeCriar && (
          <LinhaTipo
            salvar={salvar}
            excluir={excluir}
            podeEditar
            podeExcluir={false}
            rotuloNovo={novo}
            semPercentual={semPercentual}
          />
        )}
      </Tabela>
    </div>
  );
}

// --- Etapas padrão ------------------------------------------------------------------------

type EtapaPadrao = { id: string; nome: string; ativa: boolean; escala: number; subetapas: EtapaPadrao[] };

function LinhaEtapa({
  etapa,
  paiId,
  sub,
  podeEditar,
  podeExcluir,
  novo,
  arrastar,
}: {
  etapa?: EtapaPadrao;
  paiId?: string;
  sub?: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  novo?: string;
  arrastar?: { linha: object; alca: { onPointerDown: () => void; onPointerUp: () => void } };
}) {
  const t = useTranslations("configuracoes");
  const te = useTranslations("etapas.padrao");
  const tc = useTranslations("comum");
  const l = useLinha(salvarEtapaPadraoAcao);
  const editavel = etapa ? podeEditar : true;
  return (
    <>
      <tr
        {...arrastar?.linha}
        className={`${estiloTabela.linha} ${etapa && !etapa.ativa ? "opacity-60" : ""} data-[arrastando=sim]:opacity-40`}
      >
        <td className={`${estiloTabela.td} ${sub ? "pl-8" : ""}`}>
          {l.form({ ...(etapa ? { id: etapa.id } : {}), ...(paiId ? { paiId } : {}) })}
          <span className="flex items-center gap-1.5">
            {arrastar && etapa && podeEditar ? (
              <AlcaDeArrastar rotulo={te("arrastar", { nome: etapa.nome })} {...arrastar.alca} />
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <input
              form={l.id}
              name="nome"
              required
              maxLength={120}
              defaultValue={etapa?.nome}
              placeholder={etapa ? undefined : novo}
              disabled={!editavel}
              aria-label={etapa ? te("nomeDe", { nome: etapa.nome }) : novo}
              className={campo}
            />
          </span>
        </td>
        <td className={estiloTabela.td}>
          {!sub && (
            <input
              form={l.id}
              type="number"
              name="escala"
              min={5}
              max={100}
              defaultValue={etapa?.escala ?? 100}
              disabled={!editavel}
              aria-label={t("escala")}
              className={`${campo} w-20`}
            />
          )}
        </td>
        <td className={`${estiloTabela.td} text-xs`}>
          {etapa ? (etapa.ativa ? t("ativa") : te("desativada")) : ""}
        </td>
        <td className={`${estiloTabela.td} whitespace-nowrap`}>
          <span className="flex flex-wrap gap-2">
            {editavel && (
              <button form={l.id} type="submit" disabled={l.enviando} className={botao}>
                {etapa ? tc("salvar") : t("adicionar")}
              </button>
            )}
            {etapa && podeEditar && (
              <>
                <BotaoDeAcao
                  acao={moverEtapaPadraoAcao}
                  campos={{ id: etapa.id, direcao: "subir" }}
                  rotulo="↑"
                />
                <BotaoDeAcao
                  acao={moverEtapaPadraoAcao}
                  campos={{ id: etapa.id, direcao: "descer" }}
                  rotulo="↓"
                />
                <BotaoDeAcao
                  acao={definirEtapaPadraoAtivaAcao}
                  campos={{ id: etapa.id, ativa: etapa.ativa ? "nao" : "sim" }}
                  rotulo={etapa.ativa ? te("desativar") : te("reativar")}
                />
              </>
            )}
            {etapa && podeExcluir && (
              <BotaoDeAcao
                acao={excluirEtapaPadraoAcao}
                campos={{ id: etapa.id }}
                rotulo={tc("excluir")}
                confirmar={t("confirmarExcluirEtapa", { nome: etapa.nome })}
                perigo
              />
            )}
          </span>
        </td>
      </tr>
      <Erro estado={l.estado} />
    </>
  );
}

/** Subetapas de uma etapa padrão, que se reordenam arrastando (só entre elas). */
function SubetapasArrastaveis({
  pai,
  podeEditar,
  podeExcluir,
}: {
  pai: EtapaPadrao;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const { lista, linha, alca } = useOrdenacao(pai.subetapas, (ids) =>
    iniciar(async () => {
      await reordenarEtapasPadraoAcao(pai.id, ids);
      router.refresh();
    }),
  );
  return (
    <>
      {lista.map((s) => (
        <LinhaEtapa
          key={s.id}
          etapa={s}
          sub
          podeEditar={podeEditar}
          podeExcluir={podeExcluir}
          arrastar={{ linha: linha(s.id), alca: alca(s.id) }}
        />
      ))}
    </>
  );
}

export function TabelaDeEtapas({
  etapas,
  podeCriar,
  podeEditar,
  podeExcluir,
}: {
  etapas: EtapaPadrao[];
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const t = useTranslations("configuracoes");
  const te = useTranslations("etapas.padrao");
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const { lista, linha, alca } = useOrdenacao(etapas, (ids) =>
    iniciar(async () => {
      const r = await reordenarEtapasPadraoAcao(null, ids);
      setErro(r.erro ?? null);
      router.refresh();
    }),
  );
  return (
    <div>
      <p className="text-muted mb-3 text-sm">
        {te("explicacao")} {t("escalaExplicacao")} {te("arrasteExplicacao")}
      </p>
      {erro && <Aviso>{erro}</Aviso>}
      <Tabela colunas={[t("nome"), t("escala"), t("situacao"), t("acoes")]}>
        {lista.map((e) => (
          <Fragment key={e.id}>
            <LinhaEtapa
              etapa={e}
              podeEditar={podeEditar}
              podeExcluir={podeExcluir}
              arrastar={{ linha: linha(e.id), alca: alca(e.id) }}
            />
            <SubetapasArrastaveis pai={e} podeEditar={podeEditar} podeExcluir={podeExcluir} />
            {podeCriar && (
              <LinhaEtapa
                key={`${e.id}-nova`}
                paiId={e.id}
                sub
                podeEditar
                podeExcluir={false}
                novo={t("novaSubetapaDe", { nome: e.nome })}
              />
            )}
          </Fragment>
        ))}
        {podeCriar && <LinhaEtapa podeEditar podeExcluir={false} novo={te("novaEtapa")} />}
      </Tabela>
    </div>
  );
}
