CREATE TABLE "chave_de_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"nome" text,
	"chave_publica" text NOT NULL,
	"id_credencial" text NOT NULL,
	"contador" integer NOT NULL,
	"tipo_dispositivo" text NOT NULL,
	"com_copia" boolean NOT NULL,
	"transportes" text,
	"aaguid" text,
	"criado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sessao" ADD COLUMN "segundo_fator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chave_de_acesso" ADD CONSTRAINT "chave_de_acesso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chave_de_acesso_usuario_idx" ON "chave_de_acesso" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "chave_de_acesso_credencial_idx" ON "chave_de_acesso" USING btree ("id_credencial");