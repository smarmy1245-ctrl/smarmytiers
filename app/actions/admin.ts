"use server"

import { revalidatePath } from "next/cache"
import { put } from "@vercel/blob"
import { query } from "@/lib/db"
import { ensureSchema } from "@/lib/schema"
import { saveTheme } from "@/lib/settings"
import { isAdmin, signInAdmin, signOutAdmin } from "@/lib/admin"
import { GAMEMODE_ICONS } from "@/lib/tiers"
import { normalizeHex } from "@/lib/colors"

// Returns true when the caller is an admin. We intentionally do NOT throw here:
// a thrown error inside a server action bubbles up to the client error boundary
// and shows the "reload" screen. Returning false lets the action no-op safely.
//
// CRITICAL: mutation actions query tables directly, so the schema MUST exist
// before they run. Reads call ensureSchema() on their own, but a brand-new
// database has no tables until something builds them — if an admin logged in
// and hit "create" before any read had seeded the schema, the INSERT threw
// "relation does not exist", which surfaced as the "reload" screen. Ensuring
// the schema here (once the caller is a verified admin) makes every mutation
// self-sufficient. It's memoized, so this is effectively free after the first call.
async function requireAdmin(): Promise<boolean> {
  const ok = await isAdmin()
  if (ok) await ensureSchema()
  return ok
}

async function gamemodeExists(slug: string): Promise<boolean> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM gamemodes WHERE slug = $1`, [slug])
  return (rows[0]?.n ?? 0) > 0
}

// Mode ('tiers' | 'points') of the tier list that owns a gamemode.
async function gamemodeMode(slug: string): Promise<"tiers" | "points"> {
  const rows = await query<{ mode: string | null }>(
    `SELECT t.mode FROM gamemodes g LEFT JOIN tierlists t ON t.id = g.tierlist_id WHERE g.slug = $1`,
    [slug],
  )
  return rows[0]?.mode === "points" ? "points" : "tiers"
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const code = String(formData.get("code") ?? "")
  const ok = await signInAdmin(code)
  if (!ok) return { error: "Invalid access code." }
  revalidatePath("/admin")
  return { error: null }
}

export async function logoutAction() {
  await signOutAdmin()
  revalidatePath("/admin")
}

export async function createPlayer(formData: FormData) {
  if (!(await requireAdmin())) return
  const username = String(formData.get("username") ?? "").trim()
  const region = String(formData.get("region") ?? "").trim() || null
  if (!username) return
  await query(`INSERT INTO players (username, region) VALUES ($1, $2)`, [username, region])
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function deletePlayer(formData: FormData) {
  if (!(await requireAdmin())) return
  const id = Number(formData.get("id"))
  if (!id) return
  await query(`DELETE FROM player_tiers WHERE player_id = $1`, [id])
  await query(`DELETE FROM players WHERE id = $1`, [id])
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function setTier(formData: FormData) {
  if (!(await requireAdmin())) return
  const playerId = Number(formData.get("playerId"))
  const gamemode = String(formData.get("gamemode") ?? "")
  const tier = Number(formData.get("tier"))
  const tierType = String(formData.get("tierType") ?? "")

  if (!playerId || tier < 1 || tier > 5 || !["HT", "LT"].includes(tierType)) return
  if (!(await gamemodeExists(gamemode))) return
  // This action only applies to tier-based lists.
  if ((await gamemodeMode(gamemode)) !== "tiers") return

  // Enforce a single HT1 per gamemode: clear any other player's HT1 first.
  if (tierType === "HT" && tier === 1) {
    await query(
      `DELETE FROM player_tiers
       WHERE gamemode = $1 AND tier = 1 AND tier_type = 'HT' AND player_id <> $2`,
      [gamemode, playerId],
    )
  }

  await query(
    `INSERT INTO player_tiers (player_id, gamemode, tier, tier_type, points)
     VALUES ($1, $2, $3, $4, NULL)
     ON CONFLICT (player_id, gamemode)
     DO UPDATE SET tier = EXCLUDED.tier, tier_type = EXCLUDED.tier_type, points = NULL`,
    [playerId, gamemode, tier, tierType],
  )
  revalidatePath("/admin")
  revalidatePath("/")
}

// Points mode: assign a single raw point value to a player for a whole
// "points" tier list. Points lists have NO gamemodes — the value is stored
// against the tier list's own slug (one implicit bucket per player per list).
export async function setPoints(formData: FormData) {
  if (!(await requireAdmin())) return
  const playerId = Number(formData.get("playerId"))
  const tierlistId = Number(formData.get("tierlistId"))
  const points = Math.trunc(Number(formData.get("points")))

  if (!playerId || !tierlistId || Number.isNaN(points)) return

  // The tier list must exist and be in points mode. Its slug becomes the
  // player_tiers key for this player's points value.
  const rows = await query<{ slug: string; mode: string }>(`SELECT slug, mode FROM tierlists WHERE id = $1`, [
    tierlistId,
  ])
  const tl = rows[0]
  if (!tl || tl.mode !== "points") return

  await query(
    `INSERT INTO player_tiers (player_id, gamemode, tier, tier_type, points)
     VALUES ($1, $2, 0, 'PT', $3)
     ON CONFLICT (player_id, gamemode)
     DO UPDATE SET tier = 0, tier_type = 'PT', points = EXCLUDED.points`,
    [playerId, tl.slug, points],
  )
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function removeTier(formData: FormData) {
  if (!(await requireAdmin())) return
  const playerId = Number(formData.get("playerId"))
  const gamemode = String(formData.get("gamemode") ?? "")
  if (!playerId || !gamemode) return
  await query(`DELETE FROM player_tiers WHERE player_id = $1 AND gamemode = $2`, [playerId, gamemode])
  revalidatePath("/admin")
  revalidatePath("/")
}

// ----- Gamemode configuration -----

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function tierlistExists(id: number): Promise<boolean> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM tierlists WHERE id = $1`, [id])
  return (rows[0]?.n ?? 0) > 0
}

