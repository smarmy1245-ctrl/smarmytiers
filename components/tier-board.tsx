"use client"

import { ChevronsUp, Medal, Trophy } from "lucide-react"
import type { Player } from "@/lib/data"
import { PlayerSkin } from "./player-skin"
import { rankClass } from "@/lib/tiers"
import { cn } from "@/lib/utils"

type Entry = { player: Player; type: "HT" | "LT"; points: number }

const COLUMNS = [1, 2, 3, 4, 5] as const

export function TierBoard({
  players,
  gamemode,
  onSelect,
}: {
  players: Player[]
  gamemode: string
  onSelect: (player: Player) => void
}) {
  // Group players into tier buckets (1-5) for this gamemode.
  const buckets = new Map<number, Entry[]>()
  for (const p of players) {
    const t = p.tiers.find((x) => x.gamemode === gamemode)
    if (!t) continue
    const list = buckets.get(t.tier) ?? []
    list.push({ player: p, type: t.tierType, points: t.points })
    buckets.set(t.tier, list)
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => b.points - a.points || a.player.username.localeCompare(b.player.username))
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 lg:overflow-x-visible">
      {COLUMNS.map((tier) => {
        const entries = buckets.get(tier) ?? []
        return (
          <div key={tier} className="flex w-48 shrink-0 flex-col lg:w-auto lg:flex-1">
            <div
              className="flex items-center justify-center gap-2 rounded-t-xl border border-black/20 px-3 py-3 text-center"
              style={{
                backgroundColor: `var(--tier-${tier})`,
                color: `var(--tier-${tier}-fg)`,
              }}
            >
              <Trophy className="h-4 w-4 opacity-90" aria-hidden="true" />
              <span className="text-base font-bold font-display">{`Tier ${tier}`}</span>
            </div>

            <ol className="flex flex-1 flex-col gap-px rounded-b-xl border border-t-0 border-border bg-background/40 p-1">
              {entries.length === 0 ? (
                <li className="px-2 py-3 text-center text-xs text-muted-foreground">—</li>
              ) : (
                entries.map((e, i) => (
                  <li key={e.player.id}>
                    <button
                      onClick={() => onSelect(e.player)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-primary/10",
                        i % 2 === 0 ? "bg-card" : "bg-secondary/40",
                      )}
                    >
                      <PlayerSkin
                        username={e.player.username}
                        skinUrl={e.player.skinUrl}
                        skinSource={e.player.skinSource}
                        size={24}
                        rounded="rounded"
                        className="border border-border"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {e.player.username}
                      </span>
                      <ChevronsUp
                        className={cn(
                          "h-4 w-4 shrink-0",
                          e.type === "HT" ? "text-emerald-400" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))
              )}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

// Points board: a single ranked list for gamemodes that live inside a
// "points" tier list (players are ordered by their raw points value).
export function PointsBoard({
  players,
  gamemode,
  onSelect,
}: {
  players: Player[]
  gamemode: string
  onSelect: (player: Player) => void
}) {
  const entries = players
    .map((p) => ({ player: p, points: p.tiers.find((t) => t.gamemode === gamemode)?.points }))
    .filter((e): e is { player: Player; points: number } => typeof e.points === "number")
    .sort((a, b) => b.points - a.points || a.player.username.localeCompare(b.player.username))

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No ranked players yet.
      </div>
    )
  }

  return (
    <ol className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {entries.map((e, i) => {
        const rank = i + 1
        return (
          <li key={e.player.id}>
            <button
              onClick={() => onSelect(e.player)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/60"
            >
              <span
                className={cn(
                  "flex w-8 shrink-0 items-center justify-center text-lg font-extrabold font-display tabular-nums",
                  rankClass(rank),
                )}
              >
                {rank}
              </span>
              <PlayerSkin
                username={e.player.username}
                skinUrl={e.player.skinUrl}
                skinSource={e.player.skinSource}
                size={32}
                rounded="rounded-md"
                className="border border-border"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                {e.player.username}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-primary">
                <Medal className="h-4 w-4" aria-hidden="true" />
                {e.points} pts
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
