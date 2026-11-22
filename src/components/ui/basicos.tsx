import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, type ComponentProps, type ReactNode } from "react";

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
  const t = useTranslations("comum.basicos");
  const logo = (negativa: boolean, extra = "") => (
    <Image
      src={negativa ? "/marca/rgruber-horizontal-negativa.svg" : "/marca/rgruber-horizontal-positiva.svg"}
      alt={t("logoAlt")}
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
      <span>{t("copyrightBy")}</span>
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

/**
 * Título da tela. `sobre`: rótulo curto acima do título (ex.: "Cadastro").
 * `ajuda`: explicação da tela, aberta pelo ícone "?" ao lado do título (não
 * ocupa espaço na tela).
 */
export function Titulo({ sobre, ajuda, children }: { sobre?: string; ajuda?: string; children: ReactNode }) {
  return (
    <header className="mb-6">
      {sobre && <p className="text-accent text-xs font-semibold tracking-widest uppercase">{sobre}</p>}
      <h1 className="text-text mt-1 flex items-center gap-2 text-xl font-bold">
        {children}
        {ajuda && <Ajuda texto={ajuda} />}
      </h1>
    </header>
  );
}

/** Ícone de ajuda "?" que abre a explicação num balão (padrão para todas as telas). */
export function Ajuda({ texto }: { texto: string }) {
  const id = useId();
  const t = useTranslations("comum");
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={t("ajuda")}
        title={t("ajuda")}
        className="border-border text-muted hover:text-primary hover:border-primary inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
      >
        ?
      </button>
      <div
        id={id}
        popover="auto"
        role="note"
        className="bg-surface text-text border-border backdrop:bg-backdrop/40 m-auto max-w-sm rounded-lg border p-4 text-sm font-normal whitespace-pre-line shadow-lg"
      >
        {texto}
      </div>
    </>
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
  const t = useTranslations("comum.basicos");
  return <p className="text-muted text-sm">{t("carregando")}</p>;
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
  const t = useTranslations("comum.basicos");
  if (foto)
    return (
      <Image
        src={foto}
        alt={t("fotoDe", { nome })}
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
  const t = useTranslations("comum.basicos");
  return (
    <fieldset className="mb-4">
      <legend className="text-text mb-2 text-sm font-medium">{t("perfilNoTenant")}</legend>
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
        titulo={t("semPerfil")}
        descricao={t("semPerfilDescricao")}
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

/** Etiqueta suave (perfil, situação, tags), na cor primária ou de um estado. */
export function Etiqueta({
  children,
  tom = "primaria",
}: {
  children: ReactNode;
  tom?: "primaria" | "sucesso" | "perigo" | "neutra";
}) {
  const cores = {
    primaria: "bg-primary-soft text-primary",
    sucesso: "bg-success/10 text-success",
    perigo: "bg-danger/10 text-danger",
    neutra: "bg-surface text-muted",
  }[tom];
  return <span className={`${cores} inline-block rounded px-2 py-0.5 text-xs font-medium`}>{children}</span>;
}

/** Cabeçalho e corpo de tabela no estilo das listas (cabeçalho suave, linhas espaçadas). */
export const estiloTabela = {
  tabela: "w-full text-left text-sm",
  cabecalho: "bg-primary-soft text-primary",
  th: "px-4 py-3 font-semibold first:rounded-l-md last:rounded-r-md",
  linha: "border-border border-b last:border-0",
  td: "px-4 py-3 align-middle",
};
