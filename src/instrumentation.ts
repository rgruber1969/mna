/**
 * Conferências de partida (Next.js chama `register` uma vez, ao iniciar o
 * servidor): a aplicação recusa iniciar em produção com a entrada de
 * desenvolvimento ligada ou com alguma funcionalidade simulada.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { conferirFuncionalidadesSimuladas } = await import("@/config/funcionalidades");
  const { conferirEntradaDeDesenvolvimento } = await import("@/server/auth/entrada-de-desenvolvimento");
  conferirFuncionalidadesSimuladas();
  conferirEntradaDeDesenvolvimento();
}
