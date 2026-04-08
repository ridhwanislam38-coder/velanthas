# Blocked Items

## 2026-04-07 22:51
- **Taskbar pin**: Windows 11 programmatically blocks taskbar pinning via Shell.Application verbs (policy restriction since Win11 22H2). Tried: Shell.Application ParseName + Verbs() loop. Alternative: shortcuts placed on Desktop instead. Manual workaround: right-click shortcut on Desktop -> 'Pin to taskbar'.
