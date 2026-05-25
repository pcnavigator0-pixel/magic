import { PublicPageShell } from "@/app/components/public-shell";
import { getMagicData } from "@/lib/magic-data";
import { RosterPlayerList } from "./roster-player-list";

export default async function RosterPage() {
  const data = await getMagicData();

  return (
    <PublicPageShell
      eyebrow="Roster"
      title="MAGIC BBC players"
      description="Meet the full team roster and follow player updates as the squad grows."
    >
      <RosterPlayerList players={data.players} />
      {data.players.length === 0 && <p className="public-empty">No players have been added yet.</p>}
    </PublicPageShell>
  );
}
