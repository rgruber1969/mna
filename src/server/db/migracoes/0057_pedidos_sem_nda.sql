ALTER TABLE "categoria_documento" ADD COLUMN "sem_nda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pedido_item_documento" ADD COLUMN "aguardando_aprovacao" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pedido_item_documento" ADD COLUMN "aprovado_por" uuid;--> statement-breakpoint
ALTER TABLE "pedido_item_documento" ADD COLUMN "aprovado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedido_item_documento" ADD CONSTRAINT "pedido_item_documento_aprovado_por_usuario_id_fk" FOREIGN KEY ("aprovado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;