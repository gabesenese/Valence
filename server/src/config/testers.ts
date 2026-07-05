export const TESTER_EMAILS = ['tester@valence.dev', 'thin@valence.dev'];

export function isTesterEmail(email: string | null | undefined): boolean {
  return !!email && TESTER_EMAILS.includes(email.toLowerCase());
}
