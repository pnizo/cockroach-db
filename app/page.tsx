'use client';

import { useState, useEffect } from 'react';
import GanttChart from '@/components/GanttChart';
import TaskForm from '@/components/TaskForm';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  task_id: string;
}

// Helper function to format date without timezone issues
const formatDateDisplay = (dateString: string | null): string => {
  if (!dateString) return '-';
  // Add time component to ensure local timezone interpretation
  const date = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`);
  return date.toLocaleDateString('ja-JP');
};

// Column definitions
interface ColumnDefinition {
  id: string;
  label: string;
  field: keyof Task | 'actions';
  sortable: boolean;
}

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { id: 'category', label: 'カテゴリー', field: 'category', sortable: true },
  { id: 'sub_category', label: 'サブカテゴリー', field: 'sub_category', sortable: true },
  { id: 'name', label: 'タスク名', field: 'name', sortable: true },
  { id: 'start_date', label: '開始日', field: 'start_date', sortable: true },
  { id: 'end_date', label: '終了日', field: 'end_date', sortable: true },
  { id: 'assignee', label: '担当者', field: 'assignee', sortable: true },
  { id: 'status', label: 'ステータス', field: 'status', sortable: true },
  { id: 'actions', label: 'アクション', field: 'actions', sortable: false },
];

const COLUMN_ORDER_STORAGE_KEY = 'task_list_column_order';

// Sortable Header Component
interface SortableHeaderProps {
  column: ColumnDefinition;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}

function SortableHeader({ column, sortField, sortDirection, onSort }: SortableHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'move',
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`px-4 py-3 ${column.sortable ? 'cursor-pointer hover:bg-gray-600' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div
        className="flex items-center gap-2"
        onClick={(e) => {
          if (column.sortable) {
            e.stopPropagation();
            onSort(column.field as string);
          }
        }}
      >
        <span className="select-none">⋮⋮</span>
        <span>
          {column.label} {column.sortable && sortField === column.field && (sortDirection === 'asc' ? '▲' : '▼')}
        </span>
      </div>
    </th>
  );
}

interface TaskRowProps {
  task: Task;
  columns: ColumnDefinition[];
  editingCell: { taskId: string; field: string } | null;
  editingValue: string;
  setEditingValue: (value: string) => void;
  handleCellClick: (taskId: string, field: string, currentValue: any) => void;
  handleCellSave: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleDuplicateTask: (task: Task) => void;
  handleDeleteTask: (taskId: string) => void;
  categories: string[];
  subCategories: string[];
  members: any[];
}

function TaskRow({
  task,
  columns,
  editingCell,
  editingValue,
  setEditingValue,
  handleCellClick,
  handleCellSave,
  handleKeyDown,
  handleDuplicateTask,
  handleDeleteTask,
  categories,
  subCategories,
  members,
}: TaskRowProps) {
  const renderCell = (column: ColumnDefinition) => {
    const field = column.field;

    if (field === 'actions') {
      return (
        <td key={column.id} className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={() => handleDuplicateTask(task)}
              className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded"
            >
              複製
            </button>
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded"
            >
              削除
            </button>
          </div>
        </td>
      );
    }

    const isEditing = editingCell?.taskId === task.id && editingCell?.field === field;

    if (field === 'category') {
      return (
        <td
          key={column.id}
          className="px-4 py-3 cursor-pointer hover:bg-gray-700"
          onClick={() => !isEditing && handleCellClick(task.id, field, task.category)}
        >
          {isEditing ? (
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
      );
    }

    if (field === 'sub_category') {
      return (
        <td
          key={column.id}
          className="px-4 py-3 cursor-pointer hover:bg-gray-700"
          onClick={() => !isEditing && handleCellClick(task.id, field, task.sub_category)}
        >
          {isEditing ? (
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
      );
    }

    if (field === 'name') {
      return (
        <td
          key={column.id}
          className="px-4 py-3 cursor-pointer hover:bg-gray-700"
          onClick={() => !isEditing && handleCellClick(task.id, field, task.name)}
        >
          {isEditing ? (
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
      );
    }

    if (field === 'start_date') {
      return (
        <td
          key={column.id}
          className="px-4 py-3 cursor-pointer hover:bg-gray-700"
          onClick={() => !isEditing && handleCellClick(task.id, field, task.start_date ? task.start_date.split('T')[0] : '')}
        >
          {isEditing ? (
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
            formatDateDisplay(task.start_date)
          )}
        </td>
      );
    }

    if (field === 'end_date') {
      return (
        <td
          key={column.id}
          className="px-4 py-3 cursor-pointer hover:bg-gray-700"
          onClick={() => !isEditing && handleCellClick(task.id, field, task.end_date ? task.end_date.split('T')[0] : '')}
        >
          {isEditing ? (
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
            formatDateDisplay(task.end_date)
          )}
        </td>
      );
    }

    if (field === 'assignee') {
      return (
        <td
          key={column.id}
          className="px-4 py-3 cursor-pointer hover:bg-gray-700"
          onClick={() => !isEditing && handleCellClick(task.id, field, task.assignee || '')}
        >
          {isEditing ? (
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
      );
    }

    if (field === 'status') {
      return (
        <td
          key={column.id}
          className="px-4 py-3 cursor-pointer hover:bg-gray-700"
          onClick={() => !isEditing && handleCellClick(task.id, field, task.status)}
        >
          {isEditing ? (
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
      );
    }

    return <td key={column.id}></td>;
  };

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-700/50">
      {columns.map((column) => renderCell(column))}
    </tr>
  );
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

  // Column order management
  const [columnOrder, setColumnOrder] = useState<ColumnDefinition[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
      if (saved) {
        try {
          const savedIds = JSON.parse(saved);
          return savedIds.map((id: string) => DEFAULT_COLUMNS.find(col => col.id === id)!).filter(Boolean);
        } catch (e) {
          return DEFAULT_COLUMNS;
        }
      }
    }
    return DEFAULT_COLUMNS;
  });

  // Setup sensors for column drag and drop
  const columnSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks');
      const data = await response.json();

      // console.log('=== fetchTasks DEBUG ===');
      // if (data.tasks && data.tasks.length > 0) {
      //   console.log('First task from API:', data.tasks[0]);
      //   console.log('First task start_date:', data.tasks[0]?.start_date);
      //   console.log('First task end_date:', data.tasks[0]?.end_date);
      // }
      // console.log('=== END fetchTasks DEBUG ===');

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

  // Save column order to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder.map(col => col.id)));
    }
  }, [columnOrder]);

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = columnOrder.findIndex((col) => col.id === active.id);
    const newIndex = columnOrder.findIndex((col) => col.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
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
              <h1 className="text-4xl font-bold mb-2">コンテンツ事業進行表</h1>
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
              <DndContext
                sensors={columnSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleColumnDragEnd}
              >
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase bg-gray-700 text-gray-300">
                    <SortableContext
                      items={columnOrder.map((col) => col.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      <tr>
                        {columnOrder.map((column) => (
                          <SortableHeader
                            key={column.id}
                            column={column}
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                          />
                        ))}
                      </tr>
                    </SortableContext>
                  </thead>
                  <tbody>
                    {filteredAndSortedTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        columns={columnOrder}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        handleCellClick={handleCellClick}
                        handleCellSave={handleCellSave}
                        handleKeyDown={handleKeyDown}
                        handleDuplicateTask={handleDuplicateTask}
                        handleDeleteTask={handleDeleteTask}
                        categories={categories}
                        subCategories={subCategories}
                        members={members}
                      />
                    ))}
                  </tbody>
                </table>
              </DndContext>
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
