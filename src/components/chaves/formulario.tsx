"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { criarChaveAcao } from "@/app/acoes/chaves-api";
import { Aviso } from "@/components/ui/basicos";

/** Nova chave de API: nome, perfil e validade; o segredo aparece uma única vez. */
export function FormNovaChave({ perfis }: { perfis: { id: string; nome: string }[] }) {
  const t = useTranslations("chaves");
  const [estado, criar, criando] = useActionState(criarChaveAcao, undefined);
  const [copiado, setCopiado] = useState(false);
  const campo = "border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm";
  if (estado?.segredo)
    return (
      <div className="border-warning bg-warning-surface rounded-md border p-4">
        <p className="text-text mb-2 text-sm font-semibold">{t("segredoTitulo")}</p>
        <p className="text-muted mb-2 text-xs">{t("segredoAjuda")}</p>
        <code className="bg-background text-text block rounded p-2 text-xs break-all">{estado.segredo}</code>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(estado.segredo!);
              setCopiado(true);
            }}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {copiado ? t("copiado") : t("copiar")}
          </button>
          <button type="button" onClick={() => window.location.reload()} className="text-muted text-sm">
            {t("concluir")}
          </button>
        </div>
      </div>
    );
  return (
    <form action={criar} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      {estado?.erro && (
        <div className="sm:col-span-4">
          <Aviso>{estado.erro}</Aviso>
        </div>
      )}
      <label>
        <span className="text-text mb-1 block text-sm font-medium">{t("nome")}</span>
        <input name="nome" required maxLength={100} placeholder={t("nomeDica")} className={campo} />
      </label>
      <label>
        <span className="text-text mb-1 block text-sm font-medium">{t("perfil")}</span>
        <select name="perfilId" required defaultValue="" className={campo}>
          <option value="" disabled>
            {t("escolhaPerfil")}
          </option>
          {perfis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-text mb-1 block text-sm font-medium">{t("expiraEm")}</span>
        <input name="expiraEm" type="date" className={campo} />
      </label>
      <button
        type="submit"
        disabled={criando}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
      >
        {t("criar")}
      </button>
    </form>
  );
}
