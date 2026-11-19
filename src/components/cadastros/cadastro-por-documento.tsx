"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import {
  confirmarCadastroAcao,
  proporCadastroAcao,
  type EstadoDoCadastro,
} from "@/app/acoes/cadastro-por-documento";
import type { Proposta } from "@/server/services/cadastro-por-documento";
import { formatarCnpj, mascararCpf } from "@/config/documentos";
import { Aviso, Botao } from "@/components/ui/basicos";

type EmpresaSel = Omit<Proposta["empresas"][number], "socios"> & {
  incluir: boolean;
  completarId: string | null;
  socios: (Proposta["empresas"][number]["socios"][number] & { incluir: boolean })[];
};
type PessoaSel = Proposta["pessoas"][number] & { incluir: boolean };

const CATEGORIAS_EMPRESA = [
  "cartao-cnpj",
  "contrato-social",
  "alteracao-contratual",
  "procuracao",
  "certidao",
  "outro",
];
const CATEGORIAS_PESSOA = ["cpf", "rg", "cnh", "comprovante-endereco", "certidao-estado-civil", "outro"];

const entrada =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-2 py-1 text-sm outline-none";

/**
 * Cadastro a partir de documento (ADR-0021): envia o PDF, confere a proposta
 * (empresas, sócios e outras pessoas encontradas) e grava só o que marcar.
 * O mesmo formulário guarda o arquivo, para virar anexo na confirmação.
 */
