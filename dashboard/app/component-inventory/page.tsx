import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ComponentInventoryModule,
  ComponentInventoryItem,
} from "../components/inventory/ComponentInventoryModule";

type InventoryComponent = {
  id: string;
  name: string;
  type?: string;
  status?: string;
  ownerName?: string;
  version?: string;
  location?: string[];
  description?: string;
};

type InventoryFile = {
  components?: InventoryComponent[];
};

async function loadInventory(): Promise<{
  items: ComponentInventoryItem[];
  total: number;
  error?: string;
}> {
  const inventoryPath = path.resolve(process.cwd(), "..", "components.json");

  try {
    const raw = await readFile(inventoryPath, "utf-8");
    const parsed = JSON.parse(raw) as InventoryFile;
    const items = (parsed.components ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      status: item.status,
      ownerName: item.ownerName,
      version: item.version,
      location: item.location,
      description: item.description,
    }));

    return {
      items,
      total: items.length,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error loading inventory.";

    return {
      items: [],
      total: 0,
      error: `Inventory load error: ${message}`,
    };
  }
}

export default async function ComponentInventoryPage() {
  const { items, total, error } = await loadInventory();

  return (
    <ComponentInventoryModule items={items} total={total} error={error} />
  );
}
