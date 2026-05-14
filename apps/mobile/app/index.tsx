import { View } from "react-native";
import { useState } from "react";
import { Button, Card, Screen, Switch, Text, useBusinessClasses } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../src/lib/auth";
import { useFxRate, usePrice } from "../src/lib/queries";

/**
 * Temporary home — Stage 1 dev preview screen.
 * Verifies: auth round-trip, business tokens, market data adapters end-to-end.
 * Stage 1 step 4 replaces this with the real Portfolio Tab (per IA v2.2 §四).
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const businessClasses = useBusinessClasses();
  const [dark, setDark] = useState(false);

  // Stage 1 step 3 live demo: fetch AAPL price + USD→CNY rate
  const aaplQuery = usePrice("US:AAPL");
  const fxQuery = useFxRate("USD", "CNY");

  return (
    <Screen>
      <Text className="text-2xl font-semibold">{t("common.appName")}</Text>

      {user ? <Text className="text-muted text-xs">{user.email}</Text> : null}

      <Card>
        <View className="p-4 gap-3">
          <Text>{t("debug.heroUiTitle")}</Text>
          <Button>
            <Button.Label>{t("common.appName")}</Button.Label>
          </Button>
          <View className="flex-row items-center gap-2">
            <Switch isSelected={dark} onSelectedChange={setDark} />
            <Text>{t("settings.darkMode")}</Text>
          </View>
        </View>
      </Card>

      {/* Business token visual sanity check */}
      <Card>
        <View className="p-4 gap-3">
          <Text className="text-foreground font-semibold">PnL Preview</Text>
          <View className="flex-row gap-3">
            <View className={`${businessClasses.gain.bgSoft} px-3 py-1 rounded-md`}>
              <Text className={businessClasses.gain.text}>+2.34%</Text>
            </View>
            <View className={`${businessClasses.loss.bgSoft} px-3 py-1 rounded-md`}>
              <Text className={businessClasses.loss.text}>-1.20%</Text>
            </View>
            <Text className={businessClasses.pnlNeutral.text}>0.00%</Text>
          </View>
        </View>
      </Card>

      {/* Step 3 live data preview */}
      <Card>
        <View className="p-4 gap-3">
          <Text className="text-foreground font-semibold">Live Data Preview</Text>

          <View className="gap-1">
            <Text className="text-muted text-xs">AAPL (Alpha Vantage)</Text>
            {aaplQuery.isPending ? (
              <Text>Loading…</Text>
            ) : aaplQuery.error ? (
              <Text className="text-danger">{aaplQuery.error.message}</Text>
            ) : (
              <Text>
                ${aaplQuery.data.price.toFixed(2)} {aaplQuery.data.currency}
                <Text className="text-muted text-xs">
                  {"  "}as of {new Date(aaplQuery.data.asOf).toLocaleDateString()}
                </Text>
              </Text>
            )}
          </View>

          <View className="gap-1">
            <Text className="text-muted text-xs">USD → CNY (Frankfurter)</Text>
            {fxQuery.isPending ? (
              <Text>Loading…</Text>
            ) : fxQuery.error ? (
              <Text className="text-danger">{fxQuery.error.message}</Text>
            ) : (
              <Text>
                1 USD = ¥{fxQuery.data.rate.toFixed(4)}
                <Text className="text-muted text-xs">
                  {"  "}as of {new Date(fxQuery.data.asOf).toLocaleDateString()}
                </Text>
              </Text>
            )}
          </View>

          {aaplQuery.data && fxQuery.data ? (
            <View className="gap-1">
              <Text className="text-muted text-xs">10 shares of AAPL in CNY</Text>
              <Text className="text-foreground font-semibold">
                ¥{aaplQuery.data.price.times(10).times(fxQuery.data.rate).toFixed(2)}
              </Text>
            </View>
          ) : null}

          <Text className="text-muted text-xs">{t("common.disclaimer")}</Text>
        </View>
      </Card>

      {user ? (
        <Button variant="ghost" onPress={() => signOut()}>
          <Button.Label>{t("auth.signOut")}</Button.Label>
        </Button>
      ) : null}
    </Screen>
  );
}
