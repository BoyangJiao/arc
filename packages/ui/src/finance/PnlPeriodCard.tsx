/**
 * PnlPeriodCard — 时段盈亏 card (Insights 盈亏分析, L3).
 *
 * Spec: pnl-analysis-insights §J18b / §UI. Big period value change + cumulative
 * return % chart + metric rows (MWR / annualized / realized), each with an
 * optional ⓘ explainer. Presentational — strings + signs come from the screen.
 */

import type { ReactNode } from "react";
import { View } from "react-native";

import { Card } from "../primitives";
import { Text } from "../primitives/Text";
import { CumulativeReturnChart, type PercentAxisInput } from "../charts";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_LABEL, TYPO_TITLE, typographyClass } from "../tokens/typography";

import { InfoTooltipButton } from "./InfoTooltipButton";
import { pnlTextClass, type PnlSign } from "./pnl-types";

export interface PnlMetricRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly sign?: PnlSign;
  readonly tooltip?: { readonly title: string; readonly body: string; readonly closeLabel: string };
}

export interface PnlPeriodCardProps {
  readonly sectionTitle: string;
  /** Pre-interpolated, e.g. "3 个月资产市值变化". */
  readonly periodLabel: string;
  readonly valueChangeLabel: string;
  readonly valueChangeSign: PnlSign;
  readonly dateRangeLabel: string;
  readonly chartData: ReadonlyArray<PercentAxisInput>;
  readonly chartLoading?: boolean;
  readonly chartEmptyLabel?: string;
  readonly formatPercent?: (pct: number) => string;
  readonly metrics: ReadonlyArray<PnlMetricRow>;
}

export function PnlPeriodCard(props: PnlPeriodCardProps): ReactNode {
  const {
    sectionTitle,
    periodLabel,
    valueChangeLabel,
    valueChangeSign,
    dateRangeLabel,
    chartData,
    chartLoading = false,
    chartEmptyLabel,
    formatPercent,
    metrics,
  } = props;
  const classes = useBusinessClasses();

  return (
    <Card>
      <View className="p-4 gap-3">
        <Text className={TYPO_TITLE}>{sectionTitle}</Text>

        <View className="gap-0.5">
          <Text className={`${TYPO_CAPTION} text-muted`}>{periodLabel}</Text>
          <Text className={typographyClass("display2xl", pnlTextClass(valueChangeSign, classes))}>
            {valueChangeLabel}
          </Text>
          <Text className={`${TYPO_CAPTION} text-muted`}>{dateRangeLabel}</Text>
        </View>

        <CumulativeReturnChart
          data={chartData}
          loading={chartLoading}
          emptyLabel={chartEmptyLabel}
          formatPercent={formatPercent}
        />

        <View className="gap-2 pt-1">
          {metrics.map((row) => (
            <View key={row.key} className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Text className={`${TYPO_LABEL} text-muted`}>{row.label}</Text>
                {row.tooltip ? (
                  <InfoTooltipButton
                    title={row.tooltip.title}
                    body={row.tooltip.body}
                    closeLabel={row.tooltip.closeLabel}
                  />
                ) : null}
              </View>
              <Text
                className={typographyClass(
                  "rowValue",
                  pnlTextClass(row.sign ?? "neutral", classes)
                )}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
