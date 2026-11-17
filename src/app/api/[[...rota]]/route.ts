import { api } from "@/server/api/app";

/**
 * Ponte entre o Next.js e o Hono: todas as requisições em /api/* são
 * atendidas pelo Hono (ADR-0004).
 */
const atender = (request: Request) => api.fetch(request);

export const GET = atender;
export const POST = atender;
export const PUT = atender;
export const PATCH = atender;
export const DELETE = atender;
export const OPTIONS = atender;
