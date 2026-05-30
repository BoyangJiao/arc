/**
 * PnlPeriodCard — 时段盈亏 card (Insights 盈亏分析, L3).
 *
 * Spec: pnl-analysis-insights §J18b / §UI. Big period value change + cumulative
 * return % chart + metric rows (MWR / annualized / realized), each with an
 * optional ⓘ explainer. Presentational — strings + signs come from the screen.
 *
 * Layout (Revolut/Wise stat-card hierarchy): small overline label → metric
 * descriptor → hero number → date context → chart → metric rows.
 */

import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "../primitives/Text";
import {
  CumulativeReturnChart,
  TimeRangeSelector,
  type PercentAxisInput,
  type TimeRange,
} from "../charts";
import { useBusinessClasses } from "../tokens/business-context";
import { TYPO_CAPTION, TYPO_LABEL, typographyClass } from "../tokens/typography";

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
  /** Time-range pills rendered directly below the chart (Revolut Performance). */
  readonly range: TimeRange;
  readonly onRangeChange: (range: TimeRange) => void;
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
    range,
    onRangeChange,
    metrics,
  } = props;
  const classes = useBusinessClasses();

  return (
    <View className="gap-5">
      {/* Headline: overline → descriptor → hero number → dates. */}
      <View className="gap-1">
        <Text className={typographyClass("overline")}>{sectionTitle}</Text>
        <Text className={`${TYPO_CAPTION} text-muted`}>{periodLabel}</Text>
        <Text
          className={typographyClass(
            "display2xl",
            pnlTextClass(valueChangeSign, classes),
            "leading-none"
          )}
        >
          {valueChangeLabel}
        </Text>
        <Text className={`${TYPO_CAPTION} text-muted`}>{dateRangeLabel}</Text>
      </View>

      {/* Chart + time-range pills directly beneath it (Revolut Performance). */}
      <View className="gap-3">
        <CumulativeReturnChart
          data={chartData}
          loading={chartLoading}
          emptyLabel={chartEmptyLabel}
        />
        <TimeRangeSelector value={range} onChange={onRangeChange} />
      </View>

      <View className="gap-3.5">
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
              className={typographyClass("rowValue", pnlTextClass(row.sign ?? "neutral", classes))}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
