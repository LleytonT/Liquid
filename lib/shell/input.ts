/** Ask bar, shelf link, and other chrome. Game listeners should ignore these. */
export function isShellControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-shell-control]"))
}
