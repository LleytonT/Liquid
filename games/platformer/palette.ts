/** Locked role colors from the game spec. The bible must match them. */
export const PALETTE = {
  player: "#FF2E2E",
  enemy: "#2E3BFF",
  coin: "#FFE14D",
  safe: "#B5FEB4",
  end: "#B5FEB4",
  wall: "#2A2744",
  floorA: "#F7F7FF",
  floorB: "#E0DAFE",
  ink: "#1A1A2E",
  shadow: "rgba(26, 26, 46, 0.18)",
  agent: "#7A5CFF",
  ghost: "rgba(255, 46, 46, 0.45)",
} as const

export const ROLE_COLORS = {
  player: PALETTE.player,
  enemy: PALETTE.enemy,
  coin: PALETTE.coin,
  safe: PALETTE.safe,
  end: PALETTE.end,
} as const
