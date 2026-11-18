import { produto } from "@/config/produto";
import { LogoRgruber, TelaEntrar } from "@/components/acesso/telas";

/** Entrada do console: identidade da RGRUBER, fundo escuro da marca. */
export default function Page() {
  return <TelaEntrar titulo={`Console do Administrador do ${produto.nome}`} marca={<LogoRgruber />} />;
}
