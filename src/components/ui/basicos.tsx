import type { ComponentProps, ReactNode } from "react";

/**
 * Componentes básicos com tokens semânticos (ADR-0010). Provisórios até a
 * adoção dos componentes shadcn/ui (ADR-0018).
 */

/**
 * Fundo das telas soltas (login, convite). `destaque`: fundo escuro da marca,
 * com o cartão branco em alto contraste e logotipo opcional acima dele.
 */
export function Moldura({
  children,
  rodape = true,
  destaque = false,
  logo,
}: {
  children: ReactNode;
  rodape?: boolean;
  destaque?: boolean;
  logo?: ReactNode;
}) {
  return (
    <main
      className={`${destaque ? "bg-backdrop" : "bg-surface"} flex flex-1 flex-col items-center justify-center px-4 py-10`}
    >
      {logo && <div className="mb-8">{logo}</div>}
      {children}
      {rodape && (
        <footer className={`${destaque ? "text-backdrop-foreground/70" : "text-muted"} mt-10 text-xs`}>
          Desenvolvido por RGRUBER Consultoria
        </footer>
      )}
    </main>
  );
}

export function Cartao({ children, largura = "max-w-md" }: { children: ReactNode; largura?: string }) {
  return (
    <section className={`border-border bg-background w-full ${largura} rounded-lg border p-8`}>
      {children}
    </section>
  );
}

export function Titulo({ sobre, children }: { sobre?: string; children: ReactNode }) {
  return (
    <header className="mb-6">
      {sobre && <p className="text-accent text-xs font-semibold tracking-widest uppercase">{sobre}</p>}
      <h1 className="text-primary mt-1 text-2xl font-semibold">{children}</h1>
    </header>
  );
}

export function Campo({ rotulo, ...props }: { rotulo: string } & ComponentProps<"input">) {
  return (
    <label className="mb-4 block">
      <span className="text-text mb-1 block text-sm font-medium">{rotulo}</span>
      <input
        {...props}
        className="border-border bg-background text-text focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}

export function Botao({ children, ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "ok"; children: ReactNode }) {
  const cor = tipo === "erro" ? "text-danger border-danger" : "text-success border-success";
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`${cor} mb-4 rounded-md border px-3 py-2 text-sm`}
    >
      {children}
    </p>
  );
}

export function Carregando() {
  return <p className="text-muted text-sm">Carregando...</p>;
}
