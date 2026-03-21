export const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'midnight', label: 'Midnight Blue' },
  { value: 'forest', label: 'Forest Green' },
  { value: 'amber', label: 'Amber' }
] as const

export type ThemeValue = (typeof THEMES)[number]['value']
