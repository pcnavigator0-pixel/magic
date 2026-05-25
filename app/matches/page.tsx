import { PublicPageShell } from "@/app/components/public-shell";
import { formatDisplayDate, getMagicData } from "@/lib/magic-data";

export default async function MatchesPage() {
  const data = await getMagicData();

  return (
    <PublicPageShell
      eyebrow="Matches"
      title="Scores and fixtures"
      description="Review recent results and upcoming games from the MAGIC BBC match archive."
    >
      <section className="public-list">
        {data.matches.map((match) => (
          <article className="public-row match-public-row" key={match.id}>
            <div className="public-score">
              <strong>{match.home_score} - {match.away_score}</strong>
              <span>{match.status}</span>
            </div>
            <div>
              <span>{match.league}</span>
              <h2>MAGIC BBC vs {match.opponent_name || "Opponent"}</h2>
              <p>{formatDisplayDate(match.match_date)}{match.venue ? ` - ${match.venue}` : ""}</p>
              {match.mvp_name && <p>MVP: {match.mvp_name}</p>}
            </div>
          </article>
        ))}
      </section>
      {data.matches.length === 0 && <p className="public-empty">No matches have been added yet.</p>}
    </PublicPageShell>
  );
}
