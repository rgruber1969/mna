/** Baixa no navegador um arquivo recebido em base64 de uma ação do servidor. */
export function baixarBase64(conteudo: string, nome: string, tipo: string) {
  const bytes = Uint8Array.from(atob(conteudo), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
