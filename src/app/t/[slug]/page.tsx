import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { painelDoUsuario } from "@/server/services/painel";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Carregando, Titulo } from "@/components/ui/basicos";

/**
 * Tela principal do tenant (item 14; resposta P1): números no topo; meus
 * negócios, últimos alertas e prazos lado a lado; negócios por etapa embaixo.
 */

function Bloco({
  titulo,
  link,
  children,
}: {
  titulo: string;
  link?: { href: string; texto: string };
  children: ReactNode;
}) {
  return (
    <section className="bg-background shadow-cartao rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-accent text-xs font-semibold tracking-widest uppercase">{titulo}</h2>
        {link && (
          <Link href={link.href} className="text-primary text-xs font-medium">
            {link.texto}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

async function Inicio() {
  await connection();
  const t = await getTranslations("acesso.inicio");
  const tp = await getTranslations("painel");
  const tn = await getTranslations("notificacoes");
  const ts = await getTranslations("negocios.situacoes");
  const tk = await getTranslations("negocios.kanban");
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const p = await painelDoUsuario(acesso);
  const br = (d: string) => d.split("-").reverse().join("/");
  const maior = Math.max(1, ...p.porEtapa.map((e) => e.total));
  const numeros = [
    { rotulo: tp("numeros.negocios"), valor: p.numeros.negocios, href: "/negocios" },
    { rotulo: tp("numeros.minhasTarefas"), valor: p.numeros.minhasTarefas },
    { rotulo: tp("numeros.atrasadas"), valor: p.numeros.atrasadas, destaque: p.numeros.atrasadas > 0 },
    { rotulo: tp("numeros.prazosDaSemana"), valor: p.numeros.prazosDaSemana },
  ];
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-col gap-4 px-3 py-6 sm:px-6">
        <Titulo sobre={acesso.administrador ? t("administrador") : t("usuario")}>
          {t("ola", { nome: acesso.usuario.nome })}
        </Titulo>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {numeros.map((n) => (
            <div key={n.rotulo} className="bg-background shadow-cartao rounded-xl p-4">
              <p className="text-muted text-xs">{n.rotulo}</p>
              <p className={`text-2xl font-bold ${n.destaque ? "text-danger" : "text-text"}`}>{n.valor}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Bloco
            titulo={tp("meusNegocios")}
            link={p.veNegocios ? { href: "/negocios?vista=kanban", texto: tp("verKanban") } : undefined}
          >
            {p.negocios.length === 0 ? (
              <p className="text-muted text-sm">{tp("semNegocios")}</p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {p.negocios.map((n) => (
                  <li key={n.id} className="py-2">
                    <Link href={`/negocios/${n.id}`} className="text-text font-medium">
                      {n.nome}
                    </Link>
                    <span className="text-muted block text-xs">
                      {[
                        n.etapa ? tk("etapa", { etapa: n.etapa }) : tk("aIniciar"),
                        n.situacao !== "andamento" && ts(n.situacao as never),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
          <Bloco titulo={tp("alertas")} link={{ href: "/notificacoes", texto: tp("verTodos") }}>
            <p className="text-muted mb-2 text-xs">{tp("alertasAjuda")}</p>
            {p.alertas.length === 0 ? (
              <p className="text-muted text-sm">{tp("semAlertas")}</p>
            ) : (
              <ul className="divide-border divide-y text-sm">
                {p.alertas.map((n) => (
                  <li key={n.id} className="py-2">
                    <Link
                      href={n.link ?? "/notificacoes"}
                      className={n.lida ? "text-muted" : "text-text font-medium"}
                    >
                      {tn(`tipos.${n.tipo}` as never, n.parametros as never)}
                    </Link>
                    <span className="text-muted block text-xs">
                      {n.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
          <Bloco titulo={tp("prazos")}>
            {p.prazos.length === 0 ? (
              <p className="text-muted text-sm">{tp("semPrazos")}</p>
            ) : (
              <ol className="border-border relative ml-2 border-l text-sm">
                {p.prazos.map((z, i) => (
                  <li key={i} className="mb-3 ml-4">
                    <span
                      className={`absolute -left-1.5 mt-1 h-3 w-3 rounded-full border ${z.atrasado ? "border-danger bg-danger" : z.tipo === "exclusividade" ? "border-accent bg-accent" : "border-primary bg-surface"}`}
                    />
                    <span className={`text-xs font-semibold ${z.atrasado ? "text-danger" : "text-muted"}`}>
                      {br(z.data)}
                      {z.atrasado && ` · ${tp("atrasado")}`}
                    </span>
                    <Link href={z.link} className="text-text block">
                      {tp(`tipos.${z.tipo}`, { texto: z.texto })}
                    </Link>
                    <span className="text-muted block text-xs">{z.negocio}</span>
                  </li>
                ))}
              </ol>
            )}
          </Bloco>
        </div>
        {p.veNegocios && (
          <Bloco titulo={tp("porEtapa")}>
            <ul className="space-y-1.5">
              {p.porEtapa.map((e, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-text w-40 shrink-0 truncate">{e.nome || tk("aIniciar")}</span>
                  <span className="bg-background relative h-4 flex-1 rounded">
                    <span
                      className="bg-primary absolute inset-y-0 left-0 rounded"
                      style={{ width: `${(e.total / maior) * 100}%` }}
                    />
                  </span>
                  <span className="text-muted w-6 text-right">{e.total}</span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Inicio />
    </Suspense>
  );
}
