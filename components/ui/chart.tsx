"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { type Payload as RechartsPayload } from "recharts/types/component/DefaultTooltipContent";
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
interface ChartTooltipProps {
  className?: string;
  payload?: Array<{
    dataKey?: string | number | ((obj: unknown) => unknown);
    name?: string;
    color?: string;
    value?: unknown;
    payload?: Record<string, unknown>;
  }>;
  active?: boolean;
  config?: ChartConfig;
  label?: string | React.ReactElement;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: 'dot' | 'line' | 'dashed';
  labelKey?: string;
  labelFormatter?: (label: string, payload: Array<any>) => React.ReactNode;
  formatter?: (value: number | string | Array<number | string>, name: string, item: any, index: number, payload: Array<any>) => React.ReactNode;
  color?: string;
  showValue?: boolean;
  valueFormatter?: (value: unknown) => unknown;
}

// Define a more specific type for our safe payload item that uses optional properties
interface MinimalPayloadItem {
  dataKey?: string | number | ((obj: unknown) => unknown);
  name?: string;
  color?: string;
  value?: unknown;
  payload?: Record<string, unknown>;
}

// Helper function to retrieve config based on the payload item
const getPayloadConfigFromPayload = (
  config: ChartConfig,
  item: MinimalPayloadItem,
): ChartConfig[string] | undefined => {
  if (!config || !item.dataKey) {
    return undefined;
  }

  const key = typeof item.dataKey === 'string' ? item.dataKey : String(item.dataKey);
  return config[key];
}

export function ChartTooltip({
  className,
  payload,
  active,
  config = {},
  label,
  hideLabel = false,
  showValue = false,
  valueFormatter = (value) => value,
  indicator = "dot",
  hideIndicator = false,
  formatter,
  color,
}: ChartTooltipProps) {
  const { config: chartConfig } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload || payload.length === 0) {
      return null;
    }
    const firstItem = payload[0];
    if (!firstItem) {
      return null;
    }
    
    // No need to convert since we properly typed the Payload
    const itemConfig = getPayloadConfigFromPayload(config, firstItem);
    
    // Fix the TypeScript error by properly typing the values
    let displayValue: React.ReactNode;
    
    if (typeof label === 'string' || React.isValidElement(label)) {
      displayValue = label;
    } else if (itemConfig?.label && (typeof itemConfig.label === 'string' || React.isValidElement(itemConfig.label))) {
      displayValue = itemConfig.label;
    } else if (firstItem.name && typeof firstItem.name === 'string') {
      displayValue = firstItem.name;
    } else {
      return null; // No valid label found
    }

    return <div className="font-medium">{displayValue}</div>;
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
          // Use item as is since it already matches MinimalPayloadItem
          const itemPayload = item.payload;
          const fill = itemPayload?.fill as string | undefined;
          const itemColor = color || fill || (item.color) || "hsl(var(--foreground))";
          const itemConfig = getPayloadConfigFromPayload(config, item);

          return (
            <div
              key={typeof item.dataKey === 'string' ? item.dataKey : index}
              className={cn(
                "flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center"
              )}
            >
              {formatter && item.value !== undefined && item.name !== undefined ? (
                formatter(item.value as number | string | Array<number | string>, item.name, item, index, payload)
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
                          "--color-bg": itemColor,
                          "--color-border": itemColor,
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
                        {itemConfig?.label || item.name || (item.dataKey ? String(item.dataKey) : "Unknown")}
                      </span>
                    </div>
                    {item.value !== undefined && (
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {typeof item.value === 'number' 
                          ? (item.value as number).toLocaleString()
                          : typeof item.value === 'string'
                            ? item.value
                            : JSON.stringify(item.value)}
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
}
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
        {payload.map((item, index) => {
          const itemPayload = item.payload || {};
          const itemConfig = config[item.dataKey as string] || {};
          const color = itemConfig?.color || (item.color as string) || "hsl(var(--foreground))";

          if (itemConfig?.hide) {
            return null;
          }

          return (
            <div
              key={index} 
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
              {itemConfig?.label || (item.value !== undefined ? String(item.value) : "")}
            </div>
          );
        })}
      </div>
    );
  };

  return <RechartsPrimitive.Legend content={renderLegendItem} />;
};
ChartLegend.displayName = "ChartLegend";

// Export all components
export {
  ChartContainer,
  ChartLegend,
  useChart,
};

