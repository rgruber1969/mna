import { TelaLink } from "@/components/acesso/telas";

export default function Page({ params }: PageProps<"/console/link/[token]">) {
  return <TelaLink token={params.then((p) => p.token)} />;
}
