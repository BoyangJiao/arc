/**
 * Transaction entry — redirect to unified trade form (ADR 016 v2).
 */

import { useEffect } from "react";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

export default function TransactionEntryRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    prefillMarket?: string;
    prefillSymbol?: string;
  }>();

  useEffect(() => {
    router.replace({
      pathname: "/portfolio/[id]/transactions/new/trade",
      params,
    } as Href);
  }, [router, params]);

  return null;
}
