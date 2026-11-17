import { TelaLink } from "@/components/acesso/telas";

export default function Page({ params }: PageProps<"/t/[slug]/link/[token]">) {
  return <TelaLink token={params.then((p) => p.token)} />;
}
