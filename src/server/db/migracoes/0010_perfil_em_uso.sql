ALTER TABLE "perfil_usuario" DROP CONSTRAINT "perfil_usuario_perfil_id_perfil_id_fk";
--> statement-breakpoint
ALTER TABLE "perfil_usuario" ADD CONSTRAINT "perfil_usuario_perfil_id_perfil_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil"("id") ON DELETE no action ON UPDATE no action;