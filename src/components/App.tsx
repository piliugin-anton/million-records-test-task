import { useMemo, useState } from "react";
import { Plus, RotateCw } from "lucide-react";
import { apiQueue } from "../api/apiQueue";
import { usePagedItems } from "../hooks/usePagedItems";
import { parseIds } from "../utils/parseIds";
import { Button } from "./Button";
import { Input } from "./Input";
import { Pane } from "./Pane";

export function App() {
  const [availableQuery, setAvailableQuery] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");
  const [newId, setNewId] = useState("");
  const available = usePagedItems("available", availableQuery);
  const selected = usePagedItems("selected", selectedQuery);

  const addPreview = useMemo(() => parseIds(newId), [newId]);

  const handleAdd = () => {
    if (addPreview.length === 0) return;
    apiQueue.add(addPreview);
    available.optimisticAdd(addPreview);
    setNewId("");
  };

  const handleSelect = (id: string) => {
    apiQueue.select(id);
    available.optimisticRemove(id);
    selected.optimisticAppend(id);
  };

  const handleUnselect = (id: string) => {
    apiQueue.unselect(id);
    selected.optimisticRemove(id);
    available.optimisticReturn(id);
  };

  const handleReorder = (nextItems: string[]) => {
    selected.reorderLoadedItems(nextItems);
    apiQueue.reorder(nextItems);
  };

  return (
    <main className="flex h-screen min-w-80 flex-col gap-[18px] overflow-hidden bg-[#eef1eb] p-6 font-sans text-[#17201b] antialiased max-[860px]:p-3.5">
      <header className="flex shrink-0 items-center justify-between gap-[18px] max-[860px]:flex-col max-[860px]:items-stretch">
        <div>
          <h1 className="m-0 text-[28px] leading-tight">Million Records</h1>
          <p className="mt-1.5 mb-0 text-[#5d675f]">Выбор, фильтрация и порядок элементов хранятся на Express-сервере в памяти.</p>
        </div>
        <div className="flex items-center gap-2 max-[860px]:flex-wrap max-[860px]:items-stretch">
          <Input
            className="w-[220px] max-[860px]:min-w-[180px] max-[860px]:flex-1"
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAdd()}
            placeholder="Новый ID"
          />
          <Button variant="primary" onClick={handleAdd} disabled={addPreview.length === 0}>
            <Plus size={18} />
            Добавить
          </Button>
          <Button
            variant="icon"
            onClick={() => {
              available.refresh();
              selected.refresh();
            }}
            title="Обновить списки"
          >
            <RotateCw size={18} />
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-1 gap-[18px] overflow-hidden max-[860px]:grid-cols-1 max-[860px]:grid-rows-2">
        <Pane
          title="Все элементы"
          side="available"
          query={availableQuery}
          onQueryChange={setAvailableQuery}
          getItem={available.getItem}
          total={available.total}
          loading={available.loading}
          loadRange={available.loadRange}
          onMove={handleSelect}
        />
        <Pane
          title="Выбранные"
          side="selected"
          query={selectedQuery}
          onQueryChange={setSelectedQuery}
          getItem={selected.getItem}
          total={selected.total}
          loading={selected.loading}
          loadRange={selected.loadRange}
          onMove={handleUnselect}
          onReorder={handleReorder}
        />
      </div>
    </main>
  );
}
