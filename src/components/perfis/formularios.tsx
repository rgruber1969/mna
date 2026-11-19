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
import { RECURSOS, type Matriz, type Recurso } from "@/server/services/permissoes/catalogo";

const temNota = (r: Recurso): boolean => Boolean((RECURSOS[r] as { nota?: true }).nota);

/** Ícone de "marcado" dentro do botão da ação. */
function Marca() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * Permissões de cada item de menu: as ações por extenso, como botões que
 * acendem quando marcados (editável, caixas "m" = "recurso:acao") ou só
 * leitura. Só aparecem as ações que se aplicam ao item. "Todas" / "Nenhuma"
 * marcam a linha inteira.
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
  const t = useTranslations("administracao.permissoes");
  const marcarLinha = (botao: HTMLElement, valor: boolean) =>
    botao
      .closest("[data-linha]")
      ?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach((c) => (c.checked = valor));
  return (
    <ul className="divide-border mb-4 divide-y">
      {recursos.map((r) => (
        <li key={r} data-linha className="grid gap-2 py-3 md:grid-cols-[15rem_1fr] md:items-center">
          <div>
            <span className="text-text text-sm font-medium">{t(`recursos.${r}`)}</span>
            {temNota(r) && <span className="text-muted block text-xs">{t(`notas.${r}`)}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RECURSOS[r].acoes.map((a) => {
              const marcado = matriz[r]?.includes(a) ?? false;
              const rotulo = t(`acoes.${a}`);
              const aria = `${t(`recursos.${r}`)}: ${rotulo}`;
              const pilula =
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors";
              return editavel ? (
                <label key={a} className="relative">
                  <input
                    type="checkbox"
                    name="m"
                    value={`${r}:${a}`}
                    defaultChecked={marcado}
                    aria-label={aria}
                    className="peer sr-only"
                  />
                  <span
                    className={`${pilula} border-border text-muted hover:border-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-primary peer-focus-visible:ring-2 [&>svg]:hidden peer-checked:[&>svg]:block`}
                  >
                    <Marca />
                    {rotulo}
                  </span>
                </label>
              ) : (
                <span
                  key={a}
                  aria-label={`${aria}: ${marcado ? t("permitido") : t("negado")}`}
                  className={`${pilula} ${marcado ? "border-success text-success" : "border-border text-muted line-through opacity-60"}`}
                >
                  {marcado && <Marca />}
                  {rotulo}
                </span>
              );
            })}
            {editavel && (
              <span className="text-muted ml-1 flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={(e) => marcarLinha(e.currentTarget, true)}
                  className="hover:text-primary underline"
                >
                  {t("todas")}
                </button>
                <button
                  type="button"
                  onClick={(e) => marcarLinha(e.currentTarget, false)}
                  className="hover:text-primary underline"
                >
                  {t("nenhuma")}
                </button>
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
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
