"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  excluirContaBancariaAcao,
  revelarContaBancariaAcao,
  salvarContaBancariaAcao,
} from "@/app/acoes/contas-bancarias";
import { BotaoDeAcao, useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso } from "@/components/ui/basicos";
import { formatarCnpj, formatarCpf } from "@/config/documentos";

/** Aba "Dados bancários" de empresas e pessoas: contas e chaves Pix, mascaradas até "mostrar". */

type Alvo = { tipo: "empresa" | "pessoa"; id: string };
type Conta = {
  id: string;
  bancoCodigo: string | null;
  bancoNome: string | null;
  tipoConta: string | null;
  tipoChavePix: string | null;
  principal: boolean;
  agencia: string | null;
  conta: string | null;
  chavePix: string | null;
};
type Legiveis = { agencia: string | null; conta: string | null; chavePix: string | null };

const estiloCampo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";

function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="text-text mb-1 block text-sm font-medium">{texto}</span>
      {children}
    </label>
  );
}

function chaveFormatada(tipo: string | null, chave: string | null) {
  if (!chave) return null;
  if (tipo === "cnpj" && chave.length === 14) return formatarCnpj(chave);
  if (tipo === "cpf" && chave.length === 11) return formatarCpf(chave);
  return chave;
}

function FormConta({
  alvo,
  bancos,
  conta,
  legiveis,
  aoTerminar,
}: {
  alvo: Alvo;
  bancos: Record<string, string>;
  conta?: Conta;
  legiveis?: Legiveis;
  aoTerminar?: () => void;
}) {
  const t = useTranslations("cadastros.contas");
  const tc = useTranslations("comum");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(async (anterior, dados) => {
    const r = await salvarContaBancariaAcao(anterior, dados);
    if (r?.ok) aoTerminar?.();
    return r;
  });
  const [v, setV] = useState<Record<string, string>>({
    bancoCodigo: conta?.bancoCodigo ?? "",
    bancoNome: conta?.bancoNome ?? "",
    agencia: legiveis?.agencia ?? "",
    conta: legiveis?.conta ?? "",
    tipoConta: conta?.tipoConta ?? "corrente",
    chavePix: legiveis?.chavePix ?? "",
    tipoChavePix: conta?.tipoChavePix ?? "",
  });
  const mudar = (n: string, valor: string) =>
    setV((x) => {
      const novo = { ...x, [n]: valor };
      // Código conhecido preenche o nome do banco (se ainda estiver vazio ou for o de outro código).
      if (n === "bancoCodigo") {
        const nome = bancos[valor.padStart(3, "0")];
        if (nome && (!x.bancoNome || Object.values(bancos).includes(x.bancoNome))) novo.bancoNome = nome;
      }
      return novo;
    });
  const campo = (nome: string, rotulo: string, props: React.ComponentProps<"input"> = {}) => (
    <Rotulo texto={rotulo}>
      <input
        {...props}
        name={nome}
        value={v[nome]}
        onChange={(e) => mudar(nome, e.target.value)}
        className={estiloCampo}
      />
    </Rotulo>
  );
  return (
    <form action={salvar} className="border-border mt-3 rounded-md border p-3">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <input type="hidden" name="alvoTipo" value={alvo.tipo} />
      <input type="hidden" name="alvoId" value={alvo.id} />
      {conta && <input type="hidden" name="id" value={conta.id} />}
      <div className="grid gap-x-4 sm:grid-cols-3">
        {campo("bancoCodigo", t("bancoCodigo"), { inputMode: "numeric", maxLength: 3 })}
        <div className="sm:col-span-2">{campo("bancoNome", t("bancoNome"), { maxLength: 120 })}</div>
        {campo("agencia", t("agencia"), { maxLength: 20 })}
        {campo("conta", t("conta"), { maxLength: 30 })}
        <Rotulo texto={t("tipoConta")}>
          <select
            name="tipoConta"
            value={v.tipoConta}
            onChange={(e) => mudar("tipoConta", e.target.value)}
            className={estiloCampo}
          >
            {(["corrente", "poupanca", "pagamento"] as const).map((x) => (
              <option key={x} value={x}>
                {t(`tipos.${x}`)}
              </option>
            ))}
          </select>
        </Rotulo>
        <Rotulo texto={t("tipoChavePix")}>
          <select
            name="tipoChavePix"
            value={v.tipoChavePix}
            onChange={(e) => mudar("tipoChavePix", e.target.value)}
            className={estiloCampo}
          >
            <option value="">{t("semPix")}</option>
            {(["cnpj", "cpf", "email", "telefone", "aleatoria"] as const).map((x) => (
              <option key={x} value={x}>
                {t(`chaves.${x}`)}
              </option>
            ))}
          </select>
        </Rotulo>
        <div className="sm:col-span-2">{campo("chavePix", t("chavePix"), { maxLength: 140 })}</div>
      </div>
      <label className="text-text mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" name="principal" value="sim" defaultChecked={conta?.principal} />{" "}
        {t("principal")}
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {conta ? tc("salvar") : t("adicionar")}
        </button>
        {aoTerminar && (
          <button type="button" onClick={aoTerminar} className="text-muted text-sm">
            {tc("cancelar")}
          </button>
        )}
      </div>
    </form>
  );
}

