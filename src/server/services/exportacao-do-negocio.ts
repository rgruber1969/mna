import { tradutor, type ErroDeServico } from "@/i18n/servidor";
import { estaLigada } from "@/config/funcionalidades";
import { pdfDeTexto } from "@/server/arquivos/pdf-simples";
import { exigirAdministrador, type Acesso } from "./acesso";
import { auditar } from "./empresas";
import { etapasDoNegocio } from "./etapas";
import { obterNegocio } from "./negocios";

/**
 * Exportação completa do negócio em PDF (item 22, **simulada**): no fim da
 * retenção, o administrador exporta o negócio antes da exclusão. Na
 * demonstração, o PDF traz só o resumo do negócio (dados, empresas, pessoas
 * e etapas), com a marca de demonstração; documentos, mensagens e histórico
 * completos entram na versão real. Só administradores do tenant; auditado.
 */
export async function exportarNegocio(
  acesso: Acesso | null,
  dealId: string,
): Promise<{ nome: string; conteudo: string } | ErroDeServico> {
  const a = exigirAdministrador(acesso);
  if (!estaLigada("exportacaoDoNegocio")) return { erro: "negocios.erros.funcionalidadeDesligada" };
  const [n, etapas] = await Promise.all([obterNegocio(a, dealId), etapasDoNegocio(a, dealId)]);
  if (!n) return { erro: "negocios.erros.naoEncontrado" };
  const tr = await tradutor();
  const t = (chave: string, p?: Record<string, string>) => tr(`negocios.exportacao.${chave}`, p);
  const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
  const pagina1 = [
    t("pdf.demonstracao"),
    "",
    n.nome,
    `${t("pdf.nomeInterno")}: ${n.nomeInterno ?? "—"}`,
    `${t("pdf.tipo")}: ${n.tipo ?? "—"}`,
    `${t("pdf.inicio")}: ${br(n.dataInicio)}   ${t("pdf.previsao")}: ${br(n.previsaoFechamento)}`,
    `${t("pdf.valor")}: ${n.valorEstimado ? Number(n.valorEstimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}`,
    "",
    t("pdf.empresas"),
    ...n.empresas.map((e) => `  • ${e.nome} (${e.papel})`),
    "",
    t("pdf.pessoas"),
    ...n.participantes.map((p) => `  • ${p.nome}${p.perfil ? ` (${p.perfil})` : ""}`),
  ];
  const pagina2 = [
    t("pdf.etapas"),
    ...(etapas?.etapas ?? []).flatMap((e) => [
      `  • ${e.nome}: ${t(`pdf.situacoes.${e.situacao}`)}  ${br(e.inicioReal ?? e.inicioPrevisto)} → ${br(e.fimReal ?? e.fimPrevisto)}`,
      ...e.subetapas.map((s) => `      - ${s.nome}: ${t(`pdf.situacoes.${s.situacao}`)}`),
    ]),
    "",
    t("pdf.faltam"),
    "",
    t("pdf.geradoEm", { data: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) }),
  ];
  const pdf = pdfDeTexto([pagina1.slice(0, 50), pagina2.slice(0, 50)]);
  await auditar(a, "negocio.exportado", "deal", dealId, { simulada: true });
  const arquivo = `${n.nome.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-demonstracao.pdf`;
  return { nome: arquivo, conteudo: Buffer.from(pdf).toString("base64") };
}
