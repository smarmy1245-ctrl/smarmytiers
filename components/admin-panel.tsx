"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  ImageUp,
  Layers,
  LogOut,
  Palette,
  Plus,
  Tags,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react"
import type { Player, TitleRow } from "@/lib/data"
import { GAMEMODE_ICON_OPTIONS, gamemodeIcon, type Gamemode, type Tierlist, tierLabel } from "@/lib/tiers"
import type { ThemeSettings } from "@/lib/colors"
import { PlayerSkin } from "./player-skin"
import { cn } from "@/lib/utils"
import {
  createGamemode,
  createPlayer,
  createTierlist,
  createTitle,
  deleteGamemode,
  deletePlayer,
  deleteTierlist,
  deleteTitle,
  exportData,
  importData,
  logoutAction,
  moveGamemode,
  removePlayerSkin,
  removeTier,
  saveThemeAction,
  setPoints,
  setTier,
  updateGamemodeIcon,
  updateTitle,
  uploadPlayerSkin,
} from "@/app/actions/admin"

// ------- shared bits -------

// A color-wheel field: native color picker synced with an editable hex input.
// The color input carries the form `name`, so it submits the selected value.
function ColorField({
  name,
  label,
  defaultValue,
}: {
  name: string
  label: string
  defaultValue: string
}) {
  const [value, setValue] = useState(defaultValue)
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-card p-1"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim()
            setValue(v.startsWith("#") ? v : `#${v}`)
          }}
          className="min-h-10 w-28 rounded-md border border-border bg-card px-2 font-mono text-sm text-foreground outline-none focus:border-primary"
          aria-label={`${label} hex value`}
        />
      </span>
    </label>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold font-display text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

// ------- theme (color wheel) -------

