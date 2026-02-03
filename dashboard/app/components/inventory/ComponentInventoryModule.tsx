import React from "react";

export type ComponentInventoryItem = {
  id: string;
  name: string;
  type?: string;
  status?: string;
  ownerName?: string;
  version?: string;
  location?: string[];
  description?: string;
};

export type ComponentInventoryModuleProps = {
  items: ComponentInventoryItem[];
  total: number;
  error?: string;
};

export function ComponentInventoryModule({
  items,
  total,
  error,
}: ComponentInventoryModuleProps) {
  return (
    <main className="max-w-7xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-3xl font-semibold text-gray-900"
            data-testid="component-inventory-heading"
          >
            Component Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Total Components: {total}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Inventory Items
          </h2>
        </div>
        {items.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-500">
            No components found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div
                key={item.id}
                className="px-6 py-4 flex flex-col gap-2"
                data-testid="component-inventory-row"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">{item.id}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {item.type ? (
                      <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                        {item.type}
                      </span>
                    ) : null}
                    {item.status ? (
                      <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        {item.status}
                      </span>
                    ) : null}
                  </div>
                </div>
                {item.description ? (
                  <p className="text-sm text-gray-600">{item.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  {item.ownerName ? (
                    <span>Owner: {item.ownerName}</span>
                  ) : null}
                  {item.version ? <span>Version: {item.version}</span> : null}
                  {item.location && item.location.length > 0 ? (
                    <span>Location: {item.location.join(", ")}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
