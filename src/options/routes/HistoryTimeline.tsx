import { useEffect, useMemo, useRef } from "react";
import { DataSet, Timeline } from "vis-timeline/standalone";
import "vis-timeline/dist/vis-timeline-graph2d.css";

import type { JobFillEvent, JobFillStatus } from "../../ui-shared/types.history";
import { statusLabel, STATUS_COLORS } from "./History";

export type TimelineGranularity = "day" | "week" | "month";

interface HistoryTimelineProps {
  events: JobFillEvent[];
  granularity: TimelineGranularity;
  onGranularityChange: (value: TimelineGranularity) => void;
  onRangeSelected: (range: { from: number; to: number } | null) => void;
  selectedRange?: { from?: number; to?: number };
}

interface TimelineBucket {
  id: string;
  status: JobFillStatus;
  start: number;
  end: number;
  count: number;
}

const GRANULARITY_OPTIONS: { value: TimelineGranularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" }
];

const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;

export function HistoryTimeline({
  events,
  granularity,
  onGranularityChange,
  onRangeSelected,
  selectedRange
}: HistoryTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<Timeline | null>(null);

  const { items, groups, bucketMap, window } = useMemo(() => buildTimelineData(events, granularity), [events, granularity]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (timelineRef.current) {
      timelineRef.current.destroy();
      timelineRef.current = null;
    }

    const zoomMin = granularity === "day" ? MILLIS_IN_DAY * 7 : granularity === "week" ? MILLIS_IN_DAY * 30 : MILLIS_IN_DAY * 90;
    const zoomMax = granularity === "day" ? MILLIS_IN_DAY * 90 : granularity === "week" ? MILLIS_IN_DAY * 365 : MILLIS_IN_DAY * 730;
    const padding = granularity === "day" ? MILLIS_IN_DAY * 2 : granularity === "week" ? MILLIS_IN_DAY * 7 : MILLIS_IN_DAY * 30;

    const timeline = new Timeline(
      containerRef.current,
      new DataSet(items),
      new DataSet(groups),
      {
        stack: false,
        zoomMin,
        zoomMax,
        orientation: "top",
        selectable: true,
        multiselect: false,
        margin: { item: { horizontal: 2 }, axis: 10 },
        maxHeight: 420,
        zoomKey: "ctrlKey",
        tooltip: { followMouse: true },
        snap: null,
        format: {
          minorLabels: {
            day: granularity === "day" ? "D" : "DD",
            week: "w",
            month: "MMM"
          },
          majorLabels: {
            day: "MMM YYYY",
            week: "MMM YYYY",
            month: "YYYY"
          }
        }
      }
    );

    if (window) {
      timeline.fit();
      timeline.setWindow(window.start - padding, window.end + padding, { animation: false });
    }

    const handleSelect = (properties: { item: string | number | null }) => {
      if (!properties.item) {
        onRangeSelected(null);
        return;
      }
      const bucket = bucketMap.get(String(properties.item));
      if (bucket) {
        onRangeSelected({ from: bucket.start, to: bucket.end - 1 });
      }
    };

    const handleDoubleClick = () => {
      onRangeSelected(null);
      timeline.setSelection([]);
    };

    timeline.on("select", handleSelect);
    timeline.on("doubleClick", handleDoubleClick);

    timelineRef.current = timeline;

    return () => {
      timeline.off("select", handleSelect);
      timeline.off("doubleClick", handleDoubleClick);
      timeline.destroy();
      timelineRef.current = null;
    };
  }, [items, groups, bucketMap, granularity, onRangeSelected, window]);

  useEffect(() => {
    if (!timelineRef.current || !selectedRange?.from || !selectedRange?.to) {
      return;
    }
    const match = Array.from(bucketMap.values()).find(
      (bucket) => bucket.start === selectedRange.from && bucket.end - 1 === selectedRange.to
    );
    if (match) {
      timelineRef.current.setSelection([match.id], { focus: true, animation: false });
    }
  }, [selectedRange, bucketMap]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-slate-500">Granularity</span>
          <div className="flex items-center gap-1">
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onGranularityChange(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  option.value === granularity ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <TimelineLegend />
      </div>
      <div ref={containerRef} className="h-[360px] w-full rounded border border-slate-200 bg-white" />
      <p className="text-xs text-slate-500">
        Click a colored bar to filter the history list to that period. Double-click an empty area to clear the filter.
      </p>
    </div>
  );
}

function buildTimelineData(events: JobFillEvent[], granularity: TimelineGranularity) {
  const bucketMap = new Map<string, TimelineBucket>();
  const groups = STATUS_ORDER.map((status) => ({
    id: status,
    content: statusLabel(status),
    style: `color: ${STATUS_COLORS[status]}; font-weight: 600;`
  }));

  const bucketsByKey = new Map<string, TimelineBucket>();

  for (const event of events) {
    const { start, end } = bucketBounds(event.createdAt, granularity);
    const key = `${event.status}-${start}`;
    const bucket = bucketsByKey.get(key);
    if (bucket) {
      bucket.count += 1;
    } else {
      bucketsByKey.set(key, {
        id: key,
        status: event.status,
        start,
        end,
        count: 1
      });
    }
  }

  const items = Array.from(bucketsByKey.values()).map((bucket) => {
    const color = STATUS_COLORS[bucket.status];
    bucketMap.set(bucket.id, bucket);
    return {
      id: bucket.id,
      group: bucket.status,
      start: new Date(bucket.start),
      end: new Date(bucket.end),
      content: `${bucket.count}`,
      title: `${statusLabel(bucket.status)} — ${bucket.count} entr${bucket.count === 1 ? "y" : "ies"}`,
      style: `background-color: ${color}; border-color: ${color}; color: white; font-weight: 600; text-align: center;`
    };
  });

  if (!items.length) {
    return { items, groups, bucketMap, window: null };
  }

  const starts = items.map((item) => (item.start as Date).getTime());
  const ends = items.map((item) => (item.end as Date).getTime());
  const window = {
    start: Math.min(...starts),
    end: Math.max(...ends)
  };

  return { items, groups, bucketMap, window };
}

function bucketBounds(timestamp: number, granularity: TimelineGranularity) {
  const date = new Date(timestamp);

  if (granularity === "day") {
    const start = startOfDay(date);
    return { start, end: start + MILLIS_IN_DAY };
  }

  if (granularity === "week") {
    const start = startOfWeek(date);
    return { start, end: start + MILLIS_IN_DAY * 7 };
  }

  const start = startOfMonth(date);
  const endMonth = new Date(start);
  endMonth.setMonth(endMonth.getMonth() + 1);
  return { start, end: endMonth.getTime() };
}

function startOfDay(date: Date): number {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setHours(0, 0, 0, 0);
  return result.getTime();
}

function startOfWeek(date: Date): number {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result.getTime();
}

function startOfMonth(date: Date): number {
  const result = new Date(date.getFullYear(), date.getMonth(), 1);
  result.setHours(0, 0, 0, 0);
  return result.getTime();
}

const STATUS_ORDER: JobFillStatus[] = ["saved", "applied", "interview", "rejected", "offer"];

function TimelineLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      {STATUS_ORDER.map((status) => (
        <span key={status} className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[status] }}
          />
          {statusLabel(status)}
        </span>
      ))}
    </div>
  );
}

