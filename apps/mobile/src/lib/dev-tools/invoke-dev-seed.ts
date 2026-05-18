/**
 * invokeDevSeed — apply dev seed for the signed-in user.
 *
 * - Watchlist scenarios: client-side JWT (no Edge deploy required).
 * - Daily Snapshot / default: dev-seed Edge Function.
 */

import { queryClient } from "../query-client";
import { supabase } from "../supabase";
import {
  findFeatureForScenario,
  isRebalanceScenario,
  isWatchlistScenario,
  type DevSeedScenarioId,
} from "./scenarios";
import { runRebalanceSeedClient, RebalanceSeedError } from "./run-rebalance-seed-client";
import { runWatchlistSeedClient, WatchlistSeedError } from "./run-watchlist-seed-client";

export interface DevSeedInvokeResult {
  ok: true;
  scenario: string;
  portfolioId: string;
  expectedUi: string[];
  via: "client-watchlist" | "client-rebalance" | "edge";
}

interface DevSeedErrorBody {
  error?: string;
}

export const invalidateDevSeedQueries = async (): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["dailySnapshot"] }),
    queryClient.invalidateQueries({ queryKey: ["portfolioValuation"] }),
    queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
    queryClient.invalidateQueries({ queryKey: ["watchlist-quote"] }),
    queryClient.invalidateQueries({ queryKey: ["symbol-search"] }),
    queryClient.invalidateQueries({ queryKey: ["targetAllocations"] }),
    queryClient.invalidateQueries({ queryKey: ["rebalance"] }),
  ]);
};

const parseEdgeError = async (
  scenario: DevSeedScenarioId,
  data: (DevSeedInvokeResult & DevSeedErrorBody) | null,
  error: { message: string; context?: Response } | null
): Promise<string> => {
  if (data?.error) return data.error;

  const ctx = error && "context" in error ? (error as { context?: Response }).context : undefined;
  if (ctx) {
    try {
      const body = (await ctx.json()) as DevSeedErrorBody;
      if (body?.error) return body.error;
    } catch {
      // ignore
    }
  }

  if (error?.message.includes("non-2xx")) {
    return [
      `dev-seed 云端返回错误（场景: ${scenario}）。`,
      "请确认：",
      "1. pnpm functions:deploy:dev-seed",
      "2. pnpm functions:secrets:dev-tools（DEV_TOOLS_ENABLED=true）",
    ].join("\n");
  }

  return error?.message ?? "dev-seed failed with no error message";
};

const invokeEdgeDevSeed = async (scenario: DevSeedScenarioId): Promise<DevSeedInvokeResult> => {
  const { data, error } = await supabase.functions.invoke<DevSeedInvokeResult & DevSeedErrorBody>(
    "dev-seed",
    { body: { scenario } }
  );

  if (error?.message.includes("FunctionsFetchError")) {
    throw new Error(
      "dev-seed 无法连接 — 请部署并设置 DEV_TOOLS_ENABLED（见 supabase/functions/dev-seed/README.md）"
    );
  }

  if (error || !data?.ok) {
    throw new Error(await parseEdgeError(scenario, data, error));
  }

  if (!data.ok) {
    throw new Error("dev-seed returned unexpected response");
  }

  return { ...data, via: "edge" };
};

const invokeWatchlistClient = async (scenario: DevSeedScenarioId): Promise<DevSeedInvokeResult> => {
  if (!isWatchlistScenario(scenario)) {
    throw new WatchlistSeedError(`Not a watchlist scenario: ${scenario}`);
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    throw new WatchlistSeedError("未登录 — 请先 OTP 登录");
  }

  await runWatchlistSeedClient(scenario, user.id);
  await invalidateDevSeedQueries();

  return {
    ok: true,
    scenario,
    portfolioId: "",
    expectedUi: [],
    via: "client-watchlist",
  };
};

const invokeRebalanceClient = async (scenario: DevSeedScenarioId): Promise<DevSeedInvokeResult> => {
  if (!isRebalanceScenario(scenario)) {
    throw new RebalanceSeedError(`Not a rebalance scenario: ${scenario}`);
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    throw new RebalanceSeedError("未登录 — 请先 OTP 登录");
  }

  const portfolioId = await runRebalanceSeedClient(scenario, user.id);
  await invalidateDevSeedQueries();

  return {
    ok: true,
    scenario,
    portfolioId,
    expectedUi: [],
    via: "client-rebalance",
  };
};

export const invokeDevSeed = async (scenario: DevSeedScenarioId): Promise<DevSeedInvokeResult> => {
  if (isWatchlistScenario(scenario)) {
    return invokeWatchlistClient(scenario);
  }

  if (isRebalanceScenario(scenario)) {
    return invokeRebalanceClient(scenario);
  }

  const result = await invokeEdgeDevSeed(scenario);
  await invalidateDevSeedQueries();
  return result;
};

export const goHrefForScenario = (scenarioId: DevSeedScenarioId) =>
  findFeatureForScenario(scenarioId).goHref;
