export const zh = {
  common: {
    appName: "循迹",
    disclaimer: "仅供参考，可能延迟。",
    notInvestmentAdvice: "本工具不构成投资建议。",
  },
  portfolio: {
    title: "投资组合",
    empty: "暂无持仓，添加你的第一笔资产。",
    totalValue: "总市值",
    dayChange: "今日涨跌",
  },
  rebalance: {
    title: "再平衡",
    deviation: "偏离目标配置",
    sharesNeeded: "达到目标配置需要的份额变化",
  },
  settings: {
    darkMode: "深色模式",
  },
  auth: {
    welcomeTitle: "登录循迹",
    welcomeSubtitle: "输入邮箱，我们会发送一个验证码",
    emailLabel: "邮箱",
    emailPlaceholder: "you@example.com",
    // Primary flow — OTP code (works in dev + prod)
    sendCode: "发送验证码",
    sending: "发送中…",
    codeSentTitle: "验证码已发送",
    codeSentBody: "已发送到 {{email}}，请输入邮件中的验证码",
    codeLabel: "验证码",
    codePlaceholder: "邮件中的数字代码",
    verify: "登录",
    verifying: "验证中…",
    invalidCode: "请输入邮件中的完整验证码（6-10 位数字）",
    verifyFailed: "验证码错误或已过期",
    // Magic link (Stage 4 production / advanced)
    sendLink: "改用邮件链接登录",
    backToCode: "改用验证码登录",
    linkSentTitle: "请检查邮箱",
    linkSentBody:
      "我们向 {{email}} 发送了一个登录链接。注意：Expo Go 调试期此方式可能失败，建议用验证码。",
    resend: "重新发送",
    invalidEmail: "请输入有效的邮箱地址",
    sendFailed: "发送失败，请稍后再试",
    // Magic link callback (Stage 4 deep link path)
    callbackVerifying: "正在验证登录…",
    callbackFailed: "登录验证失败",
    callbackTryAgain: "返回重试",
    signOut: "退出登录",
  },
  debug: {
    heroUiTitle: "HeroUI Native",
  },
};
