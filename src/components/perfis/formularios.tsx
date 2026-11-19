"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  copiarMatrizIndividualAcao,
  criarPerfilAcao,
  definirPerfisDoUsuarioAcao,
  editarPerfilAcao,
  salvarMatrizDoPerfilAcao,
  salvarMatrizIndividualAcao,
} from "@/app/acoes/perfis";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, Botao, Campo, OpcoesDePerfil } from "@/components/ui/basicos";
import { ACOES, RECURSOS, type Acao, type Matriz, type Recurso } from "@/server/services/permissoes/catalogo";

const temNota = (r: Recurso): boolean => Boolean((RECURSOS[r] as { nota?: true }).nota);

/** Colunas da grade: todas as ações usadas pelos recursos mostrados. */
function colunas(recursos: Recurso[]): Acao[] {
  const usadas = new Set(recursos.flatMap((r) => RECURSOS[r].acoes));
  return ACOES.filter((a) => usadas.has(a));
}

/**
 * Grade recurso × ação. Editável (caixas "m" = "recurso:acao") ou só leitura.
 * Ações que não se aplicam ao recurso aparecem como "—".
 */
export function GradeDaMatriz({
  recursos,
  matriz,
  editavel = false,
}: {
  recursos: Recurso[];
  matriz: Matriz;
  editavel?: boolean;
}) {
  const acoes = colunas(recursos);
  const t = useTranslations("administracao.permissoes");
  return (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-2 pr-3 text-left font-medium">{t("menu")}</th>
            {acoes.map((a) => (
              <th key={a} className="px-1 py-2 text-center font-medium" title={t(`acoes.${a}`)}>
                {t(`siglas.${a}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {recursos.map((r) => (
            <tr key={r}>
              <td className="text-text py-2 pr-3">
                {t(`recursos.${r}`)}
                {temNota(r) && <span className="text-muted block text-xs">{t(`notas.${r}`)}</span>}
              </td>
              {acoes.map((a) => {
                const aplica = (RECURSOS[r].acoes as readonly Acao[]).includes(a);
                const marcado = matriz[r]?.includes(a) ?? false;
                return (
                  <td key={a} className="px-1 py-2 text-center">
                    {!aplica ? (
                      <span className="text-muted">—</span>
                    ) : editavel ? (
                      <input
                        type="checkbox"
                        name="m"
                        value={`${r}:${a}`}
                        defaultChecked={marcado}
                        aria-label={`${t(`recursos.${r}`)}: ${t(`acoes.${a}`)}`}
                      />
                    ) : marcado ? (
                      <span className="text-success" aria-label={`${t(`recursos.${r}`)}: ${t(`acoes.${a}`)}`}>
                        ✓
                      </span>
                    ) : (
                      <span className="text-muted">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted mt-2 text-xs">
        {acoes
          .map((a) => t("legenda", { sigla: t(`siglas.${a}`), acao: t(`acoes.${a}`).toLowerCase() }))
          .join(" · ")}
      </p>
    </div>
  );
}

export function FormMatrizDoPerfil({
  id,
  recursos,
  matriz,
}: {
  id: string;
  recursos: Recurso[];
  matriz: Matriz;
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(salvarMatrizDoPerfilAcao);
  const t = useTranslations("administracao.perfis.formulario");
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={id} />
      <GradeDaMatriz recursos={recursos} matriz={matriz} editavel />
      <Botao disabled={enviando}>{enviando ? t("salvando") : t("salvarPermissoes")}</Botao>
    </form>
  );
}

export function FormMatrizIndividual({
  usuarioId,
  perfilId,
  recursos,
  matriz,
}: {
  usuarioId: string;
  perfilId: string;
  recursos: Recurso[];
  matriz: Matriz;
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(salvarMatrizIndividualAcao);
  const t = useTranslations("administracao.perfis.formulario");
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={usuarioId} />
      <input type="hidden" name="perfil" value={perfilId} />
      <GradeDaMatriz recursos={recursos} matriz={matriz} editavel />
      <Botao disabled={enviando}>{enviando ? t("salvando") : t("salvarPermissoesDoUsuario")}</Botao>
    </form>
  );
}

export function FormCopiarMatriz({
  usuarioId,
  perfilId,
  outros,
}: {
  usuarioId: string;
  perfilId: string;
  outros: { id: string; nome: string }[];
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(copiarMatrizIndividualAcao);
  const t = useTranslations("administracao.perfis.formulario");
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={usuarioId} />
      <input type="hidden" name="perfil" value={perfilId} />
      <label className="mb-4 block">
        <span className="text-text mb-1 block text-sm font-medium">{t("copiarDe")}</span>
        <select
          name="origem"
          defaultValue="perfil"
          className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="perfil">{t("matrizDoPerfil")}</option>
          {outros.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>
      <Botao disabled={enviando}>{enviando ? t("copiando") : t("copiar")}</Botao>
    </form>
  );
}

export function FormNovoPerfil({ perfis }: { perfis: { id: string; nome: string; camada: string }[] }) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(criarPerfilAcao);
  const t = useTranslations("administracao.perfis.formulario");
  const [camada, setCamada] = useState<"tenant" | "deal" | "">("");
  // Só dá para copiar permissões de um perfil da mesma camada.
  const opcoes = perfis.filter((p) => p.camada === camada);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo rotulo={t("nome")} name="nome" required />
      <CampoDescricao />
      <fieldset className="mb-4">
        <legend className="text-text mb-1 text-sm font-medium">{t("camada")}</legend>
        <label className="text-text flex items-center gap-2 text-sm">
          <input type="radio" name="camada" value="tenant" required onChange={() => setCamada("tenant")} />{" "}
          {t("camadaTenant")}
        </label>
        <label className="text-text flex items-center gap-2 text-sm">
          <input type="radio" name="camada" value="deal" onChange={() => setCamada("deal")} />{" "}
          {t("camadaDeal")}
        </label>
      </fieldset>
      <label className="mb-4 block">
        <span className="text-text mb-1 block text-sm font-medium">{t("comecarCom")}</span>
        <select
          key={camada}
          name="copiarDe"
          defaultValue=""
          disabled={!camada}
          className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
        >
          <option value="">{camada ? t("nenhuma") : t("escolhaACamada")}</option>
          {opcoes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <Botao disabled={enviando}>{enviando ? t("criando") : t("criar")}</Botao>
    </form>
  );
}

export function FormEditarPerfil({ id, nome, descricao }: { id: string; nome: string; descricao: string }) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(editarPerfilAcao);
  const t = useTranslations("administracao.perfis.formulario");
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={id} />
      <Campo rotulo={t("nome")} name="nome" defaultValue={nome} required />
      <CampoDescricao defaultValue={descricao} />
      <Botao disabled={enviando}>{enviando ? t("salvando") : t("salvar")}</Botao>
    </form>
  );
}

function CampoDescricao({ defaultValue = "" }: { defaultValue?: string }) {
  const t = useTranslations("administracao.perfis.formulario");
  return (
    <label className="mb-4 block">
      <span className="text-text mb-1 block text-sm font-medium">{t("descricao")}</span>
      <textarea
        name="descricao"
        defaultValue={defaultValue}
        maxLength={400}
        rows={3}
        className="border-border bg-background text-text focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}

/** Escolha do perfil do tenant (um por pessoa), com a explicação de cada um. */
export function CaixasDePerfis({
  perfis,
  marcados = [],
}: {
  perfis: { id: string; nome: string; descricao: string }[];
  marcados?: string[];
}) {
  const t = useTranslations("administracao.perfis.formulario");
  if (perfis.length === 0) return <p className="text-muted mb-4 text-sm">{t("nenhumPerfil")}</p>;
  return <OpcoesDePerfil perfis={perfis} marcado={marcados[0] ?? ""} />;
}

export function FormPerfisDoUsuario({
  usuarioId,
  perfis,
  marcados,
}: {
  usuarioId: string;
  perfis: { id: string; nome: string; descricao: string }[];
  marcados: string[];
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(definirPerfisDoUsuarioAcao);
  const t = useTranslations("administracao.perfis.formulario");
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={usuarioId} />
      <CaixasDePerfis perfis={perfis} marcados={marcados} />
      <Botao disabled={enviando}>{enviando ? t("salvando") : t("salvarPerfil")}</Botao>
    </form>
  );
}
