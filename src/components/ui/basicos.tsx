import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";

/**
 * Componentes básicos com tokens semânticos (ADR-0010). Provisórios até a
 * adoção dos componentes shadcn/ui (ADR-0018).
 */

/**
 * Fundo das telas soltas (login, convite). `destaque`: fundo escuro da marca,
 * com o cartão branco em alto contraste e logotipo opcional acima dele.
 * `fundo`: decoração atrás do conteúdo (ex.: linhas animadas).
 */
export function Moldura({
  children,
  rodape = true,
  destaque = false,
  logo,
  fundo,
}: {
  children: ReactNode;
  rodape?: boolean;
  destaque?: boolean;
  logo?: ReactNode;
  fundo?: ReactNode;
}) {
  return (
    <main
      className={`${destaque ? "bg-backdrop" : "bg-surface"} relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10`}
    >
      {fundo}
      <div className="relative flex w-full flex-col items-center">
        {logo && <div className="mb-8">{logo}</div>}
        {children}
        {rodape && <AssinaturaRgruber escuro={destaque} />}
      </div>
    </main>
  );
}

/**
 * Assinatura discreta: "Copyright by" + logotipo da RGRUBER, na versão
 * adequada ao fundo (docs/marca/rgruber; largura mínima de 120 px).
 */
export function AssinaturaRgruber({
  escuro = false,
  className = "mt-10",
}: {
  /** true: fundo escuro fixo (login); "auto": segue o tema claro/escuro da interface. */
  escuro?: boolean | "auto";
  className?: string;
}) {
  const logo = (negativa: boolean, extra = "") => (
    <Image
      src={negativa ? "/marca/rgruber-horizontal-negativa.svg" : "/marca/rgruber-horizontal-positiva.svg"}
      alt="RGRUBER Consultoria"
      width={120}
      height={34}
      unoptimized
      className={extra}
    />
  );
  return (
    <footer
      className={`${escuro === true ? "text-backdrop-foreground" : "text-muted"} ${className} flex items-center gap-2 text-xs opacity-60`}
    >
      <span>Copyright by</span>
      {escuro === "auto" ? (
        <>
          {logo(false, "dark:hidden")}
          {logo(true, "hidden dark:block")}
        </>
      ) : (
        logo(escuro)
      )}
    </footer>
  );
}

export function Cartao({ children, largura = "max-w-md" }: { children: ReactNode; largura?: string }) {
  return (
    <section className={`bg-background shadow-cartao w-full ${largura} rounded-[10px] p-6 sm:p-7`}>
      {children}
    </section>
  );
}

export function Titulo({ sobre, children }: { sobre?: string; children: ReactNode }) {
  return (
    <header className="mb-6">
      {sobre && <p className="text-accent text-xs font-semibold tracking-widest uppercase">{sobre}</p>}
      <h1 className="text-text mt-1 text-xl font-bold">{children}</h1>
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

/**
 * Opção marcável com título e explicação, em cartão (ex.: escolha de perfis).
 * Destaca a borda quando marcada.
 */
export function CaixaComDescricao({
  titulo,
  descricao,
  ...props
}: { titulo: string; descricao?: string } & ComponentProps<"input">) {
  return (
    <label className="border-border has-[:checked]:border-primary has-[:checked]:bg-surface mb-2 flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2">
      <input type="checkbox" {...props} className="mt-1" aria-label={titulo} />
      <span>
        <span className="text-text block text-sm font-medium">{titulo}</span>
        {descricao && <span className="text-muted block text-xs">{descricao}</span>}
      </span>
    </label>
  );
}

/** Iniciais do nome (até duas letras), para quando não há foto. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const letras =
    partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0] ?? "?").slice(0, 2);
  return letras.toUpperCase();
}

/** Foto da pessoa em miniatura redonda; sem foto, as iniciais. */
export function Avatar({
  nome,
  foto,
  tamanho = 32,
}: {
  nome: string;
  foto?: string | null;
  tamanho?: number;
}) {
  if (foto)
    return (
      <Image
        src={foto}
        alt={`Foto de ${nome}`}
        width={tamanho}
        height={tamanho}
        unoptimized
        className="border-border rounded-full border object-cover"
      />
    );
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho }}
      className="bg-primary text-primary-foreground inline-flex items-center justify-center rounded-full text-xs font-semibold"
    >
      {iniciais(nome)}
    </span>
  );
}

/**
 * Escolha de um único perfil do tenant (convite e detalhe do usuário), com a
 * opção "sem perfil" (a pessoa não vê nada fora dos deals até receber um).
 */
export function OpcoesDePerfil({
  perfis,
  marcado = "",
}: {
  perfis: { id: string; nome: string; descricao: string }[];
  marcado?: string;
}) {
  return (
    <fieldset className="mb-4">
      <legend className="text-text mb-2 text-sm font-medium">Perfil no tenant</legend>
      {perfis.map((p) => (
        <CaixaComDescricao
          key={p.id}
          type="radio"
          name="perfil"
          value={p.id}
          titulo={p.nome}
          descricao={p.descricao}
          defaultChecked={marcado === p.id}
        />
      ))}
      <CaixaComDescricao
        type="radio"
        name="perfil"
        value=""
        titulo="Sem perfil por enquanto"
        descricao="A pessoa entra, mas não vê nada fora dos deals até receber um perfil."
        defaultChecked={marcado === ""}
      />
    </fieldset>
  );
}

/**
 * Logo do tenant (white label). Proporção livre, por isso <img> com altura
 * fixa e largura automática; as imagens já vêm reduzidas pelo servidor.
 */
export function LogoDoTenant({
  src,
  nome,
  className = "h-8",
}: {
  src: string;
  nome: string;
  className?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={nome} className={`${className} w-auto max-w-full object-contain`} />;
}
