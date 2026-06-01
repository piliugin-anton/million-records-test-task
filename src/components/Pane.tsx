import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, Search } from "lucide-react";
import { iconButtonClass } from "./buttonStyles";
import type { Side } from "../types/items";

const ROW_HEIGHT = 52;
const OVERSCAN = 8;
const MAX_SCROLL_HEIGHT = 8_000_000;

type PaneProps = {
  title: string;
  side: Side;
  query: string;
  onQueryChange: (value: string) => void;
  getItem: (index: number) => string | undefined;
  total: number;
  loading: boolean;
  loadRange: (startIndex: number, endIndex: number) => void;
  onMove: (id: string) => void;
  onReorder?: (items: string[]) => void;
};

export function Pane(props: PaneProps) {
  const { title, side, query, onQueryChange, getItem, total, loading, loadRange, onMove, onReorder } = props;
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const totalContentHeight = total * ROW_HEIGHT;
  const scrollableHeight = totalContentHeight > 0 ? Math.min(totalContentHeight, MAX_SCROLL_HEIGHT) : viewportHeight;
  const scrollScale = totalContentHeight > 0 ? scrollableHeight / totalContentHeight : 1;
  const logicalScrollTop = scrollScale > 0 ? scrollTop / scrollScale : 0;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      setViewportHeight(entry.contentRect.height);
    });

    resizeObserver.observe(scroller);
    setViewportHeight(scroller.clientHeight);
    return () => resizeObserver.disconnect();
  }, []);

  const visibleRange = useMemo(() => {
    if (total === 0 || viewportHeight === 0) {
      return { startIndex: 0, endIndex: -1 };
    }

    const firstVisible = Math.floor(logicalScrollTop / ROW_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
    const startIndex = Math.max(0, firstVisible - OVERSCAN);
    const endIndex = Math.min(total - 1, firstVisible + visibleCount + OVERSCAN);

    return { startIndex, endIndex };
  }, [logicalScrollTop, total, viewportHeight]);

  useEffect(() => {
    loadRange(visibleRange.startIndex, visibleRange.endIndex);
  }, [loadRange, visibleRange.endIndex, visibleRange.startIndex]);

  const virtualRows = useMemo(() => {
    if (visibleRange.endIndex < visibleRange.startIndex) return [];

    return Array.from(
      { length: visibleRange.endIndex - visibleRange.startIndex + 1 },
      (_value, index) => visibleRange.startIndex + index
    );
  }, [visibleRange.endIndex, visibleRange.startIndex]);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || side !== "selected") return;

    const nextItems = virtualRows.map((index) => getItem(index)).filter((id): id is string => Boolean(id));
    const from = nextItems.indexOf(draggedId);
    const to = nextItems.indexOf(targetId);
    if (from < 0 || to < 0) return;

    nextItems.splice(from, 1);
    nextItems.splice(to, 0, draggedId);
    onReorder?.(nextItems);
    setDraggedId(null);
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#d7ddd9] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5e9e6] p-3.5 max-[860px]:flex-col max-[860px]:items-stretch">
        <div>
          <h2 className="m-0 text-lg leading-tight">{title}</h2>
          <span className="mt-0.5 block text-[13px] text-[#67716a]">
            {total}
          </span>
        </div>
        <label className="flex h-10 w-[42%] max-w-[260px] items-center gap-2 rounded-md border border-[#d7ddd9] bg-[#f4f6f4] px-2.5 max-[860px]:w-full max-[860px]:max-w-none">
          <Search className="flex-none text-[#64716a]" size={18} />
          <input
            className="min-w-0 bg-transparent text-[#17201b] outline-none"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Фильтр по ID"
          />
        </label>
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-auto p-2"
        aria-label={title}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div className="relative" style={{ height: Math.max(scrollableHeight, viewportHeight) }}>
          {virtualRows.map((index) => {
            const id = getItem(index);
            const logicalRowTop = index * ROW_HEIGHT;
            const visualRowTop = scrollTop + (logicalRowTop - logicalScrollTop);

            return (
              <div
                className={[
                  "absolute left-0 right-0 flex h-12 items-center justify-between gap-2.5 rounded-md border px-2 py-0 pl-3 hover:border-[#dbe2dd] hover:bg-[#f5f7f5]",
                  id && draggedId === id ? "border-[#23685a] bg-[#e7f0ed]" : "border-transparent",
                  id ? "" : "pointer-events-none bg-[#f8faf8]"
                ].join(" ")}
                draggable={Boolean(id) && side === "selected"}
                key={index}
                onDragStart={() => id && setDraggedId(id)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => side === "selected" && event.preventDefault()}
                onDrop={() => id && handleDrop(id)}
                style={{ transform: `translateY(${visualRowTop}px)` }}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {side === "selected" ? (
                    <GripVertical className="flex-none cursor-grab text-[#78827b]" size={18} />
                  ) : (
                    <span className="h-2 w-2 flex-none rounded-full bg-[#d29a3f]" />
                  )}
                  <span className="truncate whitespace-nowrap">{id ? `ID ${id}` : "Загрузка..."}</span>
                </div>
                {id ? (
                  <button className={iconButtonClass} onClick={() => onMove(id)} title={side === "selected" ? "Убрать" : "Выбрать"}>
                    {side === "selected" ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
                  </button>
                ) : null}
              </div>
            );
          })}

          {total === 0 ? (
            <div className="flex h-11 items-center justify-center text-sm text-[#6d766f]">
              {loading ? "Загрузка..." : "Нет элементов"}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
