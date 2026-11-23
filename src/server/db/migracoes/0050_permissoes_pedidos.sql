-- Acesso da aplicação às tabelas dos pedidos de documentos (0049).
GRANT SELECT, INSERT, UPDATE, DELETE ON "pedido_documentos" TO mna_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "pedido_rodada" TO mna_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "pedido_item" TO mna_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "pedido_item_documento" TO mna_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "fonte_de_documento" TO mna_app;
