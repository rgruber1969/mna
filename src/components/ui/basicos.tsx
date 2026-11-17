import type { ComponentProps, ReactNode } from "react";

/**
 * Componentes básicos com tokens semânticos (ADR-0010). Provisórios até a
 * adoção dos componentes shadcn/ui (ADR-0018).
 */

export function Moldura({ children, rodape = true }: { children: ReactNode; rodape?: boolean }) {
  return (
    <main className="bg-surface flex flex-1 flex-col items-center justify-center px-4 py-10">
      {children}
      {rodape && <footer className="text-muted mt-10 text-xs">Desenvolvido por RGRUBER Consultoria</footer>}
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
