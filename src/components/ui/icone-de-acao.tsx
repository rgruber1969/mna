import type { ComponentProps } from "react";

/**
 * Ícones das ações de linha (listas e tabelas), no lugar do texto: lápis
 * (editar), lixeira (excluir ou remover), seta para baixo (baixar), lupa
 * (visualizar) e seta para cima (nova versão). Sempre com dica
 * (title) e nome acessível (aria-label) iguais ao texto que substituem. Os
 * botões principais dos formulários (Salvar, Criar) continuam com texto.
 */
export type TipoDeAcao = "editar" | "excluir" | "baixar" | "visualizar" | "novaVersao";

const DESENHOS: Record<TipoDeAcao, string> = {
  editar: "M4 20h4l11-11-4-4L4 16zM13 7l4 4",
  excluir: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  baixar: "M12 4v11M7 10l5 5 5-5M5 20h14",
  visualizar: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  novaVersao: "M12 20V9M7 14l5-5 5 5M5 4h14",
};

export function IconeDeAcao({ tipo }: { tipo: TipoDeAcao }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d={DESENHOS[tipo]} />
    </svg>
  );
}

/** Botão só com o ícone (com dica e nome acessível). Perigo (excluir) em vermelho ao passar o mouse. */
export function BotaoDeIcone({
  tipo,
  rotulo,
  className = "",
  ...props
}: { tipo: TipoDeAcao; rotulo: string } & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      {...props}
      className={`text-muted inline-grid h-7 w-7 place-items-center rounded-md transition-colors disabled:opacity-50 ${
        tipo === "excluir"
          ? "hover:bg-danger-soft hover:text-danger"
          : "hover:bg-primary-soft hover:text-primary"
      } ${className}`}
    >
      <IconeDeAcao tipo={tipo} />
    </button>
  );
}
