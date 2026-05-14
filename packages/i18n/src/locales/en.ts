export const en = {
  common: {
    appName: "Arc",
    disclaimer: "For reference only, may be delayed.",
    notInvestmentAdvice: "This is not investment advice.",
  },
  portfolio: {
    title: "Portfolio",
    empty: "No holdings yet. Add your first asset.",
    totalValue: "Total Value",
    dayChange: "Day Change",
  },
  rebalance: {
    title: "Rebalance",
    deviation: "Deviation from target",
    sharesNeeded: "Shares needed to reach target allocation",
  },
  settings: {
    darkMode: "Dark mode",
  },
  auth: {
    welcomeTitle: "Sign in to Arc",
    welcomeSubtitle: "Enter your email — we'll send you a 6-digit code",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    // Primary flow — OTP code (works in dev + prod)
    sendCode: "Send code",
    sending: "Sending…",
    codeSentTitle: "Code sent",
    codeSentBody: "We sent it to {{email}}. Enter the 6-digit code from the email.",
    codeLabel: "Code",
    codePlaceholder: "6-digit code",
    verify: "Sign in",
    verifying: "Verifying…",
    invalidCode: "Please enter the full 6-digit code",
    verifyFailed: "Code is invalid or expired",
    // Magic link (Stage 4 production / advanced)
    sendLink: "Use email link instead",
    backToCode: "Use code instead",
    linkSentTitle: "Check your email",
    linkSentBody:
      "We sent a sign-in link to {{email}}. Note: this may fail under Expo Go dev — prefer the code option.",
    resend: "Resend",
    invalidEmail: "Please enter a valid email address",
    sendFailed: "Couldn't send. Try again later.",
    // Magic link callback (Stage 4 deep link path)
    callbackVerifying: "Verifying sign-in…",
    callbackFailed: "Sign-in verification failed",
    callbackTryAgain: "Back to sign in",
    signOut: "Sign out",
  },
  debug: {
    heroUiTitle: "HeroUI Native",
  },
};
