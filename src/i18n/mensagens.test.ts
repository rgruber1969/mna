import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDIOMA_PADRAO, IDIOMAS } from "./idiomas";
import { AREAS } from "./mensagens";

/** Arquivos de mensagens (ADR-0020): todo idioma tem exatamente as chaves do padrão. */
const pasta = join(__dirname, "mensagens");
const ler = (idioma: string, area: string) =>
  JSON.parse(readFileSync(join(pasta, idioma, `${area}.json`), "utf8")) as Record<string, unknown>;

function chaves(o: Record<string, unknown>, prefixo = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? chaves(v as Record<string, unknown>, `${prefixo}${k}.`) : [`${prefixo}${k}`],
  );
}

describe("mensagens", () => {
  it("existe uma pasta para cada idioma declarado, com um arquivo por área", () => {
    expect(readdirSync(pasta).sort()).toEqual([...IDIOMAS].sort());
    for (const idioma of IDIOMAS)
      expect(readdirSync(join(pasta, idioma)).sort()).toEqual(AREAS.map((a) => `${a}.json`).sort());
  });

  it("cada área usa chaves de primeiro nível próprias (sem sobrepor outra área)", () => {
    const vistas = new Map<string, string>();
    for (const area of AREAS)
      for (const k of Object.keys(ler(IDIOMA_PADRAO, area))) {
        expect(vistas.get(k), `"${k}" em ${area} e ${vistas.get(k)}`).toBeUndefined();
        vistas.set(k, area);
      }
  });

  it("todos os idiomas têm as mesmas chaves do padrão, sem textos vazios", () => {
    for (const area of AREAS) {
      const padrao = chaves(ler(IDIOMA_PADRAO, area)).sort();
      for (const idioma of IDIOMAS) {
        const m = ler(idioma, area);
        expect(chaves(m).sort(), `${idioma}/${area}`).toEqual(padrao);
        for (const c of padrao) {
          const valor = c
            .split(".")
            .reduce((o: Record<string, unknown>, p) => o[p] as Record<string, unknown>, m);
          expect(String(valor).trim(), `${idioma}/${area}: ${c}`).not.toBe("");
        }
      }
    }
  });
});
