'use client';

import { useEffect, useState } from 'react';

interface TableListProps {
  onSelectTable: (tableName: string) => void;
  selectedTable: string | null;
}

export default function TableList({ onSelectTable, selectedTable }: TableListProps) {
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tables');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tables');
      }

      setTables(data.tables);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={fetchTables}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-white">Tables</h2>
      <div className="space-y-1">
        {tables.length === 0 ? (
          <p className="text-gray-400">No tables found</p>
        ) : (
          tables.map((table) => (
            <button
              key={table}
              onClick={() => onSelectTable(table)}
              className={`w-full text-left px-4 py-2 rounded transition-colors ${
                selectedTable === table
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              {table}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
