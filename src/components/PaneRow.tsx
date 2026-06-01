import { memo } from "react";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react";
import { Button } from "./Button";
import type { Side } from "../types/items";

type PaneRowProps = {
  index: number;
  top: number;
  id: string | undefined;
  side: Side;
  draggedId: string | null;
  onMove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (targetId: string) => void;
};

export const PaneRow = memo(function PaneRow(props: PaneRowProps) {
  const { top, id, side, draggedId, onMove, onDragStart, onDragEnd, onDrop } = props;

  return (
    <div
      className={[
        "absolute left-0 right-0 flex h-12 items-center justify-between gap-2.5 rounded-md border px-2 py-0 pl-3 hover:border-[#dbe2dd] hover:bg-[#f5f7f5]",
        id && draggedId === id ? "border-[#23685a] bg-[#e7f0ed]" : "border-transparent",
        id ? "" : "pointer-events-none bg-[#f8faf8]"
      ].join(" ")}
      draggable={Boolean(id) && side === "selected"}
      onDragStart={() => id && onDragStart(id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => side === "selected" && event.preventDefault()}
      onDrop={() => id && onDrop(id)}
      style={{ top }}
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
        <Button variant="icon" onClick={() => onMove(id)} title={side === "selected" ? "Убрать" : "Выбрать"}>
          {side === "selected" ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
        </Button>
      ) : null}
    </div>
  );
});
