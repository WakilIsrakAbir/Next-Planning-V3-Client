/** Joins class names, skipping empty and false values: `cn('btn', active && 'is-active')`. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
