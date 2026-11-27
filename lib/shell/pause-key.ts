/** True when p is a typed letter: a text field, or the words board. */
export function textFieldHasFocus(target: unknown): boolean {
  if (!target || typeof target !== "object") return false
  const element = target as {
    tagName?: string
    isContentEditable?: boolean
    closest?: (selector: string) => unknown
  }
  const tag = element.tagName?.toUpperCase()
  if (tag === "INPUT" || tag === "TEXTAREA") return true
  if (element.isContentEditable) return true
  return Boolean(element.closest?.("[data-guess-input]"))
}
