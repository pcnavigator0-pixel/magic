import { PublicFooter } from "@/app/components/public-shell";
import { SiteHeader } from "@/app/components/site-header";
import { getMagicData } from "@/lib/magic-data";
import { MatchesBoard } from "./matches-board";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const data = await getMagicData();

  return (
    <>
      <SiteHeader />
      <MatchesBoard matches={data.matches} players={data.players} />
      <PublicFooter />
    </>
  );
}
