// Backup criptografado dos dados LOCAIS de desenvolvimento (adendo ao ADR-0002).
// Junta num único arquivo trancado com senha (AES-256-GCM, chave derivada por scrypt):
//   - o banco local `mna` (pg_dump do container do Docker);
//   - todos os arquivos do armazenamento local (RustFS);
//   - o próprio .env (chaves e senhas locais).
// O arquivo vai para backup/mna-backup.enc e sobe no git push; o histórico do
// Git guarda as versões anteriores.
//
// Uso:
//   pnpm backup:gerar                       gera/atualiza backup/mna-backup.enc
//   pnpm backup:conferir                    abre o backup e mostra o conteúdo (não altera nada)
//   pnpm backup:restaurar -- --confirmar    SUBSTITUI o banco e os arquivos locais pelo backup
//
// Senha: variável BACKUP_SENHA no .env (ou no ambiente, num computador novo).
// Guarde a mesma senha no seu gerenciador de senhas: sem ela o backup não abre.
// Só para o ambiente local: recusa rodar com armazenamento ou banco fora do computador.
import { spawnSync } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

try {
  process.loadEnvFile();
} catch {}

const ARQUIVO = "backup/mna-backup.enc";
const ASSINATURA = Buffer.from("MNABKP1\n");
const PARAMETROS_SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

const comando = process.argv[2];
const confirmado = process.argv.includes("--confirmar");

function sair(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

function senha() {
  const s = process.env.BACKUP_SENHA;
  if (!s) {
    sair(
      "Defina BACKUP_SENHA no .env (a mesma guardada no seu gerenciador de senhas). " +
        "Num computador novo, defina-a no terminal antes de restaurar.",
    );
  }
  if (s.length < 16) sair("BACKUP_SENHA precisa ter ao menos 16 caracteres.");
  return s;
}

function exigirLocal() {
  const endpoint = process.env.S3_ENDPOINT ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(endpoint)) {
    sair("O backup local só roda com o armazenamento local (S3_ENDPOINT em 127.0.0.1/localhost).");
  }
}

function s3() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  });
}

