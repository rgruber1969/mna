"use client";

import { useState } from "react";
import { enviarFotoAcao, removerFotoAcao } from "@/app/acoes/conta";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, Avatar, Botao } from "@/components/ui/basicos";

/** Envio e remoção da foto da própria conta (até 2 MB; JPG, PNG ou WebP). */
export function FormFoto({ nome, foto }: { nome: string; foto?: string | null }) {
  const [estado, enviar, enviando] = useAcaoComAtualizacao(enviarFotoAcao);
  const [estadoRemocao, remover, removendo] = useAcaoComAtualizacao(removerFotoAcao);
  const [previa, setPrevia] = useState<string | null>(null);
  const mensagem = estado ?? estadoRemocao;

  return (
    <div>
      {mensagem?.erro && <Aviso>{mensagem.erro}</Aviso>}
      {mensagem?.ok && <Aviso tipo="ok">{mensagem.ok}</Aviso>}
      <div className="mb-4 flex items-center gap-4">
        <Avatar nome={nome} foto={previa ?? foto} tamanho={72} />
        <p className="text-muted text-xs">
          Aparece ao lado do seu nome, em todos os lugares onde você tem acesso. Recortada em quadrado; os
          dados da imagem (como local e câmera) são apagados.
        </p>
      </div>
      <form action={enviar}>
        <label className="mb-4 block">
          <span className="text-text mb-1 block text-sm font-medium">
            Escolher imagem (JPG, PNG ou WebP, até 2 MB)
          </span>
          <input
            type="file"
            name="foto"
            accept="image/jpeg,image/png,image/webp"
            required
            className="text-text block w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPrevia(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
        <Botao disabled={enviando}>{enviando ? "Enviando..." : "Salvar foto"}</Botao>
      </form>
      {foto && (
        <form action={remover} className="mt-3">
          <button disabled={removendo} className="text-danger text-sm font-medium disabled:opacity-60">
            {removendo ? "Removendo..." : "Remover foto"}
          </button>
        </form>
      )}
    </div>
  );
}
