/**
 * English default messages. All UI copy in the app should route through
 * `t()` from `../t.ts` so future translation work is a matter of copying
 * this file and translating values.
 */

export const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    close: 'Close',
    back: 'Back',
    loading: 'Loading…',
    error: 'Something went wrong.',
  },
  nav: {
    dashboard: 'Dashboard',
    projects: 'Projects',
    rankings: 'Rankings',
    templates: 'Templates',
    voices: 'Voices',
    insights: 'Insights',
    settings: 'Settings',
    billing: 'Billing',
    support: 'Help and support',
    admin: 'Admin console',
    signOut: 'Sign out',
  },
  auth: {
    signInTitle: 'Welcome back',
    signUpTitle: 'Create your account',
    signInSubtitle: 'We will email you a one-time code. No password needed.',
    sendCode: 'Send code',
    continueWithGoogle: 'Continue with Google',
    verifyTitle: 'Enter your code',
    verifyDescription: 'We emailed a six-digit code to {email}.',
    resend: 'Resend code',
    resendCooldown: 'Resend in {seconds}s',
    verifyAndSignIn: 'Verify and sign in',
  },
  editor: {
    save: 'Save draft',
    export: 'Export',
    addTrack: 'Add track',
    detectHighlights: 'Detect highlights',
    generateCaptions: 'Generate captions',
    generateVoiceover: 'Generate voiceover',
    generateScript: 'Generate',
    generateImage: 'Generate image',
  },
  billing: {
    currentPlan: 'Current plan',
    manageSubscription: 'Manage subscription',
    cancelAtPeriodEnd: 'Cancel at period end',
    upgrade: 'Upgrade',
    usageThisPeriod: 'Usage this period',
    recentInvoices: 'Recent invoices',
  },
} as const;

export type Messages = typeof en;
