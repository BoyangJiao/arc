/**
 * invokeDevSeed — calls the dev-seed Edge Function for the signed-in user.
 *
 * Requires DEV_TOOLS_ENABLED=true on the dev Supabase project and a deployed
 * `dev-seed` function. See supabase/functions/dev-seed/README.md.
 */

import { queryClient } from "../query-client";
import { supabase } from "../supabase";
import type { DevSeedScenarioId } from "./scenarios";

export interface DevSeedInvokeResult {
  ok: true;
  scenario: string;
  portfolioId: string;
  expectedUi: string[];
}

interface DevSeedErrorBody {
  error?: string;
}

export const invokeDevSeed = async (scenario: DevSeedScenarioId): Promise<DevSeedInvokeResult> => {
  const { data, error } = await supabase.functions.invoke<DevSeedInvokeResult & DevSeedErrorBody>(
    "dev-seed",
    { body: { scenario } }
  );

  if (error) {
    throw new Error(
      error.message.includes("FunctionsFetchError")
        ? "dev-seed function unreachable — deploy it and set DEV_TOOLS_ENABLED=true (see supabase/functions/dev-seed/README.md)"
        : error.message
    );
  }

  if (!data || data.error) {
    throw new Error(data?.error ?? "dev-seed failed with no error message");
  }

  if (!data.ok) {
    throw new Error("dev-seed returned unexpected response");
  }

  // Portfolio id changes on reset — invalidate all portfolio-related caches.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["dailySnapshot"] }),
    queryClient.invalidateQueries({ queryKey: ["portfolioValuation"] }),
  ]);

  return data;
};
