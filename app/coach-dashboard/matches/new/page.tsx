"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  deleteMatch,
  getMagicData,
  insertMatch,
  insertMatchEvent,
  updateMatch,
  type Match,
  type MatchEvent,
  type Player,
  type Team,
} from "@/lib/magic-data";
import { getFreshPortalSession, getStoredPortalSession, type PortalSession } from "@/lib/portal-auth";
import styles from "./match-editor.module.css";

type MatchMode = "final" | "scheduled" | "live";
type ClockStatus = NonNullable<Match["clock_status"]>;

const defaultHomeTeamName = "Magic Initiative Rwanda";

export default function NewMatchPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [mode, setMode] = useState<MatchMode>("final");
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [quarter, setQuarter] = useState(1);
  const [minutes, setMinutes] = useState(10);
  const [seconds, setSeconds] = useState(0);
  const [clockNow, setClockNow] = useState(() => new Date());
  const formKey = activeMatch ? activeMatch.id : `new-${mode}`;

  useEffect(() => {
    const stored = getStoredPortalSession();

    if (!stored) {
      window.location.href = "/login";
      return;
    }

    if (stored.profile.role !== "coach") {
      window.location.href = "/player-dashboard";
      return;
    }

    loadMatches(stored).catch((loadError) => {
      console.error("Failed to load matches:", loadError);
      setError("Could not load match data yet. You can still try saving a new match.");
    });
  }, []);

  const liveMatches = useMemo(
    () => matches.filter((match) => match.status === "live"),
    [matches],
  );
  const liveMatch = useMemo(
    () => activeMatch?.status === "live" ? activeMatch : liveMatches[0] || null,
    [activeMatch, liveMatches],
  );
  const homeTeamOptions = useMemo(
    () => {
      const homeTeams = teams.filter((team) => team.is_home_team);
      return homeTeams.length ? homeTeams : teams;
    },
    [teams],
  );
  const selectedHomeTeamName = liveMatch ? homeTeamName(liveMatch, teams) : defaultHomeTeamName;

  useEffect(() => {
    if (!liveMatch) return;
    setQuarter(liveMatch.current_quarter || 1);
    const remaining = liveMatch.quarter_seconds_remaining ?? 600;
    setMinutes(Math.floor(remaining / 60));
    setSeconds(remaining % 60);
  }, [liveMatch?.id, liveMatch?.current_quarter, liveMatch?.quarter_seconds_remaining, liveMatch?.clock_status]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const liveRemaining = liveMatch ? liveSecondsRemaining(liveMatch, clockNow) : 0;
  const isQuarterBreak = Boolean(liveMatch && liveMatch.clock_status === "running" && liveRemaining === 0);

  async function loadMatches(currentSession: PortalSession) {
    const data = await getMagicData(currentSession.access_token, true);
    setMatches(data.matches);
    setTeams(data.teams);
    setPlayers(data.players);

    const searchParams = new URLSearchParams(window.location.search);
    const matchId = searchParams.get("matchId");
    const selectedMatch = matchId ? data.matches.find((match) => match.id === matchId) : null;
    if (selectedMatch) {
      setActiveMatch(selectedMatch);
      setMode(selectedMatch.status === "canceled" ? "scheduled" : selectedMatch.status);
    }
  }

  async function requireCoachSession() {
    const freshSession = await getFreshPortalSession();

    if (!freshSession) {
      window.location.href = "/login";
      throw new Error("Your session expired. Please sign in again.");
    }

    if (freshSession.profile.role !== "coach") {
      window.location.href = "/player-dashboard";
      throw new Error("Only coaches can manage matches.");
    }

    return freshSession;
  }

  async function handleMatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const currentSession = await requireCoachSession();
      const isLive = mode === "live";
      const isFinal = mode === "final";
      const initialSeconds = secondsFromFields(data);
      const mvpPlayerId = isFinal ? String(data.get("mvpPlayerId") || "") : "";
      const mvpPlayer = mvpPlayerId ? players.find((player) => player.id === mvpPlayerId) : null;
      const payload = {
        match_date: String(data.get("matchDate")),
        match_time: String(data.get("matchTime") || "") || null,
        home_team_id: String(data.get("homeTeamId") || "") || null,
        opponent_name: String(data.get("opponentName")),
        home_score: isFinal || isLive ? Number(data.get("homeScore") || 0) : 0,
        away_score: isFinal || isLive ? Number(data.get("awayScore") || 0) : 0,
        venue: String(data.get("venue") || "") || null,
        league: String(data.get("league")),
        mvp_player_id: isFinal && mvpPlayer ? mvpPlayer.id : null,
        mvp_name: isFinal && mvpPlayer ? mvpPlayer.full_name : null,
        status: mode,
        status_details: isLive ? statusText(Number(data.get("quarter") || 1), initialSeconds, "not_started") : null,
        current_quarter: Number(data.get("quarter") || 1),
        quarter_seconds_remaining: initialSeconds,
        clock_status: isFinal ? "ended" as ClockStatus : "not_started" as ClockStatus,
        clock_started_at: null,
        live_revision: 0,
      };

      const result = activeMatch
        ? await updateMatch(activeMatch.id, payload, currentSession.access_token)
        : await insertMatch(payload, currentSession.access_token);
      const savedMatch = result[0];

      if (!savedMatch) throw new Error("Supabase did not return the saved match.");

      setActiveMatch(savedMatch);
      setMessage(mode === "live" ? "Live match is ready for scoreboard control." : "Match saved successfully.");
      await loadMatches(currentSession);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save match.");
    } finally {
      setIsSaving(false);
    }
  }

  async function applyLiveUpdate(
    patch: Partial<Match>,
    eventPayload: Pick<MatchEvent, "event_type" | "team_side" | "points" | "note">,
  ) {
    if (!liveMatch) return;
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const currentSession = await requireCoachSession();
      const nextMatch = {
        ...liveMatch,
        ...patch,
        live_revision: (liveMatch.live_revision || 0) + 1,
      };
      const updatedRows = await updateMatch(liveMatch.id, {
        ...patch,
        status_details: patch.status_details || statusText(
          nextMatch.current_quarter || 1,
          nextMatch.quarter_seconds_remaining ?? 600,
          nextMatch.clock_status || "not_started",
        ),
        live_revision: nextMatch.live_revision,
      }, currentSession.access_token);
      const updatedMatch = updatedRows[0] || nextMatch;

      const eventRows = await insertMatchEvent({
        match_id: liveMatch.id,
        event_type: eventPayload.event_type,
        team_side: eventPayload.team_side,
        points: eventPayload.points,
        home_score: updatedMatch.home_score,
        away_score: updatedMatch.away_score,
        quarter: updatedMatch.current_quarter || 1,
        seconds_remaining: liveSecondsRemaining(updatedMatch, new Date()),
        clock_status: updatedMatch.clock_status || "not_started",
        note: eventPayload.note,
        created_by: currentSession.user.id,
      }, currentSession.access_token);

      setActiveMatch(updatedMatch);
      setEvents((current) => [...eventRows, ...current].slice(0, 8));
      setMessage("Live match updated.");
      await loadMatches(currentSession);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update live match.");
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelLiveMatch() {
    if (!liveMatch) return;

    const confirmed = window.confirm("Cancel this live match and delete its scoreboard data?");
    if (!confirmed) return;

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const currentSession = await requireCoachSession();
      await deleteMatch(liveMatch.id, currentSession.access_token);
      setActiveMatch(null);
      setEvents([]);
      setMessage("Live match canceled and deleted.");
      await loadMatches(currentSession);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel live match.");
    } finally {
      setIsSaving(false);
    }
  }

  function addPoints(team: "home" | "away", points: 1 | 2 | 3) {
    if (!liveMatch) return;
    const homeScore = liveMatch.home_score + (team === "home" ? points : 0);
    const awayScore = liveMatch.away_score + (team === "away" ? points : 0);

    void applyLiveUpdate(
      { home_score: homeScore, away_score: awayScore },
      {
        event_type: "score",
        team_side: team,
        points,
        note: `${team === "home" ? selectedHomeTeamName : liveMatch.opponent_name || "Opponent"} +${points}`,
      },
    );
  }

  function updateClock(clockStatus: ClockStatus) {
    if (!liveMatch) return;
    const remaining = clockStatus === "paused"
      ? liveSecondsRemaining(liveMatch, new Date())
      : Math.max(0, Math.min(720, minutes * 60 + seconds));
    const nextClockStatus = clockStatus === "running" && remaining === 0 ? "paused" : clockStatus;

    void applyLiveUpdate(
      {
        current_quarter: quarter,
        quarter_seconds_remaining: remaining,
        clock_status: nextClockStatus,
        clock_started_at: nextClockStatus === "running" ? new Date().toISOString() : null,
        status: nextClockStatus === "ended" ? "final" : "live",
        status_details: statusText(quarter, remaining, nextClockStatus),
      },
      {
        event_type: nextClockStatus === "ended" ? "status" : "clock",
        team_side: null,
        points: null,
        note: nextClockStatus === "ended" ? "Match finished" : statusText(quarter, remaining, nextClockStatus),
      },
    );
  }

  function prepareNextQuarter() {
    if (!liveMatch) return;
    const nextQuarter = Math.min((liveMatch.current_quarter || quarter) + 1, 8);
    setQuarter(nextQuarter);
    setMinutes(10);
    setSeconds(0);
  }

  function addNewLiveMatch() {
    setActiveMatch(null);
    setMode("live");
    setEvents([]);
    setQuarter(1);
    setMinutes(10);
    setSeconds(0);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <div className={styles.titleBlock}>
            <h1>Match Recording</h1>
            <p>Create finished results, scheduled fixtures, or control a live scoreboard.</p>
          </div>
          <Link href="/coach-dashboard" className={styles.backLink}>
            <i className="fa-solid fa-arrow-left" /> Dashboard
          </Link>
        </div>

        {message ? <p className={styles.message} role="status">{message}</p> : null}
        {error ? <p className={`${styles.message} ${styles.error}`} role="alert">{error}</p> : null}

        <div className={styles.grid}>
          <section className={styles.panel}>
            <h2>{activeMatch ? "Edit Match" : "Add Match"}</h2>
            <form onSubmit={handleMatchSubmit} key={formKey}>
              <div className={styles.modeTabs} aria-label="Match type">
                {[
                  ["final", "Finished"],
                  ["scheduled", "Scheduled"],
                  ["live", "Live"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value as MatchMode)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className={styles.formGrid}>
                {homeTeamOptions.length ? (
                  <InputBox label="Magic Team">
                    <select name="homeTeamId" defaultValue={activeMatch?.home_team_id || homeTeamOptions[0]?.id || ""}>
                      {homeTeamOptions.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </InputBox>
                ) : null}
                <InputBox label="Opponent Club">
                  <input name="opponentName" type="text" defaultValue={activeMatch?.opponent_name || ""} required />
                </InputBox>
                <InputBox label="Competition">
                  <select name="league" defaultValue={activeMatch?.league || "League"}>
                    <option>League</option>
                    <option>Regular Season</option>
                    <option>Playoffs</option>
                    <option>Pre-season Tournament</option>
                    <option>Friendly</option>
                  </select>
                </InputBox>
                <InputBox label="Match Date">
                  <input name="matchDate" type="date" defaultValue={activeMatch?.match_date || ""} required />
                </InputBox>
                <InputBox label="Tipoff Time">
                  <input name="matchTime" type="time" defaultValue={activeMatch?.match_time?.slice(0, 5) || ""} />
                </InputBox>
                <InputBox label="Arena Venue" full>
                  <input name="venue" type="text" defaultValue={activeMatch?.venue || ""} placeholder="BK Arena" />
                </InputBox>

                {mode !== "scheduled" ? (
                  <>
                    <InputBox label="Magic Score">
                      <input name="homeScore" type="number" min="0" defaultValue={activeMatch?.home_score ?? 0} required />
                    </InputBox>
                    <InputBox label="Opponent Score">
                      <input name="awayScore" type="number" min="0" defaultValue={activeMatch?.away_score ?? 0} required />
                    </InputBox>
                  </>
                ) : null}

                {mode === "final" ? (
                  <InputBox label="Game MVP" full>
                    <MvpPlayerSelect players={players} defaultPlayerId={activeMatch?.mvp_player_id || ""} />
                  </InputBox>
                ) : null}

                {mode === "live" ? (
                  <>
                    <InputBox label="Quarter">
                      <input name="quarter" type="number" min="1" max="8" defaultValue={activeMatch?.current_quarter || 1} />
                    </InputBox>
                    <InputBox label="Quarter Length">
                      <select name="quarterLength" defaultValue={activeMatch?.quarter_seconds_remaining || 600}>
                        <option value="600">10 minutes</option>
                        <option value="720">12 minutes</option>
                        <option value="300">5 minutes</option>
                      </select>
                    </InputBox>
                  </>
                ) : null}
              </div>

              <div className={styles.actions}>
                <Link href="/coach-dashboard" className={styles.ghostButton}>Cancel</Link>
                <button type="submit" className={styles.primaryButton} disabled={isSaving}>
                  {activeMatch ? "Update Match" : "Save Match"}
                </button>
              </div>
            </form>
          </section>

          <section className={styles.panel}>
            <h2>Live Control</h2>
            <button type="button" className={styles.addLiveButton} onClick={addNewLiveMatch}>
              <i className="fa-solid fa-plus" /> Add New Live
            </button>
            {liveMatch ? (
              <>
                {liveMatches.length > 1 ? (
                  <div className={styles.liveSwitcher} aria-label="Live matches">
                    {liveMatches.map((match) => (
                      <button
                        key={match.id}
                        type="button"
                        className={match.id === liveMatch.id ? styles.activeLiveMatch : ""}
                        onClick={() => {
                          setActiveMatch(match);
                          setMode("live");
                          setEvents([]);
                        }}
                      >
                        <span>{homeTeamName(match, teams)}</span>
                        <strong>{match.home_score} - {match.away_score}</strong>
                        <small>{match.opponent_name || "Opponent"}</small>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className={styles.liveScore}>
                  <div className={styles.teamBox}>
                    <strong>{selectedHomeTeamName}</strong>
                    <b>{liveMatch.home_score}</b>
                  </div>
                  <span className={styles.scoreDash}>-</span>
                  <div className={styles.teamBox}>
                    <strong>{liveMatch.opponent_name || "Opponent"}</strong>
                    <b>{liveMatch.away_score}</b>
                  </div>
                </div>

                <div className={`${styles.clockFace} ${isQuarterBreak ? styles.breakClock : ""}`}>
                  <span>{isQuarterBreak ? "Break" : clockLabel(liveMatch.clock_status)}</span>
                  <strong>Q{liveMatch.current_quarter || quarter} - {formatClock(liveRemaining)}</strong>
                </div>

                <div className={styles.scoreControls}>
                  <div>
                    <span className={styles.statLabel}>{selectedHomeTeamName} Points</span>
                    <div className={styles.scoreGroup}>
                      {[1, 2, 3].map((points) => (
                        <button key={points} type="button" className={styles.scoreButton} disabled={isSaving} onClick={() => addPoints("home", points as 1 | 2 | 3)}>
                          +{points}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className={styles.statLabel}>Opponent Points</span>
                    <div className={styles.scoreGroup}>
                      {[1, 2, 3].map((points) => (
                        <button key={points} type="button" className={styles.scoreButton} disabled={isSaving} onClick={() => addPoints("away", points as 1 | 2 | 3)}>
                          +{points}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.clockGrid}>
                  <InputBox label="Quarter">
                    <input type="number" min="1" max="8" value={quarter} onChange={(event) => setQuarter(Number(event.target.value || 1))} />
                  </InputBox>
                  <InputBox label="Minutes">
                    <input type="number" min="0" max="12" value={minutes} onChange={(event) => setMinutes(Number(event.target.value || 0))} />
                  </InputBox>
                  <InputBox label="Seconds">
                    <input type="number" min="0" max="59" value={seconds} onChange={(event) => setSeconds(Number(event.target.value || 0))} />
                  </InputBox>
                </div>

                <div className={styles.clockActions}>
                  <button type="button" className={styles.primaryButton} disabled={isSaving} onClick={() => updateClock("running")}>Start/Resume</button>
                  <button type="button" className={styles.ghostButton} disabled={isSaving} onClick={() => updateClock("paused")}>Pause</button>
                  <button type="button" className={styles.ghostButton} disabled={isSaving} onClick={() => updateClock("not_started")}>Set Time</button>
                  <button type="button" className={styles.ghostButton} disabled={isSaving} onClick={prepareNextQuarter}>Next Quarter</button>
                  <button type="button" className={styles.dangerButton} disabled={isSaving} onClick={() => updateClock("ended")}>Finish Match</button>
                  <button type="button" className={styles.dangerButton} disabled={isSaving} onClick={cancelLiveMatch}>Cancel</button>
                </div>

                <div className={styles.eventList} aria-live="polite">
                  {events.map((item) => (
                    <div key={item.id} className={styles.eventItem}>
                      <strong>{item.note || item.event_type}</strong>
                      Q{item.quarter} - {formatClock(item.seconds_remaining)} - {item.home_score} / {item.away_score}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.message}>Create or edit a live match to unlock scoreboard controls.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function InputBox({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={`${styles.inputBox} ${full ? styles.full : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function MvpPlayerSelect({ players, defaultPlayerId }: { players: Player[]; defaultPlayerId: string }) {
  const [selectedId, setSelectedId] = useState(defaultPlayerId);
  const [isOpen, setIsOpen] = useState(false);
  const selectedPlayer = players.find((player) => player.id === selectedId) || null;

  return (
    <div className={styles.mvpPicker}>
      <input type="hidden" name="mvpPlayerId" value={selectedId} />
      <button
        type="button"
        className={styles.mvpPickerButton}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        {selectedPlayer ? <PlayerOption player={selectedPlayer} /> : <span className={styles.mvpPlaceholder}>Select MVP player</span>}
        <i className="fa-solid fa-chevron-down" />
      </button>
      {isOpen ? (
        <div className={styles.mvpOptions} role="listbox">
          <button
            type="button"
            className={styles.mvpOption}
            onClick={() => {
              setSelectedId("");
              setIsOpen(false);
            }}
          >
            <span className={styles.mvpPlaceholder}>No MVP selected</span>
          </button>
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              className={`${styles.mvpOption} ${player.id === selectedId ? styles.selectedMvpOption : ""}`}
              onClick={() => {
                setSelectedId(player.id);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={player.id === selectedId}
            >
              <PlayerOption player={player} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlayerOption({ player }: { player: Player }) {
  return (
    <span className={styles.playerOption}>
      {player.photo_url ? (
        <img src={player.photo_url} alt="" />
      ) : (
        <span>{initials(player.full_name)}</span>
      )}
      <span>
        <strong>{player.full_name}</strong>
        <small>#{player.jersey_number} - {player.position}</small>
      </span>
    </span>
  );
}

function secondsFromFields(data: FormData) {
  return Number(data.get("quarterLength") || 600);
}

function statusText(quarter: number, secondsRemaining: number, clockStatus: ClockStatus) {
  let state = "Ready";
  if (clockStatus === "running" && secondsRemaining === 0) state = "Break";
  else if (clockStatus === "running") state = "Live";
  else if (clockStatus === "paused") state = "Paused";
  else if (clockStatus === "ended") state = "Final";
  return `${state} - Q${quarter} - ${formatClock(secondsRemaining)}`;
}

function liveSecondsRemaining(match: Match, now: Date) {
  const storedSeconds = match.quarter_seconds_remaining ?? 600;
  if (match.clock_status !== "running" || !match.clock_started_at) return storedSeconds;

  const startedAt = new Date(match.clock_started_at).getTime();
  if (Number.isNaN(startedAt)) return storedSeconds;

  const elapsedSeconds = Math.floor((now.getTime() - startedAt) / 1000);
  return Math.max(0, storedSeconds - elapsedSeconds);
}

function homeTeamName(match: Match, teams: Team[]) {
  return match.home_team?.name || teams.find((team) => team.id === match.home_team_id)?.name || defaultHomeTeamName;
}

function clockLabel(status: Match["clock_status"]) {
  if (status === "running") return "Live";
  if (status === "paused") return "Paused";
  if (status === "ended") return "Final";
  return "Ready";
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
