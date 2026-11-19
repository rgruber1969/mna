import type { Metadata } from "next";
import { Inter, Lato, Manrope, Montserrat, Open_Sans, Roboto } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { produto } from "@/config/produto";
import { IDIOMA_PADRAO } from "@/i18n/idiomas";
import { SCRIPT_DO_TEMA } from "@/components/acesso/tema";
import "./globals.css";

// Fontes da lista curta do white label (src/config/marca.ts). Só a escolhida
// pelo tenant é baixada pelo navegador; as outras ficam apenas declaradas.
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], preload: false });
const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], preload: false });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], preload: false });

// Lato não é variável e não tem pesos 500/600: declara 400, 700 e 900; "médio" e
// "seminegrito" usam o peso mais próximo.
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  preload: false,
});

const fontes = [manrope, inter, roboto, openSans, montserrat, lato].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: produto.nome,
  description: `${produto.nome}: gestão de processos de M&A`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={IDIOMA_PADRAO} className={`${fontes} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Tema claro/escuro antes da primeira pintura (sem "piscar"). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
