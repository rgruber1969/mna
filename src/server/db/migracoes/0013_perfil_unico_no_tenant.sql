DROP INDEX "perfil_usuario_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "perfil_usuario_uq" ON "perfil_usuario" USING btree ("tenant_id","usuario_id");