function ItemDaConta({
  alvo,
  conta,
  bancos,
  podeEditar,
  podeRevelar,
}: {
  alvo: Alvo;
  conta: Conta;
  bancos: Record<string, string>;
  podeEditar: boolean;
  podeRevelar: boolean;
}) {
  const t = useTranslations("cadastros.contas");
  const tc = useTranslations("comum");
  const [legiveis, setLegiveis] = useState<Legiveis | null>(null);
  const [editando, setEditando] = useState(false);
  const [buscando, iniciar] = useTransition();
  const revelar = (depois?: () => void) =>
    iniciar(async () => {
      const r = await revelarContaBancariaAcao(alvo, conta.id);
      if (r) setLegiveis(r);
      depois?.();
    });
  const ver = legiveis ?? conta;
  if (editando && legiveis)
    return (
      <li className="py-2">
        <FormConta
          alvo={alvo}
          bancos={bancos}
          conta={conta}
          legiveis={legiveis}
          aoTerminar={() => setEditando(false)}
        />
      </li>
    );
  const linha = (rotulo: string, valor: string | null) =>
    valor ? (
      <span className="block">
        <span className="text-muted">{rotulo}: </span>
        {valor}
      </span>
    ) : null;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
      <span>
        <span className="font-medium">
          {[conta.bancoCodigo, conta.bancoNome].filter(Boolean).join(" · ") || t("soPix")}
        </span>
        {conta.principal && (
          <span className="text-primary ml-2 text-xs font-medium">{t("principalRotulo")}</span>
        )}
        {linha(t("agencia"), ver.agencia)}
        {linha(conta.tipoConta ? t(`tipos.${conta.tipoConta}`) : t("conta"), ver.conta)}
        {linha(
          conta.tipoChavePix ? t("pixDoTipo", { tipo: t(`chaves.${conta.tipoChavePix}`) }) : t("chavePix"),
          legiveis ? chaveFormatada(conta.tipoChavePix, legiveis.chavePix) : conta.chavePix,
        )}
      </span>
      <span className="flex flex-wrap items-center gap-3">
        {podeRevelar && !legiveis && (
          <button
            type="button"
            disabled={buscando}
            onClick={() => revelar()}
            className="text-primary text-xs font-medium"
          >
            {t("mostrar")}
          </button>
        )}
        {podeEditar && (
          <button
            type="button"
            disabled={buscando}
            onClick={() => (legiveis ? setEditando(true) : revelar(() => setEditando(true)))}
            className="text-primary text-xs font-medium"
          >
            {t("editar")}
          </button>
        )}
        {podeEditar && (
          <BotaoDeAcao
            acao={excluirContaBancariaAcao}
            campos={{ alvoTipo: alvo.tipo, alvoId: alvo.id, id: conta.id }}
            rotulo={tc("excluir")}
            confirmar={t("confirmarExcluir")}
            perigo
          />
        )}
      </span>
    </li>
  );
}

export function ContasBancarias({
  alvo,
  contas,
  bancos,
  podeEditar,
  podeRevelar,
}: {
  alvo: Alvo;
  contas: Conta[];
  bancos: Record<string, string>;
  podeEditar: boolean;
  podeRevelar: boolean;
}) {
  const t = useTranslations("cadastros.contas");
  const [adicionando, setAdicionando] = useState(false);
  return (
    <div>
      <p className="text-muted mb-2 text-sm">{t("explicacao")}</p>
      {contas.length === 0 ? (
        <p className="text-muted text-sm">{t("nenhuma")}</p>
      ) : (
        <ul className="divide-border divide-y">
          {contas.map((c) => (
            <ItemDaConta
              key={c.id}
              alvo={alvo}
              conta={c}
              bancos={bancos}
              podeEditar={podeEditar}
              podeRevelar={podeRevelar}
            />
          ))}
        </ul>
      )}
      {podeEditar &&
        (adicionando ? (
          <FormConta alvo={alvo} bancos={bancos} aoTerminar={() => setAdicionando(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="text-primary mt-3 text-sm font-medium"
          >
            {t("nova")}
          </button>
        ))}
    </div>
  );
}
