import Link from "next/link";

/**
 * Estado vazio que convida (propostas de layout v3): cartão tracejado com o
 * que fazer a seguir, em vez de só avisar que não há nada. A ação principal
 * usa a cor de destaque; "limpar" volta a lista sem os filtros que causaram o vazio.
 */
export function EstadoVazio({
  titulo,
  texto,
  acao,
  limpar,
}: {
  titulo: string;
  texto?: string;
  acao?: { href: string; rotulo: string };
  /** Link (filtros no endereço) ou clique (filtros na tela). */
  limpar?: { href: string; rotulo: string } | { onClick: () => void; rotulo: string };
}) {
  return (
    <div className="border-border flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center">
      <p className="text-text text-sm font-semibold">{titulo}</p>
      {texto && <p className="text-muted max-w-sm text-xs">{texto}</p>}
      <span className="mt-1 flex flex-wrap items-center justify-center gap-3">
        {acao && (
          <Link
            href={acao.href}
            className="bg-cta text-cta-foreground rounded-md px-4 py-2 text-sm font-semibold"
          >
            + {acao.rotulo}
          </Link>
        )}
        {limpar &&
          ("href" in limpar ? (
            <Link href={limpar.href} className="text-primary text-sm font-semibold">
              {limpar.rotulo}
            </Link>
          ) : (
            <button type="button" onClick={limpar.onClick} className="text-primary text-sm font-semibold">
              {limpar.rotulo}
            </button>
          ))}
      </span>
    </div>
  );
}
