import { produto } from "@/config/produto";
import { TOKENS_PADRAO, textoSobre } from "@/config/marca";
import type { Email } from "./enviar";

/**
 * Modelo único dos e-mails transacionais, com a marca do tenant (white label,
 * ADR-0010, regra 7): nome de exibição, cor primária no botão e logo embutido
 * no próprio e-mail (anexo "inline", sem link externo). Sem marca: padrão.
 * Sempre com versão em texto puro, para programas que não mostram HTML.
 */
export type MarcaDoEmail = { nome: string; corPrimaria: string; logo: Uint8Array | null };

export type ConteudoDoEmail = {
  para: string;
  assunto: string;
  saudacao: string;
  paragrafos: string[];
  link?: { texto: string; url: string };
  rodape?: string;
  marca?: MarcaDoEmail | null;
};

const ID_DO_LOGO = "logo-do-tenant";

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function montarEmail(c: ConteudoDoEmail): Email {
  const cor = c.marca?.corPrimaria ?? TOKENS_PADRAO.primaria;
  const nome = c.marca?.nome ?? produto.nome;
  const logo = c.marca?.logo ?? null;

  const texto = [
    c.saudacao,
    "",
    ...c.paragrafos,
    ...(c.link ? [c.link.url] : []),
    ...(c.rodape ? ["", c.rodape] : []),
    "",
    `${nome} · ${produto.nome}`,
  ].join("\n");

  const p = (t: string) => `<p style="margin:0 0 16px">${escapar(t)}</p>`;
  const cabecalho = logo
    ? `<img src="cid:${ID_DO_LOGO}" alt="${escapar(nome)}" style="max-height:56px;max-width:240px">`
    : `<strong style="font-size:18px;color:${cor}">${escapar(nome)}</strong>`;
  const botao = c.link
    ? `<p style="margin:24px 0"><a href="${escapar(c.link.url)}" style="background:${cor};color:${textoSobre(cor)};padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">${escapar(c.link.texto)}</a></p>
<p style="margin:0 0 16px;font-size:12px;color:${TOKENS_PADRAO.texto}">Se o botão não funcionar, copie este endereço no navegador:<br>${escapar(c.link.url)}</p>`
    : "";

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:${TOKENS_PADRAO.fundo};font-family:Arial,Helvetica,sans-serif;color:${TOKENS_PADRAO.texto};font-size:15px;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<div style="padding-bottom:16px;margin-bottom:24px;border-bottom:3px solid ${cor}">${cabecalho}</div>
${p(c.saudacao)}
${c.paragrafos.map(p).join("\n")}
${botao}
${c.rodape ? p(c.rodape) : ""}
<p style="margin:32px 0 0;font-size:12px;opacity:.7">${escapar(nome)} · ${escapar(produto.nome)}</p>
</div></body></html>`;

  return {
    para: c.para,
    assunto: c.assunto,
    texto,
    html,
    anexos: logo ? [{ nome: "logo.png", conteudo: logo, tipo: "image/png", cid: ID_DO_LOGO }] : undefined,
  };
}
