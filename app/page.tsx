'use client';

import { useState, useEffect } from 'react';
import GanttChart from '@/components/GanttChart';
import TaskForm from '@/components/TaskForm';
import Link from 'next/link';

interface Task {
  id: string;
  name: string;
  category: string;
  sub_category: string;
  start_date: string | null;
  end_date: string | null;
  assignee: string | null;
  status: string;
  display_order: number;
  events: Event[];
}

interface Event {
  id: string;
  name: string;
  due_date: string | null;
  assignee: string | null;
  status: string;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [members, setMembers] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSubCategory, setFilterSubCategory] = useState<string>('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tasks');
      }

      setTasks(data.tasks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/members');
      const data = await response.json();
      if (response.ok) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  useEffect(() => {
    // Extract categories and subcategories from tasks
    if (tasks.length > 0) {
      const uniqueCategories = Array.from(
        new Set(tasks.map((task) => task.category))
      ).sort();
      const uniqueSubCategories = Array.from(
        new Set(tasks.map((task) => task.sub_category))
      ).sort();
      setCategories(uniqueCategories);
      setSubCategories(uniqueSubCategories);
    }
  }, [tasks]);

  const handleAddTask = () => {
    setEditingTask(null);
    setIsTaskFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('このタスクを削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      fetchTasks();
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const handleDuplicateTask = async (task: Task) => {
    try {
      const duplicateData = {
        name: `Copy of ${task.name}`,
        category: task.category,
        sub_category: task.sub_category,
        start_date: task.start_date || '',
        end_date: task.end_date || '',
        assignee: task.assignee || '',
        status: task.status,
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateData),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate task');
      }

      fetchTasks();
    } catch (err) {
      alert(err instanceof Error ? err.message : '複製に失敗しました');
    }
  };

  const handleTaskFormClose = () => {
    setIsTaskFormOpen(false);
    setEditingTask(null);
  };

  const handleCellClick = (taskId: string, field: string, currentValue: any) => {
    setEditingCell({ taskId, field });
    setEditingValue(currentValue || '');
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    const task = tasks.find((t) => t.id === editingCell.taskId);
    if (!task) return;

    try {
      const updatedTask = {
        ...task,
        [editingCell.field]: editingValue || null,
      };

      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: task.id,
          name: updatedTask.name,
          category: updatedTask.category,
          sub_category: updatedTask.sub_category,
          start_date: updatedTask.start_date || '',
          end_date: updatedTask.end_date || '',
          assignee: updatedTask.assignee || '',
          status: updatedTask.status,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      fetchTasks();
      setEditingCell(null);
      setEditingValue('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新に失敗しました');
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleStatusFilterToggle = (status: string) => {
    setFilterStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  // Filter and sort tasks
  const filteredAndSortedTasks = tasks
    .filter((task) => {
      if (filterCategory && task.category !== filterCategory) return false;
      if (filterSubCategory && task.sub_category !== filterSubCategory) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(task.status)) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortField) return 0;

      let aValue = a[sortField as keyof Task];
      let bValue = b[sortField as keyof Task];

      // Handle null values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert dates for comparison
      if (sortField === 'start_date' || sortField === 'end_date') {
        aValue = aValue ? new Date(aValue as string).getTime() : 0;
        bValue = bValue ? new Date(bValue as string).getTime() : 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-8">
          <p className="text-red-400 mb-4">エラー: {error}</p>
          <button
            onClick={fetchTasks}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-[1920px] mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">タスク管理システム</h1>
              <p className="text-gray-400">ガントチャートでタスクを管理</p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/members"
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-semibold"
              >
                メンバー管理
              </Link>
              <button
                onClick={handleAddTask}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                + タスクを追加
              </button>
            </div>
          </div>

          {/* View mode tabs */}
          <div className="flex gap-2 border-b border-gray-700">
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-6 py-3 font-semibold transition-colors ${
                viewMode === 'gantt'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              ガントチャート
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-6 py-3 font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              タスク一覧
            </button>
          </div>
        </header>

        {/* Gantt chart view */}
        {viewMode === 'gantt' && (
          <GanttChart
            tasks={tasks}
            onTaskClick={handleEditTask}
            onRefresh={fetchTasks}
          />
        )}

        {/* Task list view */}
        {viewMode === 'list' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-2xl font-bold mb-4">タスク一覧</h2>

            {/* Filters */}
            <div className="mb-4 bg-gray-750 rounded-lg p-4">
              <div className="flex gap-6 items-start">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">カテゴリー:</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-1 bg-gray-700 text-white rounded border border-gray-600 text-sm"
                  >
                    <option value="">すべて</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">サブカテゴリー:</label>
                  <select
                    value={filterSubCategory}
                    onChange={(e) => setFilterSubCategory(e.target.value)}
                    className="px-3 py-1 bg-gray-700 text-white rounded border border-gray-600 text-sm"
                  >
                    <option value="">すべて</option>
                    {subCategories.map((subCat) => (
                      <option key={subCat} value={subCat}>
                        {subCat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">ステータス:</label>
                  <div className="flex gap-3">
                    {['ToDo', 'InProgress', 'Confirmed', 'IceBox', 'Done'].map((status) => (
                      <label key={status} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterStatuses.includes(status)}
                          onChange={() => handleStatusFilterToggle(status)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 mr-2"
                        />
                        <span className="text-sm text-gray-300">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase bg-gray-700 text-gray-300">
                  <tr>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('name')}
                    >
                      タスク名 {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('category')}
                    >
                      カテゴリー {sortField === 'category' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('sub_category')}
                    >
                      サブカテゴリー {sortField === 'sub_category' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('start_date')}
                    >
                      開始日 {sortField === 'start_date' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('end_date')}
                    >
                      終了日 {sortField === 'end_date' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('assignee')}
                    >
                      担当者 {sortField === 'assignee' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('status')}
                    >
                      ステータス {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-3">アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-gray-700 hover:bg-gray-700/50"
                  >
                    {/* Task name */}
                    <td
                      className="px-4 py-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => editingCell?.taskId !== task.id && handleCellClick(task.id, 'name', task.name)}
                    >
                      {editingCell?.taskId === task.id && editingCell?.field === 'name' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        task.name
                      )}
                    </td>

                    {/* Category */}
                    <td
                      className="px-4 py-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => editingCell?.taskId !== task.id && handleCellClick(task.id, 'category', task.category)}
                    >
                      {editingCell?.taskId === task.id && editingCell?.field === 'category' ? (
                        <>
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={handleKeyDown}
                            list="category-list-inline"
                            autoFocus
                            className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                          />
                          <datalist id="category-list-inline">
                            {categories.map((cat) => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        task.category
                      )}
                    </td>

                    {/* Sub category */}
                    <td
                      className="px-4 py-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => editingCell?.taskId !== task.id && handleCellClick(task.id, 'sub_category', task.sub_category)}
                    >
                      {editingCell?.taskId === task.id && editingCell?.field === 'sub_category' ? (
                        <>
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={handleKeyDown}
                            list="subcategory-list-inline"
                            autoFocus
                            className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                          />
                          <datalist id="subcategory-list-inline">
                            {subCategories.map((subCat) => (
                              <option key={subCat} value={subCat} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        task.sub_category
                      )}
                    </td>

                    {/* Start date */}
                    <td
                      className="px-4 py-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => editingCell?.taskId !== task.id && handleCellClick(task.id, 'start_date', task.start_date ? task.start_date.split('T')[0] : '')}
                    >
                      {editingCell?.taskId === task.id && editingCell?.field === 'start_date' ? (
                        <input
                          type="date"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        task.start_date ? new Date(task.start_date).toLocaleDateString('ja-JP') : '-'
                      )}
                    </td>

                    {/* End date */}
                    <td
                      className="px-4 py-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => editingCell?.taskId !== task.id && handleCellClick(task.id, 'end_date', task.end_date ? task.end_date.split('T')[0] : '')}
                    >
                      {editingCell?.taskId === task.id && editingCell?.field === 'end_date' ? (
                        <input
                          type="date"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        task.end_date ? new Date(task.end_date).toLocaleDateString('ja-JP') : '-'
                      )}
                    </td>

                    {/* Assignee */}
                    <td
                      className="px-4 py-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => editingCell?.taskId !== task.id && handleCellClick(task.id, 'assignee', task.assignee || '')}
                    >
                      {editingCell?.taskId === task.id && editingCell?.field === 'assignee' ? (
                        <select
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">未割り当て</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.name}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        task.assignee || '-'
                      )}
                    </td>

                    {/* Status */}
                    <td
                      className="px-4 py-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => editingCell?.taskId !== task.id && handleCellClick(task.id, 'status', task.status)}
                    >
                      {editingCell?.taskId === task.id && editingCell?.field === 'status' ? (
                        <select
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="ToDo">ToDo</option>
                          <option value="InProgress">InProgress</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="IceBox">IceBox</option>
                          <option value="Done">Done</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            task.status === 'Done'
                              ? 'bg-green-600'
                              : task.status === 'InProgress'
                              ? 'bg-blue-600'
                              : task.status === 'Confirmed'
                              ? 'bg-yellow-600'
                              : task.status === 'IceBox'
                              ? 'bg-purple-600'
                              : 'bg-gray-600'
                          }`}
                        >
                          {task.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDuplicateTask(task)}
                          className="text-green-400 hover:text-green-300 text-sm"
                        >
                          複製
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
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
        </div>
        )}

        <TaskForm
          isOpen={isTaskFormOpen}
          onClose={handleTaskFormClose}
          onSave={fetchTasks}
          editData={editingTask}
        />
      </div>
    </div>
  );
}
