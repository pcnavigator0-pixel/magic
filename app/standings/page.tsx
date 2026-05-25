import { PublicPageShell } from "@/app/components/public-shell";
import { buildStandings, getMagicData } from "@/lib/magic-data";

export default async function StandingsPage() {
  const data = await getMagicData();
  const standings = buildStandings(data.matches);

  return (
    <PublicPageShell
      eyebrow="Standings"
      title="League table"
      description="Track positions, played games, wins, losses, and points from final match results."
    >
      <section className="public-table-wrap">
        <table className="standings-table public-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>Played</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, index) => (
              <tr key={row.team}>
                <td>{index + 1}</td>
                <td>{row.team}</td>
                <td>{row.played}</td>
                <td>{row.wins}</td>
                <td>{row.losses}</td>
                <td>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {standings.length === 0 && <p className="public-empty">No final results are available yet.</p>}
    </PublicPageShell>
  );
}
