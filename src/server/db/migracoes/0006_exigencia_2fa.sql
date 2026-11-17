ALTER TABLE "tenant" ADD COLUMN "exige_2fa_de_todos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vinculo_tenant" ADD COLUMN "exige_2fa" boolean DEFAULT false NOT NULL;