// Points-mode lists have no gamemodes, so gamemodes may only be attached to
// tier-mode lists.
async function isTierMode(id: number): Promise<boolean> {
  const rows = await query<{ mode: string }>(`SELECT mode FROM tierlists WHERE id = $1`, [id])
  return rows[0]?.mode !== "points"
}

async function defaultTierlistId(): Promise<number | null> {
  const rows = await query<{ id: number }>(`SELECT id FROM tierlists ORDER BY sort_order ASC, id ASC LIMIT 1`)
  return rows[0]?.id ?? null
}

export async function createGamemode(formData: FormData) {
  if (!(await requireAdmin())) return
  const label = String(formData.get("label") ?? "").trim()
  let icon = String(formData.get("icon") ?? "sword").trim()
  if (!label) return
  if (!GAMEMODE_ICONS[icon]) icon = "sword"

  // Which tier list this gamemode belongs to (must be a tier-mode list).
  let tierlistId = Number(formData.get("tierlistId"))
  if (!tierlistId || !(await tierlistExists(tierlistId)) || !(await isTierMode(tierlistId))) {
    const fallback = await defaultTierlistId()
    if (!fallback || !(await isTierMode(fallback))) return
    tierlistId = fallback
  }

  const slug = slugify(label)
  if (!slug) return
  if (await gamemodeExists(slug)) return

  const rows = await query<{ max: number | null }>(`SELECT MAX(sort_order) AS max FROM gamemodes`)
  const nextOrder = (rows[0]?.max ?? -1) + 1

  await query(
    `INSERT INTO gamemodes (slug, label, icon, sort_order, tierlist_id) VALUES ($1, $2, $3, $4, $5)`,
    [slug, label, icon, nextOrder, tierlistId],
  )
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function moveGamemode(formData: FormData) {
  if (!(await requireAdmin())) return
  const id = Number(formData.get("id"))
  const tierlistId = Number(formData.get("tierlistId"))
  if (!id || !tierlistId || !(await tierlistExists(tierlistId)) || !(await isTierMode(tierlistId))) return
  await query(`UPDATE gamemodes SET tierlist_id = $1 WHERE id = $2`, [tierlistId, id])
  revalidatePath("/admin")
  revalidatePath("/")
}

// ----- Tier list configuration -----

export async function createTierlist(formData: FormData) {
  if (!(await requireAdmin())) return
  const label = String(formData.get("label") ?? "").trim()
  if (!label) return
  const mode = String(formData.get("mode") ?? "tiers") === "points" ? "points" : "tiers"

  let slug = slugify(label)
  if (!slug) return
  // Guarantee a unique slug even if the label repeats.
  const existing = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM tierlists WHERE slug = $1`, [slug])
  if ((existing[0]?.n ?? 0) > 0) slug = `${slug}-${Date.now().toString(36)}`

  const rows = await query<{ max: number | null }>(`SELECT MAX(sort_order) AS max FROM tierlists`)
  const nextOrder = (rows[0]?.max ?? -1) + 1

  await query(`INSERT INTO tierlists (slug, label, sort_order, mode) VALUES ($1, $2, $3, $4)`, [
    slug,
    label,
    nextOrder,
    mode,
  ])
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function deleteTierlist(formData: FormData) {
  if (!(await requireAdmin())) return
  const id = Number(formData.get("id"))
  if (!id) return

  // Never allow deleting the final tier list.
  const count = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM tierlists`)
  if ((count[0]?.n ?? 0) <= 1) return

  // Remove every gamemode (and its player tiers) that belongs to this list.
  const gms = await query<{ slug: string }>(`SELECT slug FROM gamemodes WHERE tierlist_id = $1`, [id])
  for (const gm of gms) {
    await query(`DELETE FROM player_tiers WHERE gamemode = $1`, [gm.slug])
  }
  await query(`DELETE FROM gamemodes WHERE tierlist_id = $1`, [id])
  await query(`DELETE FROM tierlists WHERE id = $1`, [id])
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function updateGamemodeIcon(formData: FormData) {
  if (!(await requireAdmin())) return
  const id = Number(formData.get("id"))
  let icon = String(formData.get("icon") ?? "").trim()
  if (!id || !GAMEMODE_ICONS[icon]) return
  await query(`UPDATE gamemodes SET icon = $1 WHERE id = $2`, [icon, id])
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function deleteGamemode(formData: FormData) {
  if (!(await requireAdmin())) return
  const id = Number(formData.get("id"))
  if (!id) return
  const rows = await query<{ slug: string }>(`SELECT slug FROM gamemodes WHERE id = $1`, [id])
  const slug = rows[0]?.slug
  if (!slug) return
  await query(`DELETE FROM player_tiers WHERE gamemode = $1`, [slug])
  await query(`DELETE FROM gamemodes WHERE id = $1`, [id])
  revalidatePath("/admin")
  revalidatePath("/")
}

// ----- Title configuration -----

export async function updateTitle(formData: FormData) {
  if (!(await requireAdmin())) return
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") ?? "").trim()
  const min = Number(formData.get("min"))
  const color = normalizeHex(String(formData.get("color") ?? "")) ?? "#fca5a5"
  if (!id || !name || Number.isNaN(min)) return
  await query(`UPDATE titles SET name = $1, min_points = $2, color = $3 WHERE id = $4`, [name, min, color, id])
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function createTitle(formData: FormData) {
  if (!(await requireAdmin())) return
  const name = String(formData.get("name") ?? "").trim()
  const min = Number(formData.get("min"))
  const color = normalizeHex(String(formData.get("color") ?? "")) ?? "#fca5a5"
  if (!name || Number.isNaN(min)) return

  // Titles are scoped to a tier list. Fall back to the first list if the
  // submitted id is missing or invalid.
  let tierlistId = Number(formData.get("tierlistId"))
  if (!tierlistId || !(await tierlistExists(tierlistId))) {
    const fallback = await defaultTierlistId()
    if (!fallback) return
    tierlistId = fallback
  }

  await query(
    `INSERT INTO titles (name, min_points, class_name, color, tierlist_id) VALUES ($1, $2, 'text-red-300', $3, $4)`,
    [name, min, color, tierlistId],
  )
  revalidatePath("/admin")
  revalidatePath("/")
}

// ----- Theme (color wheel) configuration -----

export async function saveThemeAction(formData: FormData) {
  if (!(await requireAdmin())) return
  const primary = String(formData.get("primary") ?? "")
  const accent = String(formData.get("accent") ?? "")
  const tierColors = [1, 2, 3, 4, 5].map((n) => String(formData.get(`tier${n}`) ?? ""))
  await saveTheme({ primary, accent, tierColors })
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function deleteTitle(formData: FormData) {
  if (!(await requireAdmin())) return
  const id = Number(formData.get("id"))
  if (!id) return
  await query(`DELETE FROM titles WHERE id = $1`, [id])
  revalidatePath("/admin")
  revalidatePath("/")
}

// ----- Player skin uploads -----

export async function uploadPlayerSkin(formData: FormData) {
  if (!(await requireAdmin())) return
  const playerId = Number(formData.get("playerId"))
  const file = formData.get("skin")
  if (!playerId || !(file instanceof File) || file.size === 0) return

  // "skin" = a raw Minecraft skin texture PNG (face gets pixel-cropped),
  // "upload" = a regular photo shown directly as the avatar.
  const kind = String(formData.get("kind") ?? "upload") === "skin" ? "skin" : "upload"

  const ext = (file.name.split(".").pop() || "png").toLowerCase()
  const blob = await put(`skins/${playerId}-${Date.now()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
  })

  await query(`UPDATE players SET skin_url = $1, skin_source = $2 WHERE id = $3`, [blob.url, kind, playerId])
  revalidatePath("/admin")
  revalidatePath("/")
}

export async function removePlayerSkin(formData: FormData) {
  if (!(await requireAdmin())) return
  const playerId = Number(formData.get("playerId"))
  if (!playerId) return
  await query(`UPDATE players SET skin_url = NULL, skin_source = NULL WHERE id = $1`, [playerId])
  revalidatePath("/admin")
  revalidatePath("/")
}

