import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth/auth";
import { resolverArea } from "@/server/enderecos";

/**
 * Roteamento por endereço (ADR-0011): cada host é reescrito para a pasta da
 * sua área, então uma rota do console nunca responde num tenant e vice-versa.
 *   admin.<domínio>/x  → /console/x
 *   <slug>.<domínio>/x → /t/<slug>/x
 *   <domínio>/x        → /raiz/x
 * Também renova o cookie da sessão em uso (saída só após 1 h sem uso). A
 * autorização de verdade fica nas telas, via camada de serviços.
 */
export async function proxy(request: NextRequest) {
  const area = resolverArea(request.headers.get("host"));
  if (area.tipo === "invalido") return new NextResponse("Endereço não encontrado.", { status: 404 });

  const prefixo = area.tipo === "console" ? "/console" : area.tipo === "tenant" ? `/t/${area.slug}` : "/raiz";
  const url = request.nextUrl.clone();
  url.pathname = `${prefixo}${url.pathname === "/" ? "" : url.pathname}`;
  const resposta = NextResponse.rewrite(url);

  const temSessao = request.cookies.getAll().some((c) => c.name.endsWith("app.session_token"));
  const navegacao = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  if (area.tipo !== "raiz" && temSessao && navegacao) {
    const r = await auth.api.getSession({ headers: request.headers, asResponse: true });
    for (const c of r.headers.getSetCookie()) resposta.headers.append("set-cookie", c);
  }
  return resposta;
}

export const config = {
  // Fora do proxy: API (resolve o host por conta própria) e arquivos estáticos.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
