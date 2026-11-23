ALTER TABLE "contrato" ADD COLUMN "honorario_variavel" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contrato" ADD COLUMN "variavel_criterio" text;--> statement-breakpoint
ALTER TABLE "contrato" ADD COLUMN "variavel_valor_hora" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "contrato" ADD COLUMN "variavel_percentual" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "contrato" ADD COLUMN "variavel_base" text;--> statement-breakpoint
ALTER TABLE "contrato" ADD COLUMN "variavel_teto" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "contrato" ADD COLUMN "variavel_dia_apuracao" integer;--> statement-breakpoint
ALTER TABLE "contrato" ADD COLUMN "meio_recebimento" text DEFAULT 'conta' NOT NULL;