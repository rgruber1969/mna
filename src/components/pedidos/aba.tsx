"use client";

import { hojeNoBrasil } from "@/config/prazos";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { salvarPedidoAcao } from "@/app/acoes/pedidos";
import { Ajuda, Aviso, estiloTabela } from "@/components/ui/basicos";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Janela } from "@/components/ui/janela";
import { Atualizando } from "@/components/ui/atualizando";
import type { PedidoDetalhe, PedidosDoNegocio } from "@/server/services/pedidos";
import { DetalheDoPedido } from "./detalhe";

export const campo = "border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm";
export const rotulo = "text-text mb-1 block text-sm font-medium";
export const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");
export const botaoSecundario =
  "border-border text-text hover:border-primary rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60";
export const botaoPrincipal =
  "bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60";

/** Abre outro pedido (ou a lista) mantendo a aba no endereço. */
export function useNavegacaoDePedidos() {
  const router = useRouter();
  return (pedidoId: string | null) => {
    const q = new URLSearchParams(window.location.search);
    q.set("aba", "pedidos");
    for (const k of ["pedido", "busca", "assunto", "situacao", "rodada", "responsavel", "vista"]) q.delete(k);
    if (pedidoId) q.set("pedido", pedidoId);
    router.push(`?${q.toString()}`, { scroll: false });
  };
}

