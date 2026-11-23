/** Locked role colors. The bible must match the five role entries. */
export const PALETTE = {
  player: "#E23B3B",
  enemy: "#3A5BFF",
  enemyCore: "#142A9C",
  coin: "#FFE14D",
  safe: "#3DDC97",
  end: "#8FF0C0",
  wall: "#2A2744",
  floorA: "#C9C6F2",
  floorB: "#D6D3F6",
  shadow: "rgba(26, 26, 46, 0.18)",
  outline: "#7A5CFF",
  ghost: "rgba(226, 59, 59, 0.5)",
} as const

export const ROLE_COLORS = {
  player: PALETTE.player,
  enemy: PALETTE.enemy,
  coin: PALETTE.coin,
  safe: PALETTE.safe,
  end: PALETTE.end,
} as const
