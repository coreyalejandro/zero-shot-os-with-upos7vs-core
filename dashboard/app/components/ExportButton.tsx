"use client";

interface ExportButtonProps {
  data: any;
  filename: string;
  format?: "json" | "csv";
}

export default function ExportButton({ data, filename, format = "json" }: ExportButtonProps) {
  const handleExport = () => {
    if (format === "json") {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === "csv") {
      // Simple CSV conversion for arrays of objects
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvRows = [
          headers.join(","),
          ...data.map((row) =>
            headers
              .map((header) => {
                const value = row[header];
                if (value === null || value === undefined) return "";
                if (typeof value === "object") return JSON.stringify(value);
                return String(value).replace(/"/g, '""');
              })
              .join(",")
          ),
        ];
        const csv = csvRows.join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
    >
      Export {format.toUpperCase()}
    </button>
  );
}
