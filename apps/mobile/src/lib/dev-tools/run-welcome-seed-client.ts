/**
 * Client-side welcome seed — toggles user_preferences.has_seen_welcome only.
 */

import type { WelcomeScenarioId } from "./scenarios";
import { supabase } from "../supabase";

export class WelcomeSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WelcomeSeedError";
  }
}

export const runWelcomeSeedClient = async (
  scenario: WelcomeScenarioId,
  userId: string
): Promise<void> => {
  const hasSeenWelcome = scenario === "welcome:seen";

  const { error } = await supabase
    .from("user_preferences")
    .update({ has_seen_welcome: hasSeenWelcome })
    .eq("user_id", userId);

  if (error) {
    throw new WelcomeSeedError(`更新 user_preferences 失败: ${error.message}`);
  }
};
