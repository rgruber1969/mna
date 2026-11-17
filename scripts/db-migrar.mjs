// Aplica as migrações em ordem, com o usuário dono das tabelas.
// Uso: pnpm db:migrar          (banco da aplicação)
//      pnpm db:migrar:teste    (banco de testes)
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

try {
  process.loadEnvFile();
} catch {}

const alvo = process.argv[2] === "teste" ? "DATABASE_URL_MIGRACAO_TESTE" : "DATABASE_URL_MIGRACAO";
const url = process.env[alvo];
if (!url) {
  console.error(`Defina ${alvo} (veja .env.example).`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
await migrate(drizzle(pool), { migrationsFolder: "./src/server/db/migracoes" });
await pool.end();
console.log(`Migrações aplicadas (${alvo}).`);
