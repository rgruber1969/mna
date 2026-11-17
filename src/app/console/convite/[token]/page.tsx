import { TelaConvite } from "@/components/acesso/telas";

export default function Page({ params }: PageProps<"/console/convite/[token]">) {
  return <TelaConvite token={params.then((p) => p.token)} />;
}
