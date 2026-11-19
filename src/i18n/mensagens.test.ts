import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDIOMA_PADRAO, IDIOMAS } from "./idiomas";

/** Arquivos de mensagens (ADR-0020): todo idioma tem exatamente as chaves do padrão. */
const pasta = join(__dirname, "mensagens");
const ler = (idioma: string) => JSON.parse(readFileSync(join(pasta, `${idioma}.json`), "utf8"));

function chaves(o: Record<string, unknown>, prefixo = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? chaves(v as Record<string, unknown>, `${prefixo}${k}.`) : [`${prefixo}${k}`],
  );
}

describe("mensagens", () => {
  it("existe um arquivo para cada idioma declarado, e só eles", () => {
    const arquivos = readdirSync(pasta)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
    expect(arquivos.sort()).toEqual([...IDIOMAS].sort());
  });

  it("todos os idiomas têm as mesmas chaves do padrão, sem textos vazios", () => {
    const padrao = chaves(ler(IDIOMA_PADRAO)).sort();
    for (const idioma of IDIOMAS) {
      const m = ler(idioma);
      expect(chaves(m).sort(), idioma).toEqual(padrao);
      for (const c of padrao) {
        const valor = c
          .split(".")
          .reduce((o: Record<string, unknown>, p) => o[p] as Record<string, unknown>, m);
        expect(String(valor).trim(), `${idioma}: ${c}`).not.toBe("");
      }
    }
  });
});
