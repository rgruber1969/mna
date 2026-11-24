-- Acesso da aplicação (mna_app) às tabelas do e-book; o isolamento continua pelo RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON "ebook_versao" TO mna_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "ebook_comentario" TO mna_app;
