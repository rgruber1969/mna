import { LogoRgruber, TelaEntrar } from "@/components/acesso/telas";

/** Entrada do console: identidade da RGRUBER, fundo escuro da marca. */
export default function Page() {
  return <TelaEntrar onde="o console" marca={<LogoRgruber />} />;
}
