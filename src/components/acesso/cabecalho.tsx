import { FormSair } from "./formularios";

/** Barra superior das áreas logadas: área, usuário e botão de sair. */
export function Cabecalho({ area, usuario }: { area: string; usuario: string }) {
  return (
    <header className="border-border bg-background flex items-center justify-between border-b px-6 py-3">
      <span className="text-primary font-semibold">{area}</span>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted">{usuario}</span>
        <FormSair />
      </div>
    </header>
  );
}
