import { useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, Search } from "lucide-react";
import { iconButtonClass } from "./buttonStyles";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import type { Side } from "../types/items";

type PaneProps = {
  title: string;
  side: Side;
  query: string;
  onQueryChange: (value: string) => void;
  items: string[];
  total: number;
  loading: boolean;
  loadMore: () => void;
  onMove: (id: string) => void;
  onReorder?: (items: string[]) => void;
};

export function Pane(props: PaneProps) {
  const { title, side, query, onQueryChange, items, total, loading, loadMore, onMove, onReorder } = props;
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const sentinelRef = useInfiniteScroll(loadMore, items.length < total || items.length === 0);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || side !== "selected") return;

    const nextItems = [...items];
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
            {items.length} / {total}
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

      <div className="min-h-[420px] flex-1 overflow-auto p-2 max-[860px]:min-h-[360px]" aria-label={title}>
        {items.map((id) => (
          <div
            className={[
              "mt-1 flex h-12 items-center justify-between gap-2.5 rounded-md border px-2 py-0 pl-3 first:mt-0 hover:border-[#dbe2dd] hover:bg-[#f5f7f5]",
              draggedId === id ? "border-[#23685a] bg-[#e7f0ed]" : "border-transparent"
            ].join(" ")}
            draggable={side === "selected"}
            key={id}
            onDragStart={() => setDraggedId(id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => side === "selected" && event.preventDefault()}
            onDrop={() => handleDrop(id)}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {side === "selected" ? (
                <GripVertical className="flex-none cursor-grab text-[#78827b]" size={18} />
              ) : (
                <span className="h-2 w-2 flex-none rounded-full bg-[#d29a3f]" />
              )}
              <span className="truncate whitespace-nowrap">ID {id}</span>
            </div>
            <button className={iconButtonClass} onClick={() => onMove(id)} title={side === "selected" ? "Убрать" : "Выбрать"}>
              {side === "selected" ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </button>
          </div>
        ))}

        <div ref={sentinelRef} className="flex h-11 items-center justify-center text-sm text-[#6d766f]">
          {loading ? "Загрузка..." : items.length >= total ? "Конец списка" : ""}
        </div>
      </div>
    </section>
  );
}
