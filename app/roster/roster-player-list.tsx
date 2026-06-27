"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/lib/magic-data";

type RosterPlayerListProps = {
  players: Player[];
};

export function RosterPlayerList({ players }: RosterPlayerListProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedPlayer) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPlayer(null);
    };

    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedPlayer]);

  return (
    <>
      <section className="public-grid four-columns">
        {players.map((player) => (
          <button
            className="public-card player-public-card player-card-button"
            key={player.id}
            type="button"
            onClick={() => setSelectedPlayer(player)}
          >
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.full_name} />
            ) : (
              <div className="player-photo-placeholder" aria-hidden="true">
                {getInitials(player.full_name)}
              </div>
            )}
            <span>#{player.jersey_number} - {player.position}</span>
            <h2>{player.full_name}</h2>
            {player.bio && <p>{player.bio}</p>}
            <small>{player.status}</small>
          </button>
        ))}
      </section>

      {isMounted && selectedPlayer
        ? createPortal(
            <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />,
            document.body,
          )
        : null}
    </>
  );
}

function PlayerModal({ player, onClose }: { player: Player; onClose: () => void }) {
  return (
    <div className="player-modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="player-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="player-modal-close" type="button" aria-label="Close player details" onClick={onClose}>
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>

        <div className="player-modal-media">
          {player.photo_url ? (
            <div className="product-page-main-image">
              <img src={player.photo_url} alt={player.full_name} />
            </div>
          ) : (
            <div className="player-photo-placeholder player-photo-placeholder-large" aria-hidden="true">
              {getInitials(player.full_name)}
            </div>
          )}
        </div>

        <div className="player-modal-content">
          <span className={`player-status player-status-${player.status}`}>{player.status}</span>
          <h2 id="player-modal-title">{player.full_name}</h2>
          <p>{player.bio || "Player profile details will be added soon."}</p>

          <div className="player-detail-grid">
            <Detail label="Jersey" value={`#${player.jersey_number}`} />
            <Detail label="Position" value={player.position} />
            <Detail label="Height" value={player.height || "Not listed"} />
            <Detail label="Status" value={formatStatus(player.status)} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="player-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatStatus(value: Player["status"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
