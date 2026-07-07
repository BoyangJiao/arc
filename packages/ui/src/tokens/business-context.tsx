/**
 * BusinessTokensProvider + useBusinessTokens / useBusinessClasses hooks
 *
 * 用法（apps/mobile/app/_layout.tsx）：
 *
 *   import { BusinessTokensProvider } from '@arc/ui';
 *   import { useUserPreferences } from '...';  // Stage 1 后期接入
 *
 *   function RootLayout() {
 *     const prefs = useUserPreferences();
 *     return (
 *       <BusinessTokensProvider mode={prefs.financeColorMode}>
 *         <Stack />
 *       </BusinessTokensProvider>
 *     );
 *   }
 *
 * 业务组件用法：
 *
 *   import { useBusinessClasses } from '@arc/ui';
 *
 *   function PnLBadge({ change }: { change: number }) {
 *     const classes = useBusinessClasses();
 *     const sign = change > 0 ? 'gain' : change < 0 ? 'loss' : 'pnlNeutral';
 *     return (
 *       <View className={classes[sign].bgSoft ?? ''}>
 *         <Text className={classes[sign].text}>{change}%</Text>
 *       </View>
 *     );
 *   }
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildBusinessTokens,
  DEFAULT_FINANCE_COLOR_MODE,
  type BusinessTokenMap,
  type FinanceColorMode,
} from "./business";
import { buildBusinessClasses, type BusinessClassMap } from "./business-classes";

interface BusinessTokensContextValue {
  mode: FinanceColorMode;
  setFinanceColorMode: (mode: FinanceColorMode) => void;
}

const BusinessTokensContext = createContext<BusinessTokensContextValue>({
  mode: DEFAULT_FINANCE_COLOR_MODE,
  setFinanceColorMode: () => {},
});

export interface BusinessTokensProviderProps {
  /** 用户当前涨跌色偏好。未传则用 DEFAULT_FINANCE_COLOR_MODE。 */
  mode?: FinanceColorMode;
  children: ReactNode;
}

/**
 * Provider — 把当前用户偏好注入到子树
 *
 * Stage 1 J5 实施时挂在 RootLayout，从 user_preferences 读 mode。
 * 同时暴露 setFinanceColorMode 以便 Settings 页面可立即切换。
 */
export function BusinessTokensProvider({
  mode = DEFAULT_FINANCE_COLOR_MODE,
  children,
}: BusinessTokensProviderProps) {
  const [currentMode, setCurrentMode] = useState<FinanceColorMode>(mode);

  // Sync from prop (e.g., when prefs load from DB after initial render)
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const setFinanceColorMode = useCallback((newMode: FinanceColorMode) => {
    setCurrentMode(newMode);
  }, []);

  const value = useMemo<BusinessTokensContextValue>(
    () => ({ mode: currentMode, setFinanceColorMode }),
    [currentMode, setFinanceColorMode]
  );

  return <BusinessTokensContext.Provider value={value}>{children}</BusinessTokensContext.Provider>;
}

/**
 * 拿当前 Business token 名映射表（字符串名，类型安全）
 *
 * @example
 *   const tokens = useBusinessTokens();
 *   tokens.gain  // → 'success' | 'danger'（取决于用户偏好）
 *
 * 注意：返回的是 Foundation token 名，**不是** Tailwind className。
 * 如需 className，用 useBusinessClasses() 而非自己拼接（Tailwind 编译期不识别拼接）。
 */
export function useBusinessTokens(): BusinessTokenMap {
  const { mode } = useContext(BusinessTokensContext);
  return useMemo(() => buildBusinessTokens(mode), [mode]);
}

/**
 * 拿当前 Business token 对应的 Tailwind 字面量 className 表
 *
 * @example
 *   const classes = useBusinessClasses();
 *   <Text className={classes.gain.text}>+2.3%</Text>
 *   <View className={classes.gain.bgSoft}>...</View>
 */
export function useBusinessClasses(): BusinessClassMap {
  const { mode } = useContext(BusinessTokensContext);
  return useMemo(() => buildBusinessClasses(mode), [mode]);
}

/** 读取当前 finance color mode + setter。Settings 页面用 setter 实现即时切换。 */
export function useFinanceColorMode(): {
  financeColorMode: FinanceColorMode;
  setFinanceColorMode: (mode: FinanceColorMode) => void;
} {
  const { mode, setFinanceColorMode } = useContext(BusinessTokensContext);
  return { financeColorMode: mode, setFinanceColorMode };
}