/** Aba "Pedidos" do negócio: a lista de pedidos ou, com `?pedido=`, o pedido aberto. */
export function AbaDePedidos({
  dealId,
  dados,
  detalhe,
}: {
  dealId: string;
  dados: PedidosDoNegocio;
  detalhe: PedidoDetalhe | null;
}) {
  const t = useTranslations("pedidos");
  const abrir = useNavegacaoDePedidos();
  const [novo, setNovo] = useState(false);
  if (detalhe) return <DetalheDoPedido detalhe={detalhe} dados={dados} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-text flex items-center gap-1 text-base font-semibold">
          {t("titulo")} <Ajuda texto={t("ajuda")} />
        </h3>
        <span className="flex-1" />
        {dados.podeCriar && (
          <button type="button" onClick={() => setNovo(true)} className={botaoPrincipal}>
            {t("novo")}
          </button>
        )}
      </div>
      {dados.pedidos.length === 0 ? (
        <EstadoVazio titulo={t("nenhum")} texto={t("nenhumTexto")} />
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className={estiloTabela.tabela}>
            <thead className={estiloTabela.cabecalho}>
              <tr>
                <th className={estiloTabela.th}>{t("colNumero")}</th>
                <th className={estiloTabela.th}>{t("colTitulo")}</th>
                <th className={estiloTabela.th}>{t("colCompradora")}</th>
                <th className={estiloTabela.th}>{t("colSolicitante")}</th>
                <th className={estiloTabela.th}>{t("colData")}</th>
                <th className={`${estiloTabela.th} text-right`}>{t("colItens")}</th>
                <th className={`${estiloTabela.th} text-right`}>{t("colAbertos")}</th>
                <th className={`${estiloTabela.th} text-right`}>{t("colEntregues")}</th>
              </tr>
            </thead>
            <tbody>
              {dados.pedidos.map((p) => (
                <tr key={p.id} className={`${estiloTabela.linha} cursor-pointer`} onClick={() => abrir(p.id)}>
                  <td className={`${estiloTabela.td} text-muted text-xs tabular-nums`}>{p.numero}</td>
                  <td className={estiloTabela.td}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrir(p.id);
                      }}
                      className="text-primary text-left text-sm font-semibold hover:underline"
                    >
                      {p.titulo}
                    </button>
                  </td>
                  <td className={`${estiloTabela.td} text-sm`}>{p.compradora ?? t("interno")}</td>
                  <td className={`${estiloTabela.td} text-sm`}>{p.solicitante ?? "—"}</td>
                  <td className={`${estiloTabela.td} text-muted text-xs tabular-nums`}>{br(p.data)}</td>
                  <td className={`${estiloTabela.td} text-right text-sm tabular-nums`}>{p.itens}</td>
                  <td className={`${estiloTabela.td} text-right text-sm tabular-nums`}>
                    <span className={p.abertos > 0 ? "text-warning font-semibold" : "text-muted"}>
                      {p.abertos}
                    </span>
                  </td>
                  <td className={`${estiloTabela.td} text-right text-sm tabular-nums`}>
                    <span className={p.entregues > 0 ? "text-success font-semibold" : "text-muted"}>
                      {p.entregues}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {novo && (
        <FormularioDoPedido dealId={dealId} dados={dados} pedido={null} fechar={() => setNovo(false)} />
      )}
    </div>
  );
}

/** Novo pedido (com a opção de começar de um pedido anterior) ou edição dos dados do pedido. */
export function FormularioDoPedido({
  dealId,
  dados,
  pedido,
  fechar,
}: {
  dealId: string;
  dados: PedidosDoNegocio;
  pedido: PedidoDetalhe | null;
  fechar: () => void;
}) {
  const t = useTranslations("pedidos.formulario");
  const router = useRouter();
  const abrir = useNavegacaoDePedidos();
  const hoje = hojeNoBrasil();
  const [v, setV] = useState({
    origemId: "",
    titulo: pedido?.titulo ?? "",
    compradoraId:
      pedido?.compradoraId ??
      (!dados.vendedor && dados.compradoras.length === 1 ? dados.compradoras[0].id : ""),
    solicitanteId: pedido?.solicitanteId ?? "",
    solicitantePessoas: pedido?.solicitantePessoas ?? "",
    data: pedido?.data ?? hoje,
    dataBase: pedido?.dataBase ?? "",
    periodos: pedido?.periodos.join(", ") ?? "",
    amostragem: pedido?.amostragem ?? "",
    descricao: pedido?.descricao ?? "",
  });
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [gravado, setGravado] = useState(false);
  const [atualizando, iniciarAtualizacao] = useTransition();
  const muda = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const { origemId, ...resto } = v;
    const r = await salvarPedidoAcao(dealId, pedido?.id ?? null, resto, origemId || undefined);
    setSalvando(false);
    if (r.erro) return setErro({ texto: r.erro, campo: r.campo });
    setGravado(true);
    iniciarAtualizacao(() => {
      if (!pedido && r.id) abrir(r.id);
      else router.refresh();
    });
  }
  // Editando: fecha quando a tela atualizou. Criando: a janela some quando o pedido abre.
  useEffect(() => {
    if (gravado && !atualizando && pedido) fechar();
  }, [gravado, atualizando, pedido, fechar]);
  const comErro = (c: string) => (erro?.campo === c ? "border-danger" : "");
  return (
    <Janela
      titulo={pedido ? t("tituloEditar") : t("tituloNovo")}
      rotuloFechar={t("cancelar")}
      fechar={fechar}
    >
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        {erro && (
          <div className="sm:col-span-2">
            <Aviso>{erro.texto}</Aviso>
          </div>
        )}
        {!pedido && dados.anteriores.length > 0 && (
          <label className="sm:col-span-2">
            <span className={`${rotulo} flex items-center gap-1`}>
              {t("origem")} <Ajuda texto={t("origemAjuda")} />
            </span>
            <select
              value={v.origemId}
              onChange={muda("origemId")}
              className={`${campo} ${comErro("origemId")}`}
            >
              <option value="">{t("semOrigem")}</option>
              {dados.anteriores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="sm:col-span-2">
          <span className={rotulo}>{t("titulo")}</span>
          <input
            value={v.titulo}
            onChange={muda("titulo")}
            placeholder={t("tituloExemplo")}
            required
            maxLength={160}
            className={`${campo} ${comErro("titulo")}`}
          />
        </label>
        {(dados.vendedor || dados.compradoras.length > 1) && (
          <label>
            <span className={rotulo}>{t("compradora")}</span>
            <select
              value={v.compradoraId}
              onChange={muda("compradoraId")}
              disabled={Boolean(pedido) && !dados.vendedor}
              className={`${campo} ${comErro("compradoraId")}`}
            >
              {dados.vendedor && <option value="">{t("compradoraNenhuma")}</option>}
              {dados.compradoras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className={rotulo}>{t("solicitante")}</span>
          <select value={v.solicitanteId} onChange={muda("solicitanteId")} className={campo}>
            <option value="">{t("solicitanteNenhum")}</option>
            {dados.empresas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={rotulo}>{t("solicitantePessoas")}</span>
          <input
            value={v.solicitantePessoas}
            onChange={muda("solicitantePessoas")}
            maxLength={500}
            className={campo}
          />
        </label>
        <label>
          <span className={rotulo}>{t("data")}</span>
          <input
            type="date"
            value={v.data}
            onChange={muda("data")}
            required
            className={`${campo} ${comErro("data")}`}
          />
        </label>
        <label>
          <span className={rotulo}>{t("dataBase")}</span>
          <input type="date" value={v.dataBase} onChange={muda("dataBase")} className={campo} />
        </label>
        <label>
          <span className={`${rotulo} flex items-center gap-1`}>
            {t("periodos")} <Ajuda texto={t("periodosAjuda")} />
          </span>
          <input value={v.periodos} onChange={muda("periodos")} maxLength={300} className={campo} />
        </label>
        <label>
          <span className={rotulo}>{t("amostragem")}</span>
          <input value={v.amostragem} onChange={muda("amostragem")} maxLength={300} className={campo} />
        </label>
        <label className="sm:col-span-2">
          <span className={rotulo}>{t("descricao")}</span>
          <textarea
            value={v.descricao}
            onChange={muda("descricao")}
            rows={3}
            maxLength={2000}
            className={campo}
          />
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={fechar} className={botaoSecundario}>
            {t("cancelar")}
          </button>
          {gravado ? (
            <Atualizando />
          ) : (
            <button disabled={salvando} className={botaoPrincipal}>
              {salvando ? t("salvando") : t("salvar")}
            </button>
          )}
        </div>
      </form>
    </Janela>
  );
}
