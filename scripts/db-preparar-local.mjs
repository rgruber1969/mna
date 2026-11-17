// Prepara o banco LOCAL (Docker) para a aplicação e os testes:
// 1. cria o usuário de login da aplicação (mna_app_login), membro de mna_app;
// 2. cria o banco de testes (mna_teste).
// Uso: pnpm db:preparar   (depois: pnpm db:migrar e pnpm db:migrar:teste)
// Só para desenvolvimento: as senhas vêm do .env local.
import pg from "pg";

try {
  process.loadEnvFile();
} catch {}

const urlDono = process.env.DATABASE_URL_MIGRACAO;
const senhaApp = process.env.APP_DB_PASSWORD;
if (!urlDono || !senhaApp) {
  console.error("Defina DATABASE_URL_MIGRACAO e APP_DB_PASSWORD no .env (veja .env.example).");
  process.exit(1);
}

const dono = new pg.Client({ connectionString: urlDono });
await dono.connect();

await dono.query(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mna_app') THEN
      CREATE ROLE mna_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mna_app_login') THEN
      CREATE ROLE mna_app_login LOGIN NOSUPERUSER NOBYPASSRLS IN ROLE mna_app;
    END IF;
  END $$;`);
await dono.query(`ALTER ROLE mna_app_login PASSWORD ${pg.escapeLiteral(senhaApp)}`);
console.log("Usuário mna_app_login pronto (membro de mna_app).");

const existe = await dono.query("SELECT 1 FROM pg_database WHERE datname = 'mna_teste'");
if (existe.rowCount === 0) {
  await dono.query("CREATE DATABASE mna_teste");
  console.log("Banco de testes mna_teste criado.");
} else {
  console.log("Banco de testes mna_teste já existe.");
}

await dono.end();