function ThemeManager({ theme }: { theme: ThemeSettings }) {
  return (
    <SectionCard
      title="Theme colors"
      description="Pick any color from the wheel. These drive the whole site — buttons, accents and every tier column."
      icon={Palette}
    >
      <form action={saveThemeAction} className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-4">
          <ColorField name="primary" label="Primary (brand)" defaultValue={theme.primary} />
          <ColorField name="accent" label="Accent" defaultValue={theme.accent} />
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Tier column colors (Tier 1 = highest)
          </p>
          <div className="flex flex-wrap gap-4">
            {theme.tierColors.map((c, i) => (
              <ColorField key={i} name={`tier${i + 1}`} label={`Tier ${i + 1}`} defaultValue={c} />
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground"
        >
          Save theme
        </button>
      </form>
    </SectionCard>
  )
}

// ------- tier lists -------

function TierlistManager({ tierlists }: { tierlists: Tierlist[] }) {
  return (
    <SectionCard
      title="Tier lists"
      description="Each tier list is its own board with its own points — totals are never combined across lists. Choose whether it uses HT/LT tiers or raw points."
      icon={Layers}
    >
      <ul className="mb-4 flex flex-col gap-2">
        {tierlists.map((tl) => (
          <li
            key={tl.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
          >
            <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="flex-1 font-bold font-display text-foreground">{tl.label}</span>
            <span className="rounded border border-border bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {tl.mode === "points" ? "Points mode" : "Tier mode"}
            </span>
            {tierlists.length > 1 && (
              <form action={deleteTierlist}>
                <input type="hidden" name="id" value={tl.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${tl.label}`}
                  className="flex min-h-9 cursor-pointer items-center rounded-md border border-border px-2 text-muted-foreground hover:text-primary"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            )}
          </li>
        ))}
        {tierlists.length === 0 && <li className="text-sm text-muted-foreground">No tier lists yet.</li>}
      </ul>

      <form action={createTierlist} className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <input
          name="label"
          placeholder="Tier list name (e.g. Subtiers)"
          required
          className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary"
        />
        <select
          name="mode"
          defaultValue="tiers"
          className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 text-base text-foreground"
          aria-label="New tier list mode"
        >
          <option value="tiers">Tier mode (HT/LT)</option>
          <option value="points">Points mode</option>
        </select>
        <button
          type="submit"
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
    </SectionCard>
  )
}

// ------- gamemodes -------

function GamemodeManager({ gamemodes, tierlists }: { gamemodes: Gamemode[]; tierlists: Tierlist[] }) {
  return (
    <SectionCard title="Gamemodes" description="Add gamemodes and assign each one to a tier list." icon={Trophy}>
      <div className="mb-4 flex flex-col gap-4">
        {tierlists.map((tl) => {
          const listGamemodes = gamemodes.filter((gm) => gm.tierlistId === tl.id)
          return (
            <div key={tl.id} className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                {tl.label}
              </p>
              <ul className="flex flex-col gap-2">
                {listGamemodes.map((gm) => {
                  const Icon = gamemodeIcon(gm.icon)
                  return (
                    <li
                      key={gm.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                      <span className="flex-1 text-sm font-semibold text-foreground">{gm.label}</span>

                      <form action={updateGamemodeIcon} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={gm.id} />
                        <select
                          name="icon"
                          defaultValue={gm.icon}
                          className="min-h-9 cursor-pointer rounded-md border border-border bg-background px-2 text-sm text-foreground"
                          aria-label={`${gm.label} icon`}
                        >
                          {GAMEMODE_ICON_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="min-h-9 cursor-pointer rounded-md border border-border px-3 text-sm font-bold text-foreground hover:border-primary"
                        >
                          Save
                        </button>
                      </form>

                      {tierlists.length > 1 && (
                        <form action={moveGamemode} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={gm.id} />
                          <select
                            name="tierlistId"
                            defaultValue={gm.tierlistId}
                            className="min-h-9 cursor-pointer rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            aria-label={`${gm.label} tier list`}
                          >
                            {tierlists.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="min-h-9 cursor-pointer rounded-md border border-border px-3 text-sm font-bold text-foreground hover:border-primary"
                          >
                            Move
                          </button>
                        </form>
                      )}

                      <form action={deleteGamemode}>
                        <input type="hidden" name="id" value={gm.id} />
                        <button
                          type="submit"
                          aria-label={`Delete ${gm.label}`}
                          className="flex min-h-9 cursor-pointer items-center rounded-md border border-border px-2 text-muted-foreground hover:text-primary"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </li>
                  )
                })}
                {listGamemodes.length === 0 && (
                  <li className="text-sm text-muted-foreground">No gamemodes in this list yet.</li>
                )}
              </ul>
            </div>
          )
        })}
      </div>

      <form action={createGamemode} className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <input
          name="label"
          placeholder="Gamemode name (e.g. Sword)"
          required
          className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary"
        />
        <select
          name="tierlistId"
          defaultValue={tierlists[0]?.id}
          className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 text-base text-foreground"
          aria-label="New gamemode tier list"
        >
          {tierlists.map((tl) => (
            <option key={tl.id} value={tl.id}>
              {tl.label}
            </option>
          ))}
        </select>
        <select
          name="icon"
          defaultValue="sword"
          className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 text-base text-foreground"
          aria-label="New gamemode icon"
        >
          {GAMEMODE_ICON_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
    </SectionCard>
  )
}

// ------- titles -------

function TitleManager({ titles }: { titles: TitleRow[] }) {
  return (
    <SectionCard
      title="Titles"
      description="Rename ranks (e.g. Grandmaster), set the point threshold, and pick any color from the wheel."
      icon={Tags}
    >
      <ul className="mb-4 flex flex-col gap-2">
        {titles.map((t) => (
          <li key={t.id} className="rounded-lg border border-border bg-background p-3">
            <form action={updateTitle} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={t.id} />
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Title</span>
                <input
                  name="name"
                  defaultValue={t.name}
                  required
                  style={{ color: t.color }}
                  className="min-h-10 w-full rounded-md border border-border bg-card px-2 text-base font-bold outline-none focus:border-primary"
                />
              </label>
              <label className="flex w-24 flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Min pts</span>
                <input
                  name="min"
                  type="number"
                  defaultValue={t.min}
                  required
                  className="min-h-10 w-full rounded-md border border-border bg-card px-2 text-base text-foreground outline-none focus:border-primary"
                />
              </label>
              <ColorField name="color" label="Color" defaultValue={t.color} />
              <button
                type="submit"
                className="min-h-10 cursor-pointer rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground"
              >
                Save
              </button>
            </form>
            <form action={deleteTitle} className="mt-2">
              <input type="hidden" name="id" value={t.id} />
              <button
                type="submit"
                className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-primary"
              >
                Delete title
              </button>
            </form>
          </li>
        ))}
        {titles.length === 0 && <li className="text-sm text-muted-foreground">No titles yet.</li>}
      </ul>

      <form action={createTitle} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">New title</span>
          <input
            name="name"
            placeholder="e.g. SMARMY'S LEGEND"
            required
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="flex w-24 flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Min pts</span>
          <input
            name="min"
            type="number"
            defaultValue={0}
            required
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary"
          />
        </label>
        <ColorField name="color" label="Color" defaultValue="#fca5a5" />
        <button
          type="submit"
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
    </SectionCard>
  )
}

// ------- per-player tier / points editor -------

function TierEditor({
  player,
  gamemodes,
  tierlists,
}: {
  player: Player
  gamemodes: Gamemode[]
  tierlists: Tierlist[]
}) {
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      {tierlists.map((tl) => {
        const listGamemodes = gamemodes.filter((gm) => gm.tierlistId === tl.id)
        if (listGamemodes.length === 0) return null
        const isPoints = tl.mode === "points"
        return (
          <div key={tl.id} className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              {tl.label}
              <span className="font-normal text-muted-foreground">· {isPoints ? "points" : "tiers"}</span>
            </p>
            {listGamemodes.map((gm) => {
              const current = player.tiers.find((t) => t.gamemode === gm.slug)
              return (
                <div key={gm.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 text-sm font-semibold text-foreground">{gm.label}</span>

                  {isPoints ? (
                    <form action={setPoints} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="playerId" value={player.id} />
                      <input type="hidden" name="gamemode" value={gm.slug} />
                      <input
                        name="points"
                        type="number"
                        defaultValue={current?.points ?? 0}
                        className="min-h-9 w-24 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
                        aria-label={`${gm.label} points`}
                      />
                      <button
                        type="submit"
                        className="min-h-9 cursor-pointer rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground"
                      >
                        {current ? "Update" : "Set"}
                      </button>
                    </form>
                  ) : (
                    <form action={setTier} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="playerId" value={player.id} />
                      <input type="hidden" name="gamemode" value={gm.slug} />
                      <select
                        name="tierType"
                        defaultValue={current?.tierType ?? "HT"}
                        className="min-h-9 cursor-pointer rounded-md border border-border bg-background px-2 text-sm text-foreground"
                        aria-label={`${gm.label} tier type`}
                      >
                        <option value="HT">HT</option>
                        <option value="LT">LT</option>
                      </select>
                      <select
                        name="tier"
                        defaultValue={current?.tier || 3}
                        className="min-h-9 cursor-pointer rounded-md border border-border bg-background px-2 text-sm text-foreground"
                        aria-label={`${gm.label} tier number`}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="min-h-9 cursor-pointer rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground"
                      >
                        {current ? "Update" : "Set"}
                      </button>
                    </form>
                  )}

                  {current && (
                    <>
                      <span className="rounded border border-border bg-secondary px-2 py-1 font-mono text-xs text-foreground">
                        {isPoints
                          ? `${current.points} pts`
                          : `${tierLabel(current.tier, current.tierType)} · ${current.points} pts`}
                      </span>
                      <form action={removeTier}>
                        <input type="hidden" name="playerId" value={player.id} />
                        <input type="hidden" name="gamemode" value={gm.slug} />
                        <button
                          type="submit"
                          aria-label={`Remove ${gm.label} entry`}
                          className="flex min-h-9 cursor-pointer items-center rounded-md border border-border px-2 text-muted-foreground hover:text-primary"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ------- per-player skin -------

function SkinManager({ player }: { player: Player }) {
  const hasCustom = (player.skinSource === "upload" || player.skinSource === "skin") && !!player.skinUrl
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Skin image</span>
        {hasCustom && (
          <span className="rounded border border-border bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {player.skinSource === "skin" ? "Minecraft skin" : "Photo"}
          </span>
        )}
      </div>
      <form action={uploadPlayerSkin} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="playerId" value={player.id} />
        <input
          type="file"
          name="skin"
          accept="image/png,image/*"
          required
          className="max-w-[200px] cursor-pointer text-xs text-muted-foreground file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-bold file:text-foreground"
        />
        <select
          name="kind"
          defaultValue={player.skinSource === "skin" ? "skin" : "upload"}
          aria-label={`${player.username} skin type`}
          className="min-h-9 cursor-pointer rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          <option value="skin">Minecraft skin (.png)</option>
          <option value="upload">Photo</option>
        </select>
        <button
          type="submit"
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground"
        >
          <ImageUp className="h-4 w-4" />
          {hasCustom ? "Replace" : "Import"}
        </button>
      </form>
      {hasCustom && (
        <form action={removePlayerSkin}>
          <input type="hidden" name="playerId" value={player.id} />
          <button
            type="submit"
            className="flex min-h-9 w-fit cursor-pointer items-center rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            Remove image
          </button>
        </form>
      )}
    </div>
  )
}

// ------- players -------

function PlayerManager({
  players,
  gamemodes,
  tierlists,
}: {
  players: Player[]
  gamemodes: Gamemode[]
  tierlists: Tierlist[]
}) {
  // Track the selected player by id so an admin can jump straight to anyone
  // from the dropdown instead of scrolling through the full roster.
  const [selectedId, setSelectedId] = useState<number | null>(players[0]?.id ?? null)

  // Keep the selection valid as players are added / removed. If the current
  // pick disappears (e.g. after a delete), fall back to the first player.
  const selected = players.find((p) => p.id === selectedId) ?? players[0] ?? null
  const currentIndex = selected ? players.findIndex((p) => p.id === selected.id) : -1

  function step(delta: number) {
    if (players.length === 0) return
    const next = (currentIndex + delta + players.length) % players.length
    setSelectedId(players[next].id)
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Add player" description="Add a Minecraft player to start assigning tiers or points." icon={Users}>
        <form action={createPlayer} className="flex flex-wrap items-center gap-2">
          <input
            name="username"
            placeholder="Minecraft username"
            required
            className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary"
          />
          <input
            name="region"
            placeholder="Region (e.g. NA)"
            className="min-h-11 w-28 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
      </SectionCard>

      {players.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No players yet. Add one above.
        </div>
      ) : (
        <SectionCard
          title="Edit player"
          description="Pick a player to jump straight to their tiers, points and skin — no scrolling."
          icon={Users}
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Player</span>
              <select
                value={selected?.id ?? ""}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                aria-label="Select player to edit"
                className="min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-base font-bold text-foreground outline-none focus:border-primary"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username}
                    {p.region ? ` (${p.region})` : ""} · {p.totalPoints} pts
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous player"
                className="flex min-h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-14 text-center text-xs font-semibold text-muted-foreground">
                {currentIndex + 1} / {players.length}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next player"
                className="flex min-h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {selected && (
            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <PlayerSkin
                  username={selected.username}
                  skinUrl={selected.skinUrl}
                  skinSource={selected.skinSource}
                  size={40}
                  rounded="rounded-md"
                  className="border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold font-display text-foreground">{selected.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.region ?? "—"} · {selected.totalPoints} total pts
                  </p>
                </div>
                <form action={deletePlayer}>
                  <input type="hidden" name="id" value={selected.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${selected.username}`}
                    className="flex min-h-9 cursor-pointer items-center rounded-md border border-border px-2 text-muted-foreground hover:text-primary"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>

              <SkinManager player={selected} />

              <TierEditor player={selected} gamemodes={gamemodes} tierlists={tierlists} />
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}

// ------- import / export -------

function DataManager() {
  const [state, formAction, pending] = useActionState(importData, {
    error: null as string | null,
    ok: false,
  })
  const [exported, setExported] = useState<string>("")
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const json = await exportData()
      setExported(json)
    } finally {
      setExporting(false)
    }
  }

  function handleDownload() {
    const blob = new Blob([exported], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `smarmy-tiers-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Export data"
        description="Download or copy a full JSON snapshot of every tier list, gamemode, title and player."
        icon={Download}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Generating..." : "Generate export"}
          </button>
          {exported && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 font-bold text-foreground hover:border-primary"
            >
              Download .json
            </button>
          )}
        </div>
        {exported && (
          <textarea
            readOnly
            value={exported}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-3 h-48 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:border-primary"
          />
        )}
      </SectionCard>

      <SectionCard
        title="Import data"
        description="Paste a JSON export (from this app or copied out of the Neon SQL console) and import it. Rows are matched by slug / username, so re-running is safe."
        icon={Upload}
      >
        <form action={formAction} className="flex flex-col gap-3">
          <textarea
            name="json"
            required
            placeholder='{ "tierlists": [...], "gamemodes": [...], "titles": [...], "players": [...] }'
            className="h-48 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {pending ? "Importing..." : "Import JSON"}
          </button>
          {state?.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
          {state?.ok && <p className="text-sm font-semibold text-emerald-400">Import complete.</p>}
        </form>
      </SectionCard>
    </div>
  )
}

// ------- shell -------

type SectionKey = "players" | "tierlists" | "gamemodes" | "titles" | "theme"

const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "players", label: "Players & tiers", icon: Users },
  { key: "tierlists", label: "Tier lists", icon: Layers },
  { key: "gamemodes", label: "Gamemodes", icon: Trophy },
  { key: "titles", label: "Titles", icon: Tags },
  { key: "theme", label: "Theme / colors", icon: Palette },
]

export function AdminPanel({
  players,
  gamemodes,
  titles,
  tierlists,
  theme,
}: {
  players: Player[]
  gamemodes: Gamemode[]
  titles: TitleRow[]
  tierlists: Tierlist[]
  theme: ThemeSettings
}) {
  const [section, setSection] = useState<SectionKey>("players")

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 lg:max-w-6xl lg:px-8 lg:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold font-display text-foreground">Smarmy&apos;s Admin</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to tier list</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </form>
        </div>
      </div>

      {/* Control dropdown — jump straight to a section without scrolling */}
      <div className="mb-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Controls</span>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as SectionKey)}
            className="min-h-12 w-full cursor-pointer rounded-lg border border-border bg-card px-3 text-base font-bold text-foreground outline-none focus:border-primary"
            aria-label="Select admin section"
          >
            {SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {/* Quick chips on wider screens */}
        <div className="hidden flex-wrap gap-2 lg:flex">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const active = s.key === section
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors",
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {section === "players" && (
        <PlayerManager players={players} gamemodes={gamemodes} tierlists={tierlists} />
      )}
      {section === "tierlists" && <TierlistManager tierlists={tierlists} />}
      {section === "gamemodes" && <GamemodeManager gamemodes={gamemodes} tierlists={tierlists} />}
      {section === "titles" && <TitleManager titles={titles} />}
      {section === "theme" && <ThemeManager theme={theme} />}
    </main>
  )
}
