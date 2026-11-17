// Prepara o armazenamento LOCAL (RustFS no Docker): cria o bucket privado e
// libera o envio direto do navegador (CORS) para os endereços locais.
// Uso: pnpm arquivos:preparar
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

try {
  process.loadEnvFile();
} catch {}

const bucket = process.env.S3_BUCKET;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});

try {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`Bucket ${bucket} já existe.`);
} catch {
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`Bucket ${bucket} criado (privado).`);
}

await s3.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["http://localhost:3000", "http://*.localhost:3000"],
          AllowedMethods: ["PUT", "GET"],
          AllowedHeaders: ["*"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
console.log("Envio direto do navegador liberado para os endereços locais.");
