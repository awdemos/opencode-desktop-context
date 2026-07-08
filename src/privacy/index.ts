export type PrivacyContext = {
  windowTitle: string
  appName: string
  blocklist: string[]
  allowlist: string[]
}

function normalize(value: string): string {
  return value.toLowerCase().trim()
}

function matchesAny(value: string, patterns: string[]): boolean {
  const normalizedValue = normalize(value)
  return patterns.some((pattern) => normalizedValue.includes(normalize(pattern)))
}

export function isAllowedToCapture(ctx: PrivacyContext): boolean {
  const { windowTitle, appName, blocklist, allowlist } = ctx

  if (matchesAny(windowTitle, blocklist) || matchesAny(appName, blocklist)) {
    return false
  }

  if (allowlist.length > 0) {
    return matchesAny(windowTitle, allowlist) || matchesAny(appName, allowlist)
  }

  return true
}
