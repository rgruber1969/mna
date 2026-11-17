import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Módulo único de armazenamento de arquivos (ADR-0012).
 * Só este diretório importa o SDK S3. O mesmo código atende os três
 * ambientes, mudando apenas a configuração:
 *   local: RustFS (Docker) · demonstração: Cloudflare R2 · produção: AWS S3 SP.
 *
 * Regras: armazenamento privado; links temporários emitidos SOMENTE pela
 * camada de serviços, depois de verificar a permissão e registrar a auditoria;
 * download sempre como anexo (ADR-0016).
 */

/** Validade padrão dos links temporários, em segundos. */
export const VALIDADE_LINK_SEGUNDOS = 300;

function configuracao() {
  const obrigatoria = (nome: string) => {
    const valor = process.env[nome];
    if (!valor) throw new Error(`${nome} não definida (veja .env.example).`);
    return valor;
  };
  return {
    bucket: obrigatoria("S3_BUCKET"),
    cliente: new S3Client({
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: obrigatoria("S3_ACCESS_KEY"),
        secretAccessKey: obrigatoria("S3_SECRET_KEY"),
      },
    }),
  };
}

let atual: ReturnType<typeof configuracao> | undefined;
const s3 = () => (atual ??= configuracao());

/** Monta a chave do arquivo sempre sob o tenant (permite exportar ou excluir tudo de um tenant). */
export function chaveDoArquivo(tenantId: string, ...partes: string[]): string {
  const seguro = (p: string) => {
    if (!/^[\w.-]+$/.test(p)) throw new Error(`Parte de chave inválida: ${p}`);
    return p;
  };
  return ["tenant", seguro(tenantId), ...partes.map(seguro)].join("/");
}

/** Link temporário para o navegador enviar o arquivo direto ao armazenamento. */
export async function gerarLinkDeEnvio(
  chave: string,
  tipoDeConteudo: string,
  validadeSegundos = VALIDADE_LINK_SEGUNDOS,
): Promise<string> {
  const { cliente, bucket } = s3();
  return getSignedUrl(
    cliente,
    new PutObjectCommand({ Bucket: bucket, Key: chave, ContentType: tipoDeConteudo }),
    {
      expiresIn: validadeSegundos,
    },
  );
}

/** Link temporário de download, sempre como anexo (nunca exibido dentro do sistema). */
export async function gerarLinkDeDownload(
  chave: string,
  nomeDoArquivo: string,
  validadeSegundos = VALIDADE_LINK_SEGUNDOS,
): Promise<string> {
  const { cliente, bucket } = s3();
  const nome = encodeURIComponent(nomeDoArquivo);
  return getSignedUrl(
    cliente,
    new GetObjectCommand({
      Bucket: bucket,
      Key: chave,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${nome}`,
    }),
    { expiresIn: validadeSegundos },
  );
}
