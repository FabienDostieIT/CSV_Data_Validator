"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { type Payload } from "recharts/types/component/DefaultTooltipContent";
import { type Props as DefaultLegendContentProps } from "recharts/types/component/DefaultLegendContent";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    hide?: boolean;
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

// Define props for the ChartTooltip, extending Recharts types
interface ChartTooltipProps extends RechartsPrimitive.TooltipProps<number | string, string> {
  indicator?: 'dot' | 'line' | 'dashed';
  hideLabel?: boolean;
  hideIndicator?: boolean;
  labelKey?: string;
  labelFormatter?: (label: string, payload: Payload<number | string, string>[]) => React.ReactNode;
  formatter?: (value: number | string | Array<number | string>, name: string, item: Payload<number | string, string>, index: number, payload: Payload<number | string, string>[]) => React.ReactNode;
  color?: string;
  className?: string;
}

const ChartTooltip = ({ active, payload, label, className, indicator = "dot", hideLabel, hideIndicator, formatter, color }: ChartTooltipProps) => {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload || payload.length === 0) {
      return null;
    }
    const [item] = payload;
    const itemConfig = getPayloadConfigFromPayload(config, item);
    const value: React.ReactNode | undefined = label || (itemConfig ? itemConfig.label : undefined);

    if (!value) {
      return null;
    }

    return <div className="font-medium">{value}</div>;
   
  }, [label, payload, hideLabel, config]);

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const itemConfig = getPayloadConfigFromPayload(config, item);
          const indicatorColor = color || (item.payload as { fill?: string })?.fill || item.color as string || "hsl(var(--foreground))";

          return (
            <div
              key={item.dataKey as string}
              className={cn(
                "flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center"
              )}
            >
              {formatter && item?.value !== undefined && item.name !== undefined ? (
                formatter(item.value as number | string | Array<number | string>, item.name as string, item, index, payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                          {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          }
                        )}
                        style={{
                          "--color-bg": indicatorColor,
                          "--color-border": indicatorColor,
                        } as React.CSSProperties}
                      />
                    )
                  )}
                  <div
                    className={cn(
                      "flex flex-1 justify-between leading-none",
                      nestLabel ? "items-end" : "items-center"
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label || item.name as string}
                      </span>
                    </div>
                    {item.value !== undefined && (
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {(item.value as number | { toString: () => string}).toLocaleString()}
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

// Define props for ChartLegend, extending Recharts types
interface ChartLegendProps extends RechartsPrimitive.LegendProps {
  hideIcon?: boolean;
  className?: string;
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

const ChartLegend = ({ className, hideIcon, verticalAlign = "bottom" }: ChartLegendProps) => {
  const { config } = useChart();

  const renderLegendItem = (props: DefaultLegendContentProps) => {
    const { payload } = props;
    if (!payload) return null;

    return (
      <div
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item) => {
          const itemConfig = getPayloadConfigFromPayload(config, item);
          const color = itemConfig?.color || item.color as string || "hsl(var(--foreground))";

          if (itemConfig?.hide) {
            return null;
          }

          return (
            <div
              key={String(item.value)} 
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                !hideIcon && (
                  <div
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                )
              )}
              {itemConfig?.label || String(item.value)}
            </div>
          );
        })}
      </div>
    );
  };

  return <RechartsPrimitive.Legend content={renderLegendItem} />;
};
ChartLegend.displayName = "ChartLegend";

// Define a minimal interface for payload items used by the helper
interface MinimalPayloadItem {
  dataKey?: string | number | ((obj: any) => any);
  name?: string;
  color?: string;
  value?: any;
  payload?: Record<string, unknown>;
}

// Helper to find the chart config matching the payload item
const getPayloadConfigFromPayload = (
  config: ChartConfig,
  item: MinimalPayloadItem,
): ChartConfig[string] | undefined => {
  if (typeof item.dataKey === "string") {
    return config[item.dataKey];
  }

  return undefined;
}

// Export all components
export {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  useChart,
};
