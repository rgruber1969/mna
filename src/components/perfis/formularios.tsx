"use client";

import {
  copiarMatrizIndividualAcao,
  criarPerfilAcao,
  definirPerfisDoUsuarioAcao,
  editarPerfilAcao,
  salvarMatrizDoPerfilAcao,
  salvarMatrizIndividualAcao,
} from "@/app/acoes/perfis";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, Botao, CaixaComDescricao, Campo } from "@/components/ui/basicos";
import {
  ACOES,
  RECURSOS,
  SIGLAS,
  type Acao,
  type Matriz,
  type Recurso,
} from "@/server/services/permissoes/catalogo";

const notaDe = (r: Recurso): string | undefined => (RECURSOS[r] as { nota?: string }).nota;

/** Colunas da grade: todas as ações usadas pelos recursos mostrados. */
function colunas(recursos: Recurso[]): Acao[] {
  const usadas = new Set(recursos.flatMap((r) => RECURSOS[r].acoes));
  return (Object.keys(ACOES) as Acao[]).filter((a) => usadas.has(a));
}

/**
 * Grade recurso × ação. Editável (caixas "m" = "recurso:acao") ou só leitura.
 * Ações que não se aplicam ao recurso aparecem como "—".
 */
export function GradeDaMatriz({
  recursos,
  matriz,
  editavel = false,
}: {
  recursos: Recurso[];
  matriz: Matriz;
  editavel?: boolean;
}) {
  const acoes = colunas(recursos);
  return (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-2 pr-3 text-left font-medium">Menu</th>
            {acoes.map((a) => (
              <th key={a} className="px-1 py-2 text-center font-medium" title={ACOES[a]}>
                {SIGLAS[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {recursos.map((r) => (
            <tr key={r}>
              <td className="text-text py-2 pr-3">
                {RECURSOS[r].nome}
                {notaDe(r) && <span className="text-muted block text-xs">{notaDe(r)}</span>}
              </td>
              {acoes.map((a) => {
                const aplica = (RECURSOS[r].acoes as readonly Acao[]).includes(a);
                const marcado = matriz[r]?.includes(a) ?? false;
                return (
                  <td key={a} className="px-1 py-2 text-center">
                    {!aplica ? (
                      <span className="text-muted">—</span>
                    ) : editavel ? (
                      <input
                        type="checkbox"
                        name="m"
                        value={`${r}:${a}`}
                        defaultChecked={marcado}
                        aria-label={`${RECURSOS[r].nome}: ${ACOES[a]}`}
                      />
                    ) : marcado ? (
                      <span className="text-success" aria-label={`${RECURSOS[r].nome}: ${ACOES[a]}`}>
                        ✓
                      </span>
                    ) : (
                      <span className="text-muted">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted mt-2 text-xs">
        {acoes.map((a) => `${SIGLAS[a]} = ${ACOES[a].toLowerCase()}`).join(" · ")}
      </p>
    </div>
  );
}

export function FormMatrizDoPerfil({
  id,
  recursos,
  matriz,
}: {
  id: string;
  recursos: Recurso[];
  matriz: Matriz;
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(salvarMatrizDoPerfilAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={id} />
      <GradeDaMatriz recursos={recursos} matriz={matriz} editavel />
      <Botao disabled={enviando}>{enviando ? "Salvando..." : "Salvar permissões"}</Botao>
    </form>
  );
}

export function FormMatrizIndividual({
  usuarioId,
  perfilId,
  recursos,
  matriz,
}: {
  usuarioId: string;
  perfilId: string;
  recursos: Recurso[];
  matriz: Matriz;
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(salvarMatrizIndividualAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={usuarioId} />
      <input type="hidden" name="perfil" value={perfilId} />
      <GradeDaMatriz recursos={recursos} matriz={matriz} editavel />
      <Botao disabled={enviando}>{enviando ? "Salvando..." : "Salvar permissões do usuário"}</Botao>
    </form>
  );
}

export function FormCopiarMatriz({
  usuarioId,
  perfilId,
  outros,
}: {
  usuarioId: string;
  perfilId: string;
  outros: { id: string; nome: string }[];
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(copiarMatrizIndividualAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={usuarioId} />
      <input type="hidden" name="perfil" value={perfilId} />
      <label className="mb-4 block">
        <span className="text-text mb-1 block text-sm font-medium">Copiar permissões de</span>
        <select
          name="origem"
          defaultValue="perfil"
          className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="perfil">Matriz do perfil (desfaz a personalização)</option>
          {outros.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>
      <Botao disabled={enviando}>{enviando ? "Copiando..." : "Copiar"}</Botao>
    </form>
  );
}

export function FormNovoPerfil({ perfis }: { perfis: { id: string; nome: string; camada: string }[] }) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(criarPerfilAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo rotulo="Nome do perfil" name="nome" required />
      <CampoDescricao />
      <fieldset className="mb-4">
        <legend className="text-text mb-1 text-sm font-medium">Camada</legend>
        <label className="text-text flex items-center gap-2 text-sm">
          <input type="radio" name="camada" value="tenant" required /> Perfil do tenant (fora dos deals)
        </label>
        <label className="text-text flex items-center gap-2 text-sm">
          <input type="radio" name="camada" value="deal" /> Perfil de deal (escolhido em cada deal)
        </label>
      </fieldset>
      <label className="mb-4 block">
        <span className="text-text mb-1 block text-sm font-medium">Começar com as permissões de</span>
        <select
          name="copiarDe"
          defaultValue=""
          className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Nenhuma (tudo desmarcado)</option>
          {perfis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.camada === "tenant" ? "tenant" : "deal"})
            </option>
          ))}
        </select>
      </label>
      <Botao disabled={enviando}>{enviando ? "Criando..." : "Criar perfil"}</Botao>
    </form>
  );
}

export function FormEditarPerfil({ id, nome, descricao }: { id: string; nome: string; descricao: string }) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(editarPerfilAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={id} />
      <Campo rotulo="Nome do perfil" name="nome" defaultValue={nome} required />
      <CampoDescricao defaultValue={descricao} />
      <Botao disabled={enviando}>{enviando ? "Salvando..." : "Salvar"}</Botao>
    </form>
  );
}

function CampoDescricao({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <label className="mb-4 block">
      <span className="text-text mb-1 block text-sm font-medium">
        Para que serve (aparece ao atribuir o perfil)
      </span>
      <textarea
        name="descricao"
        defaultValue={defaultValue}
        maxLength={400}
        rows={3}
        className="border-border bg-background text-text focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}

/** Caixas dos perfis do tenant, com a explicação de cada um. */
export function CaixasDePerfis({
  perfis,
  marcados = [],
}: {
  perfis: { id: string; nome: string; descricao: string }[];
  marcados?: string[];
}) {
  if (perfis.length === 0)
    return <p className="text-muted mb-4 text-sm">Nenhum perfil do tenant cadastrado.</p>;
  return (
    <fieldset className="mb-4">
      <legend className="text-text mb-2 text-sm font-medium">
        Perfis no tenant (as permissões se somam)
      </legend>
      {perfis.map((p) => (
        <CaixaComDescricao
          key={p.id}
          name="perfil"
          value={p.id}
          titulo={p.nome}
          descricao={p.descricao}
          defaultChecked={marcados.includes(p.id)}
        />
      ))}
    </fieldset>
  );
}

export function FormPerfisDoUsuario({
  usuarioId,
  perfis,
  marcados,
}: {
  usuarioId: string;
  perfis: { id: string; nome: string; descricao: string }[];
  marcados: string[];
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(definirPerfisDoUsuarioAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={usuarioId} />
      <CaixasDePerfis perfis={perfis} marcados={marcados} />
      <Botao disabled={enviando}>{enviando ? "Salvando..." : "Salvar perfis"}</Botao>
    </form>
  );
}