/** Roda um comando no container do banco (docker compose), devolvendo a saída binária. */
function noBanco(args, entrada) {
  const r = spawnSync("docker", ["compose", "exec", "-T", "db", ...args], {
    input: entrada,
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (r.error) sair(`Não consegui chamar o Docker: ${r.error.message}`);
  if (r.status !== 0) sair(`Falha no banco (${args[0]}):\n${r.stderr.toString()}`);
  return r.stdout;
}

const usuarioDoBanco = () => process.env.POSTGRES_USER ?? "mna";
const nomeDoBanco = () => process.env.POSTGRES_DB ?? "mna";

function trancar(dados, s) {
  const sal = randomBytes(16);
  const iv = randomBytes(12);
  const chave = scryptSync(s, sal, 32, PARAMETROS_SCRYPT);
  const cifra = createCipheriv("aes-256-gcm", chave, iv);
  const corpo = Buffer.concat([cifra.update(dados), cifra.final()]);
  return Buffer.concat([ASSINATURA, sal, iv, cifra.getAuthTag(), corpo]);
}

function destrancar(bruto, s) {
  if (!bruto.subarray(0, ASSINATURA.length).equals(ASSINATURA)) sair("Arquivo de backup não reconhecido.");
  let pos = ASSINATURA.length;
  const sal = bruto.subarray(pos, (pos += 16));
  const iv = bruto.subarray(pos, (pos += 12));
  const etiqueta = bruto.subarray(pos, (pos += 16));
  const chave = scryptSync(s, sal, 32, PARAMETROS_SCRYPT);
  const decifra = createDecipheriv("aes-256-gcm", chave, iv);
  decifra.setAuthTag(etiqueta);
  try {
    return Buffer.concat([decifra.update(bruto.subarray(pos)), decifra.final()]);
  } catch {
    return sair("Senha errada ou backup corrompido.");
  }
}

function lerBackup() {
  if (!existsSync(ARQUIVO)) sair(`Não encontrei ${ARQUIVO}.`);
  return JSON.parse(gunzipSync(destrancar(readFileSync(ARQUIVO), senha())).toString("utf8"));
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function gerar() {
  exigirLocal();
  const s = senha();

  const banco = noBanco(["pg_dump", "-U", usuarioDoBanco(), "-d", nomeDoBanco(), "-Fc"]);

  const cliente = s3();
  const bucket = process.env.S3_BUCKET;
  const arquivos = [];
  let token;
  do {
    const lista = await cliente.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const item of lista.Contents ?? []) {
      const obj = await cliente.send(new GetObjectCommand({ Bucket: bucket, Key: item.Key }));
      const conteudo = Buffer.from(await obj.Body.transformToByteArray());
      arquivos.push({
        chave: item.Key,
        tipo: obj.ContentType ?? "application/octet-stream",
        conteudo: conteudo.toString("base64"),
      });
    }
    token = lista.IsTruncated ? lista.NextContinuationToken : undefined;
  } while (token);

  const env = existsSync(".env") ? readFileSync(".env", "utf8") : null;
  const pacote = {
    versao: 1,
    criadoEm: new Date().toISOString(),
    banco: { nome: nomeDoBanco(), dump: banco.toString("base64") },
    arquivos: { bucket, itens: arquivos },
    env,
  };

  mkdirSync("backup", { recursive: true });
  const trancado = trancar(gzipSync(Buffer.from(JSON.stringify(pacote))), s);
  writeFileSync(ARQUIVO, trancado);
  console.log(
    `Backup gerado em ${ARQUIVO} (${kb(trancado.length)}): banco ${kb(banco.length)}, ` +
      `${arquivos.length} arquivo(s), .env ${env ? "incluído" : "ausente"}.`,
  );
}

function conferir() {
  const p = lerBackup();
  const bytes = p.arquivos.itens.reduce((t, a) => t + Buffer.from(a.conteudo, "base64").length, 0);
  console.log(`Backup de ${p.criadoEm} aberto com sucesso.`);
  console.log(`  Banco "${p.banco.nome}": ${kb(Buffer.from(p.banco.dump, "base64").length)}`);
  console.log(`  Arquivos: ${p.arquivos.itens.length} (${kb(bytes)}) do bucket "${p.arquivos.bucket}"`);
  console.log(`  .env: ${p.env ? "incluído" : "ausente"}`);
}

async function restaurar() {
  if (!confirmado) {
    sair(
      "A restauração SUBSTITUI o banco local e os arquivos locais pelo conteúdo do backup.\n" +
        "Para continuar: pnpm backup:restaurar -- --confirmar",
    );
  }
  const p = lerBackup();

  // .env: nunca sobrescreve um existente; num computador novo, recria.
  if (p.env) {
    if (existsSync(".env")) {
      writeFileSync(".env.restaurado", p.env);
      console.log(".env já existe: o do backup foi salvo em .env.restaurado (compare e ajuste).");
    } else {
      writeFileSync(".env", p.env);
      console.log(
        ".env recriado a partir do backup. Agora rode `pnpm db:preparar` e repita " +
          "`pnpm backup:restaurar -- --confirmar` para restaurar o banco e os arquivos.",
      );
      return;
    }
  }
  exigirLocal();

  noBanco(
    [
      "pg_restore",
      "-U",
      usuarioDoBanco(),
      "-d",
      nomeDoBanco(),
      "--clean",
      "--if-exists",
      "--single-transaction",
    ],
    Buffer.from(p.banco.dump, "base64"),
  );
  console.log(`Banco "${nomeDoBanco()}" restaurado.`);

  const cliente = s3();
  const bucket = process.env.S3_BUCKET;
  try {
    await cliente.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await cliente.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  for (const a of p.arquivos.itens) {
    await cliente.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: a.chave,
        Body: Buffer.from(a.conteudo, "base64"),
        ContentType: a.tipo,
      }),
    );
  }
  console.log(`${p.arquivos.itens.length} arquivo(s) restaurado(s) no bucket "${bucket}".`);
}

if (comando === "gerar") await gerar();
else if (comando === "conferir") conferir();
else if (comando === "restaurar") await restaurar();
else sair("Uso: node scripts/backup-local.mjs gerar | conferir | restaurar --confirmar");
