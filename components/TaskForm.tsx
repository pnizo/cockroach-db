'use client';

import { useState, useEffect } from 'react';
import EventForm from './EventForm';

// Helper function to format date without timezone issues
const formatDateDisplay = (dateString: string | null): string => {
  if (!dateString) return '-';
  const date = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`);
  return date.toLocaleDateString('ja-JP');
};

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editData?: any | null;
  initialCategory?: string;
  initialSubCategory?: string;
}

const STATUS_OPTIONS = ['ToDo', 'InProgress', 'Confirmed', 'IceBox', 'Done'];

interface Member {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
}

export default function TaskForm({ isOpen, onClose, onSave, editData, initialCategory, initialSubCategory }: TaskFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sub_category: '',
    start_date: '',
    end_date: '',
    assignee: '',
    status: 'ToDo',
    note: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [localTaskData, setLocalTaskData] = useState<any | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);

  // Fetch members and categories on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch members
        const membersResponse = await fetch('/api/members');
        const membersData = await membersResponse.json();
        if (membersResponse.ok) {
          setMembers(membersData.members);
        }

        // Fetch tasks to extract categories and subcategories
        const tasksResponse = await fetch('/api/tasks');
        const tasksData = await tasksResponse.json();
        if (tasksResponse.ok) {
          const uniqueCategories = Array.from(
            new Set(tasksData.tasks.map((task: any) => task.category))
          ).sort();
          const uniqueSubCategories = Array.from(
            new Set(tasksData.tasks.map((task: any) => task.sub_category))
          ).sort();
          setCategories(uniqueCategories as string[]);
          setSubCategories(uniqueSubCategories as string[]);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name || '',
        category: editData.category || '',
        sub_category: editData.sub_category || '',
        start_date: editData.start_date ? editData.start_date.split('T')[0] : '',
        end_date: editData.end_date ? editData.end_date.split('T')[0] : '',
        assignee: editData.assignee || '',
        status: editData.status || 'ToDo',
        note: editData.note || '',
      });
      setLocalTaskData(editData);
    } else {
      setFormData({
        name: '',
        category: initialCategory || '',
        sub_category: initialSubCategory || '',
        start_date: '',
        end_date: '',
        assignee: '',
        status: 'ToDo',
        note: '',
      });
      setLocalTaskData(null);
    }
    setError(null);
  }, [editData, initialCategory, initialSubCategory, isOpen]);

  const refreshTaskData = async () => {
    if (!editData?.id) return;

    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();

      if (response.ok) {
        const updatedTask = data.tasks.find((t: any) => t.id === editData.id);
        if (updatedTask) {
          setLocalTaskData(updatedTask);
        }
      }
    } catch (err) {
      console.error('Failed to refresh task data:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = '/api/tasks';
      const method = editData ? 'PUT' : 'POST';
      const body = editData
        ? { id: editData.id, ...formData }
        : formData;

      // console.log('=== TaskForm Submit DEBUG ===');
      // console.log('Method:', method);
      // console.log('Form start_date:', formData.start_date);
      // console.log('Form end_date:', formData.end_date);
      // console.log('Body being sent:', JSON.stringify(body));

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // console.log('Response status:', response.status);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '保存に失敗しました');
      }

      const responseData = await response.json();
      // console.log('Response data:', responseData);
      // console.log('Returned start_date:', responseData.task?.start_date);
      // console.log('Returned end_date:', responseData.task?.end_date);
      // console.log('=== END TaskForm Submit DEBUG ===');

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editData?.id) return;

    if (!confirm('このタスクを削除してもよろしいですか？\n\n「OK」を押すと完全に削除されます。')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks?id=${editData.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      onSave(); // リフレッシュ
      onClose(); // ダイアログを閉じる
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setIsEventFormOpen(true);
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setIsEventFormOpen(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('このイベントを削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/events?id=${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      // Refresh local task data immediately
      await refreshTaskData();
      // Also refresh parent component's task list
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const handleEventFormClose = () => {
    setIsEventFormOpen(false);
    setEditingEvent(null);
  };

  const handleEventSave = async () => {
    // Refresh local task data immediately
    await refreshTaskData();
    // Also refresh parent component's task list
    onSave();
    setIsEventFormOpen(false);
    setEditingEvent(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {editData ? 'タスク編集' : 'タスク追加'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
            type="button"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                タスク名 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="タスク名を入力"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  カテゴリー <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="開発"
                  list="category-list"
                />
                <datalist id="category-list">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  サブカテゴリー <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.sub_category}
                  onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="フロントエンド"
                  list="subcategory-list"
                />
                <datalist id="subcategory-list">
                  {subCategories.map((subCategory) => (
                    <option key={subCategory} value={subCategory} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  開始日
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  終了日
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  担当者
                </label>
                <select
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">未割り当て</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name}
                      {member.role && ` (${member.role})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ステータス
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                メモ
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="メモを入力"
                rows={4}
                maxLength={1000}
              />
              <div className="text-right text-sm text-gray-400 mt-1">
                {formData.note.length}/1000文字
              </div>
            </div>
          </div>

          {/* Events section - only show when editing existing task */}
          {localTaskData && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">イベント</h3>
              </div>

              {localTaskData.events && localTaskData.events.length > 0 ? (
                <div className="space-y-2">
                  {localTaskData.events.map((event: any) => (
                    <div
                      key={event.id}
                      className="bg-gray-700 rounded p-3 flex justify-between items-start"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-white">{event.name}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          {event.due_date && (
                            <span className="mr-3">
                              期日: {formatDateDisplay(event.due_date)}
                            </span>
                          )}
                          {event.assignee && <span className="mr-3">担当: {event.assignee}</span>}
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              event.status === 'Done'
                                ? 'bg-green-600'
                                : event.status === 'InProgress'
                                ? 'bg-blue-600'
                                : event.status === 'Confirmed'
                                ? 'bg-yellow-600'
                                : event.status === 'IceBox'
                                ? 'bg-purple-600'
                                : 'bg-gray-600'
                            }`}
                          >
                            {event.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3">
                        <button
                          type="button"
                          onClick={() => handleEditEvent(event)}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">イベントがありません</p>
              )}
            </div>
          )}

          <div className="flex justify-between gap-3 mt-6">
            <div>
              {editData && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? '削除中...' : '削除'}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </form>

        {/* Event Form Dialog */}
        {localTaskData && (
          <EventForm
            isOpen={isEventFormOpen}
            onClose={handleEventFormClose}
            onSave={handleEventSave}
            taskId={localTaskData.id}
            editData={editingEvent}
          />
        )}
      </div>
    </div>
  );
}
