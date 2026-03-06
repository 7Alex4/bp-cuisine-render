/**
 * BP Cuisines Design System
 * Reference tokens used across the application.
 * Actual Tailwind utilities are derived from these values in globals.css @theme inline.
 */
export const colors = {
  bpRed: '#E30613',
  bpBlack: '#111111',
  bpGrey: '#F5F5F5',
  bpText: '#1A1A1A',
} as const

export const radius = {
  lg: '14px',
  xl: '20px',
} as const

export const shadow = {
  soft: '0 10px 30px rgba(0,0,0,0.08)',
  red: '0 8px 20px rgba(227,6,19,0.25)',
} as const

export const typography = {
  title: '40px',
  sectionTitle: '22px',
  body: '16px',
} as const
