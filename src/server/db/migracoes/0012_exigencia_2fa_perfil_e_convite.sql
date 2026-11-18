ALTER TABLE "convite" ADD COLUMN "exige_2fa" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "perfil" ADD COLUMN "exige_2fa" boolean DEFAULT false NOT NULL;