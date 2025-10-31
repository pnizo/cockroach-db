'use client';

import { useEffect, useState } from 'react';

interface DataTableProps {
  tableName: string;
}

interface TableData {
  data: any[];
  total: number;
  limit: number;
  offset: number;
}

export default function DataTable({ tableName }: DataTableProps) {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    fetchData();
  }, [tableName, page, pageSize]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const offset = page * pageSize;
      const response = await fetch(
        `/api/data/${tableName}?limit=${pageSize}&offset=${offset}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data');
      }

      setTableData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このレコードを削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/data/${tableName}?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete record');
      }

      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={fetchData}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!tableData || tableData.data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">{tableName} (0 records)</h2>
        </div>
        <p className="text-gray-400">データがありません</p>
      </div>
    );
  }

  const columns = Object.keys(tableData.data[0]);
  const totalPages = Math.ceil(tableData.total / pageSize);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">
          {tableName} ({tableData.total} records)
        </h2>
        <div className="flex gap-2">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="bg-gray-700 text-white rounded px-3 py-1"
          >
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
            <option value="200">200 per page</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-gray-700 text-gray-300">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3">
                  {column}
                </th>
              ))}
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableData.data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-gray-700 hover:bg-gray-700/50"
              >
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3 text-gray-200">
                    {row[column] !== null && row[column] !== undefined
                      ? String(row[column])
                      : '-'}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="text-gray-400 text-sm">
          Showing {page * pageSize + 1} to{' '}
          {Math.min((page + 1) * pageSize, tableData.total)} of {tableData.total}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
            className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-white">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