export function CadastroPorDocumento() {
  const t = useTranslations("cadastros.porDocumento");
  const tAnexo = useTranslations("cadastros.anexos");
  const form = useRef<HTMLFormElement>(null);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [lida, setLida] = useState<{ temTexto: boolean } | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaSel[]>([]);
  const [pessoas, setPessoas] = useState<PessoaSel[]>([]);
  const [guardar, setGuardar] = useState(true);
  const [categoria, setCategoria] = useState("outro");
  const [resultado, setResultado] = useState<NonNullable<EstadoDoCadastro>["resultado"] | null>(null);

  const ler = () =>
    iniciar(async () => {
      setErro(null);
      setResultado(null);
      const r = await proporCadastroAcao(new FormData(form.current!));
      if (r?.erro || !r?.proposta) {
        setErro(r?.erro ?? null);
        setLida(null);
        return;
      }
      const p = r.proposta;
      setLida({ temTexto: p.temTexto });
      setCategoria(p.categoriaSugerida);
      setEmpresas(
        p.empresas.map((e) => ({
          ...e,
          incluir: true,
          completarId: e.parecida?.id ?? null,
          socios: e.socios.map((s) => ({ ...s, incluir: true })),
        })),
      );
      setPessoas(p.pessoas.map((x) => ({ ...x, incluir: !x.existenteId && !!x.nome })));
    });

  const confirmar = () =>
    iniciar(async () => {
      setErro(null);
      const dados = new FormData(form.current!);
      dados.set("selecao", JSON.stringify({ empresas, pessoas, anexo: { guardar, categoria } }));
      const r = await confirmarCadastroAcao(dados);
      if (r?.erro) setErro(r.erro);
      else if (r?.resultado) {
        setResultado(r.resultado);
        setLida(null);
        form.current?.reset();
      }
    });

  const mudarEmpresa = (i: number, mudanca: Partial<EmpresaSel>) =>
    setEmpresas((l) => l.map((e, j) => (j === i ? { ...e, ...mudanca } : e)));
  const mudarSocio = (i: number, k: number, mudanca: Partial<EmpresaSel["socios"][number]>) =>
    setEmpresas((l) =>
      l.map((e, j) =>
        j === i ? { ...e, socios: e.socios.map((s, m) => (m === k ? { ...s, ...mudanca } : s)) } : e,
      ),
    );
  const mudarPessoa = (i: number, mudanca: Partial<PessoaSel>) =>
    setPessoas((l) => l.map((p, j) => (j === i ? { ...p, ...mudanca } : p)));

  const nada = empresas.length === 0 && pessoas.length === 0;
  const temEmpresaMarcada = empresas.some((e) => e.incluir);
  const categorias = temEmpresaMarcada ? CATEGORIAS_EMPRESA : CATEGORIAS_PESSOA;
  const situacao = (existenteId: string | null) =>
    existenteId ? <span className="text-muted text-xs">{t("jaCadastrada")}</span> : null;

  return (
    <form ref={form} onSubmit={(e) => e.preventDefault()}>
      {erro && <Aviso>{erro}</Aviso>}
      {resultado && (
        <div role="status" className="border-border mb-4 rounded-md border px-3 py-2 text-sm">
          <p className="text-text font-medium">
            {t("resultado", {
              empresas: resultado.empresasCriadas,
              pessoas: resultado.pessoasCriadas,
              vinculos: resultado.vinculosCriados,
            })}
          </p>
          {resultado.anexoGuardado && <p className="text-muted">{t("anexoGuardado")}</p>}
          {resultado.falhasTraduzidas.map((f) => (
            <p key={f} className="text-danger">
              {f}
            </p>
          ))}
          {resultado.destino && (
            <Link href={resultado.destino} className="text-primary font-medium">
              {t("abrirCadastro")}
            </Link>
          )}
        </div>
      )}

      <p className="text-muted mb-3 text-sm">{t("explicacao")}</p>
      <input
        type="file"
        name="arquivo"
        required
        accept="application/pdf,.pdf"
        aria-label={t("arquivo")}
        onChange={() => setLida(null)}
        className="text-muted file:border-border file:bg-background file:text-primary mb-3 block text-xs file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm file:font-medium"
      />
      <Botao type="button" onClick={ler} disabled={pendente}>
        {pendente && !lida ? t("lendo") : t("ler")}
      </Botao>

      {lida && (
        <section aria-label={t("proposta")} className="border-border mt-6 border-t pt-4">
          {!lida.temTexto && <Aviso>{t("semTexto")}</Aviso>}
          {lida.temTexto && nada && <p className="text-muted text-sm">{t("nadaEncontrado")}</p>}

          {empresas.map((e, i) => (
            <fieldset key={e.cnpj} className="border-border mb-4 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={e.incluir}
                    onChange={(x) => mudarEmpresa(i, { incluir: x.target.checked })}
                  />
                  {t("empresa", { cnpj: formatarCnpj(e.cnpj) })}
                </label>
              </legend>
              {situacao(e.existenteId)}
              {!e.consultada && !e.existenteId && (
                <p className="text-warning mb-2 text-xs">{t("semConsulta")}</p>
              )}
              {e.parecida && !e.existenteId && (
                <div className="text-text mb-2 text-xs">
                  <p className="mb-1">{t("parecida", { nome: e.parecida.nome })}</p>
                  <label className="mr-4 inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name={`parecida-${i}`}
                      checked={e.completarId === e.parecida.id}
                      onChange={() => mudarEmpresa(i, { completarId: e.parecida!.id })}
                    />
                    {t("completarParecida")}
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name={`parecida-${i}`}
                      checked={e.completarId === null}
                      onChange={() => mudarEmpresa(i, { completarId: null })}
                    />
                    {t("criarNova")}
                  </label>
                </div>
              )}
              {!e.existenteId && (
                <label className="mb-2 block text-xs">
                  {t("razaoSocial")}
                  <input
                    className={entrada}
                    value={e.razaoSocial}
                    onChange={(x) => mudarEmpresa(i, { razaoSocial: x.target.value })}
                  />
                </label>
              )}
              {e.existenteId && <p className="text-text text-sm">{e.razaoSocial}</p>}
              {e.socios.length > 0 && (
                <>
                  <p className="text-text mt-3 mb-1 text-xs font-medium">{t("socios")}</p>
                  <ul className="space-y-2">
                    {e.socios.map((s, k) => (
                      <li key={`${s.nome}-${k}`} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          aria-label={t("incluirSocio", { nome: s.nome })}
                          checked={s.incluir && e.incluir}
                          disabled={!e.incluir}
                          onChange={(x) => mudarSocio(i, k, { incluir: x.target.checked })}
                          className="mt-1.5"
                        />
                        <span className="min-w-0 flex-1">
                          {s.existenteId ? (
                            <span className="text-text text-sm">{s.nome}</span>
                          ) : (
                            <input
                              className={entrada}
                              aria-label={t("nomeDe", { nome: s.nome })}
                              value={s.nome}
                              onChange={(x) => mudarSocio(i, k, { nome: x.target.value })}
                            />
                          )}
                          <span className="text-muted block text-xs">
                            {[
                              s.qualificacao,
                              s.tipo === "pj" && t("empresaSocia"),
                              s.cpf && `CPF ${mascararCpf(s.cpf)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}{" "}
                            {s.existenteId && `· ${t("jaCadastrada")}`}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </fieldset>
          ))}

          {pessoas.length > 0 && (
            <fieldset className="border-border mb-4 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{t("outrasPessoas")}</legend>
              <ul className="space-y-2">
                {pessoas.map((p, i) => (
                  <li key={p.cpf} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      aria-label={t("incluirPessoa", { cpf: mascararCpf(p.cpf) })}
                      checked={p.incluir}
                      disabled={!!p.existenteId}
                      onChange={(x) => mudarPessoa(i, { incluir: x.target.checked })}
                      className="mt-1.5"
                    />
                    <span className="min-w-0 flex-1">
                      {!p.existenteId && (
                        <input
                          className={entrada}
                          placeholder={t("nomeDaPessoa")}
                          aria-label={t("nomeDaPessoaCpf", { cpf: mascararCpf(p.cpf) })}
                          value={p.nome}
                          onChange={(x) => mudarPessoa(i, { nome: x.target.value })}
                        />
                      )}
                      <span className="text-muted block text-xs">
                        CPF {mascararCpf(p.cpf)} {p.existenteId && `· ${t("jaCadastrada")}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {!nada && (
            <>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={guardar} onChange={(x) => setGuardar(x.target.checked)} />
                {temEmpresaMarcada ? t("guardarNaEmpresa") : t("guardarNaPessoa")}
              </label>
              {guardar && (
                <label className="mb-4 block text-sm">
                  <span className="text-text mb-1 block font-medium">{tAnexo("categoria")}</span>
                  <select
                    value={categorias.includes(categoria) ? categoria : "outro"}
                    onChange={(x) => setCategoria(x.target.value)}
                    className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
                  >
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        {tAnexo(`categorias.${c}` as "categorias.outro")}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Botao type="button" onClick={confirmar} disabled={pendente}>
                {pendente ? t("cadastrando") : t("cadastrar")}
              </Botao>
            </>
          )}
        </section>
      )}
    </form>
  );
}
