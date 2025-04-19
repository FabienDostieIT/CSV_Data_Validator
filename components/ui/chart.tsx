"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { type Payload } from "recharts/types/component/DefaultTooltipContent";
import type { LegendProps } from "recharts/types/component/Legend";
import type { TooltipProps } from "recharts/types/component/Tooltip";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme || itemConfig.color,
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, _prefix]) => `
${_prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`,
          )
          .join("\n"),
      }}
    />
  );
};

// Define explicit prop types using Recharts types
interface ChartTooltipProps extends RechartsPrimitive.TooltipProps<number | string, string> {
  indicator?: RechartsPrimitive.ChartIndicator;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  labelKey?: string;
  labelFormatter?: (label: string, payload: Payload<number | string, string>[]) => React.ReactNode;
  formatter?: (value: number | string | Array<number | string>, name: string, item: Payload<number | string, string>, index: number, payload: Payload<number | string, string>["payload"] | undefined) => React.ReactNode;
  color?: string;
  className?: string;
}

const ChartTooltip = ({ active, payload, label, className, indicator = "dot", hideLabel, hideIndicator, formatter, color }: ChartTooltipProps) => {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload || payload.length === 0) {
      return null;
    }

    const item = payload[0];
    const key = `${String(item.dataKey ?? '') || item.name || "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key) ?? {};
    const value =
      typeof label === "string"
        ? config[label]?.label || label
        : itemConfig?.label;

    if (!value) {
      return null;
    }

    return <div className={cn("font-medium")}>{value}</div>;
  }, [
    label,
    payload,
    config,
    hideLabel,
  ]);

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item: Payload<number | string, string>, index: number) => {
          const key = `${String(item.dataKey ?? '') || item.name || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key) ?? {};
          
          let payloadFill: string | undefined = undefined;
          if (typeof item.payload === 'object' && item.payload !== null && 'fill' in item.payload) {
              const fillValue = (item.payload as Record<string, unknown>).fill;
              if (typeof fillValue === 'string') {
                  payloadFill = fillValue;
              }
          }
          
          const itemColor = typeof item.color === 'string' ? item.color : undefined;
          const indicatorColor: string = color || itemColor || payloadFill || "hsl(var(--primary))";
          
          let formatterPayload: Payload<number | string, string>["payload"] | undefined = undefined;
          if (
            typeof item.payload === 'object' && 
            item.payload !== null && 
            !(item.payload instanceof Error)
          ) {
            // Disable persistent error for this assignment after checks
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            formatterPayload = item.payload; 
          }

          const safeValue = (typeof item.value === 'number' || typeof item.value === 'string') ? item.value : 0;
          const safeName = item.name ?? key;

          return (
            <div
              key={String(item.value)}
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center",
              )}
            >
              {formatter && item.name ? (
                formatter(safeValue, safeName, item, index, formatterPayload)
              ) : (
                <>
                  {itemConfig.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                          {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent":
                              indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          },
                        )}
                        style={
                          {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn(
                      "flex flex-1 justify-between leading-none",
                      nestLabel ? "items-end" : "items-center",
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label || item.name}
                      </span>
                    </div>
                    {item.value !== undefined && item.value !== null && (
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {(Number(item.value)).toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
ChartTooltip.displayName = "ChartTooltip";

// Define explicit prop types
interface ChartLegendProps extends LegendProps {
  hideIcon?: boolean;
  className?: string;
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

const ChartLegend = ({ className, hideIcon, verticalAlign = "bottom" }: ChartLegendProps) => {
  const { config } = useChart();

  const resolvedConfig = React.useMemo(() => {
    const resolvedConfig = config
      ? Object.keys(config).map((key) => {
          const itemConfig = config[key];
          return {
            key,
            ...itemConfig,
          };
        })
      : [];

    return resolvedConfig.filter((item) => item && !item.hide);
  }, [config]);

  if (!resolvedConfig || resolvedConfig.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {resolvedConfig.map((item) => {
        if (!item) return null;
        return (
          <div
            key={item.key}
            className={cn(
              "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
            )}
          >
            {item.icon && !hideIcon ? (
              <item.icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            {item.label}
          </div>
        );
      })}
    </div>
  );
};
ChartLegend.displayName = "ChartLegend";

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: Payload<number | string, string>,
  key: string,
): ChartConfig[string] | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload = 
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload as Record<string, unknown>
      : undefined;

  let configLabelKey: string = key;

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === "string"
  ) {
    configLabelKey = payloadPayload[key];
  }

  if (configLabelKey in config) {
    return config[configLabelKey];
  }
  if (key in config) {
    return config[key];
  }
  
  return undefined;
}

export {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartStyle,
};
