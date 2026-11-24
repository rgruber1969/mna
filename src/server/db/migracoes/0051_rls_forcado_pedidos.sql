-- RLS forçado também para o dono das tabelas (como nas demais tabelas de negócio).
ALTER TABLE "pedido_documentos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pedido_rodada" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pedido_item" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pedido_item_documento" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fonte_de_documento" FORCE ROW LEVEL SECURITY;
