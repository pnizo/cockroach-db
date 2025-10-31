'use client';

import { useState, useMemo, useEffect } from 'react';
import EventForm from './EventForm';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
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
}

interface GanttChartProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onRefresh: () => void;
}

type ViewMode = 'month' | 'week' | 'day';

const STORAGE_KEY_CATEGORIES = 'gantt_expanded_categories';
const STORAGE_KEY_SUBCATEGORIES = 'gantt_expanded_subcategories';

// Sortable Task Row Component
interface SortableTaskRowProps {
  task: Task;
  position: { left: string; width: string; start: Date; end: Date } | null;
  timelineDates: Date[];
  viewMode: ViewMode;
  onTaskClick: (task: Task) => void;
  getStatusColor: (status: string) => string;
}

function SortableTaskRow({
  task,
  position,
  timelineDates,
  viewMode,
  onTaskClick,
  getStatusColor,
}: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex border-b border-gray-700 hover:bg-gray-750"
    >
      <div
        className="w-64 flex-shrink-0 p-2 pl-10 text-gray-300 flex items-center cursor-move"
        {...attributes}
        {...listeners}
      >
        <span className="mr-2 text-gray-500">⋮⋮</span>
        <span className="cursor-pointer hover:text-white" onClick={() => onTaskClick(task)}>
          {task.name}
        </span>
      </div>
      <div className="flex-1 flex relative p-2">
        {timelineDates.map((date, index) => {
          const today = new Date();
          const isToday = viewMode === 'day'
            ? date.toDateString() === today.toDateString()
            : viewMode === 'week'
            ? date <= today && new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000) > today
            : date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

          return (
            <div
              key={index}
              className={`flex-1 border-l border-gray-700 ${
                isToday ? 'bg-cyan-500/70' : ''
              }`}
            />
          );
        })}
        {position && (
          <div
            className={`absolute h-6 rounded ${getStatusColor(
              task.status
            )} opacity-80 hover:opacity-100 cursor-pointer pointer-events-auto`}
            style={{
              left: position.left,
              width: position.width,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
            }}
            onClick={() => onTaskClick(task)}
            title={`${task.name} (${task.status})`}
          >
            <div className="text-xs text-white px-2 py-1 truncate">{task.name}</div>
          </div>
        )}
        {/* Event markers */}
        {task.events.map((event) => {
          if (!event.due_date) return null;
          const eventDate = new Date(event.due_date);
          const chartStart = timelineDates[0];
          const chartEnd = timelineDates[timelineDates.length - 1];
          const totalDuration = chartEnd.getTime() - chartStart.getTime();
          const eventPos =
            ((eventDate.getTime() - chartStart.getTime()) / totalDuration) * 100;

          if (eventPos < 0 || eventPos > 100) return null;

          return (
            <div
              key={event.id}
              className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white cursor-pointer"
              style={{
                left: `${eventPos}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 20,
              }}
              title={event.name}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function GanttChart({ tasks, onTaskClick, onRefresh }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 1週間前
    return date;
  });

  // Load expanded state from localStorage on mount
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          return new Set();
        }
      }
    }
    return new Set();
  });

  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_SUBCATEGORIES);
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          return new Set();
        }
      }
    }
    return new Set();
  });

  const [hoveredEvent, setHoveredEvent] = useState<{ taskId: string; date: string } | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);

  // Sync local tasks with props
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Save expanded categories to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(Array.from(expandedCategories)));
    }
  }, [expandedCategories]);

  // Save expanded subcategories to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SUBCATEGORIES, JSON.stringify(Array.from(expandedSubCategories)));
    }
  }, [expandedSubCategories]);

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks by category and subcategory
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Record<string, Task[]>> = {};

    localTasks.forEach((task) => {
      if (!groups[task.category]) {
        groups[task.category] = {};
      }
      if (!groups[task.category][task.sub_category]) {
        groups[task.category][task.sub_category] = [];
      }
      groups[task.category][task.sub_category].push(task);
    });

    // Sort tasks by display_order within each subcategory
    Object.values(groups).forEach((subCategories) => {
      Object.values(subCategories).forEach((taskList) => {
        taskList.sort((a, b) => a.display_order - b.display_order);
      });
    });

    return groups;
  }, [localTasks]);

  // Generate timeline dates
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    const end = new Date(startDate);

    if (viewMode === 'month') {
      end.setMonth(end.getMonth() + 12);
      for (let d = new Date(startDate); d < end; d.setMonth(d.getMonth() + 1)) {
        dates.push(new Date(d));
      }
    } else if (viewMode === 'week') {
      end.setDate(end.getDate() + 84); // 12 weeks
      for (let d = new Date(startDate); d < end; d.setDate(d.getDate() + 7)) {
        dates.push(new Date(d));
      }
    } else {
      end.setDate(end.getDate() + 90); // 90 days
      for (let d = new Date(startDate); d < end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
    }

    return dates;
  }, [startDate, viewMode]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubCategory = (categoryKey: string) => {
    const newExpanded = new Set(expandedSubCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedSubCategories(newExpanded);
  };

  const getTaskPosition = (task: Task) => {
    const taskStart = task.start_date
      ? new Date(task.start_date)
      : task.events.length > 0
      ? new Date(Math.min(...task.events.filter(e => e.due_date).map(e => new Date(e.due_date!).getTime())))
      : null;

    const taskEnd = task.end_date
      ? new Date(task.end_date)
      : task.events.length > 0
      ? new Date(Math.max(...task.events.filter(e => e.due_date).map(e => new Date(e.due_date!).getTime())))
      : null;

    if (!taskStart || !taskEnd) return null;

    const chartStart = timelineDates[0];
    const chartEnd = timelineDates[timelineDates.length - 1];
    const totalDuration = chartEnd.getTime() - chartStart.getTime();

    // Clip task dates to chart range
    const clippedStart = new Date(Math.max(taskStart.getTime(), chartStart.getTime()));
    const clippedEnd = new Date(Math.min(taskEnd.getTime(), chartEnd.getTime()));

    // Calculate position based on clipped dates
    const leftPercent = ((clippedStart.getTime() - chartStart.getTime()) / totalDuration) * 100;
    const widthPercent = ((clippedEnd.getTime() - clippedStart.getTime()) / totalDuration) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.max(1, widthPercent)}%`,
      start: taskStart,
      end: taskEnd,
    };
  };

  const getCategoryPosition = (tasks: Task[]) => {
    const allDates: Date[] = [];

    tasks.forEach((task) => {
      const taskStart = task.start_date
        ? new Date(task.start_date)
        : task.events.length > 0
        ? new Date(Math.min(...task.events.filter(e => e.due_date).map(e => new Date(e.due_date!).getTime())))
        : null;

      const taskEnd = task.end_date
        ? new Date(task.end_date)
        : task.events.length > 0
        ? new Date(Math.max(...task.events.filter(e => e.due_date).map(e => new Date(e.due_date!).getTime())))
        : null;

      if (taskStart) allDates.push(taskStart);
      if (taskEnd) allDates.push(taskEnd);
    });

    if (allDates.length === 0) return null;

    const categoryStart = new Date(Math.min(...allDates.map(d => d.getTime())));
    const categoryEnd = new Date(Math.max(...allDates.map(d => d.getTime())));

    const chartStart = timelineDates[0];
    const chartEnd = timelineDates[timelineDates.length - 1];
    const totalDuration = chartEnd.getTime() - chartStart.getTime();

    // Clip category dates to chart range
    const clippedStart = new Date(Math.max(categoryStart.getTime(), chartStart.getTime()));
    const clippedEnd = new Date(Math.min(categoryEnd.getTime(), chartEnd.getTime()));

    // Calculate position based on clipped dates
    const leftPercent = ((clippedStart.getTime() - chartStart.getTime()) / totalDuration) * 100;
    const widthPercent = ((clippedEnd.getTime() - clippedStart.getTime()) / totalDuration) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.max(1, widthPercent)}%`,
      start: categoryStart,
      end: categoryEnd,
    };
  };

  const getEventsOnDate = (task: Task, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return task.events.filter((e) => e.due_date && e.due_date.startsWith(dateStr));
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ToDo: 'bg-gray-500',
      InProgress: 'bg-blue-500',
      Confirmed: 'bg-yellow-500',
      IceBox: 'bg-purple-500',
      Done: 'bg-green-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const formatDate = (date: Date) => {
    if (viewMode === 'month') {
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (viewMode === 'week') {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const handleAddEvent = (taskId: string, date: string) => {
    setSelectedTaskId(taskId);
    setSelectedDate(date);
    setIsEventFormOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Find the task being dragged and the task it's being dropped over
    const activeTask = localTasks.find((t) => t.id === active.id);
    const overTask = localTasks.find((t) => t.id === over.id);

    if (!activeTask || !overTask) return;

    // Only allow reordering within the same subcategory
    if (
      activeTask.category !== overTask.category ||
      activeTask.sub_category !== overTask.sub_category
    ) {
      return;
    }

    // Get all tasks in the same subcategory
    const subcategoryTasks = localTasks.filter(
      (t) => t.category === activeTask.category && t.sub_category === activeTask.sub_category
    );

    // Find the old and new indices
    const oldIndex = subcategoryTasks.findIndex((t) => t.id === active.id);
    const newIndex = subcategoryTasks.findIndex((t) => t.id === over.id);

    if (oldIndex === newIndex) return;

    // Reorder the tasks
    const reorderedSubcategoryTasks = arrayMove(subcategoryTasks, oldIndex, newIndex);

    // Update display_order for reordered tasks
    const updatedTasks = reorderedSubcategoryTasks.map((task, index) => ({
      ...task,
      display_order: index,
    }));

    // Update local state immediately for smooth UX
    const newLocalTasks = localTasks.map((task) => {
      const updatedTask = updatedTasks.find((t) => t.id === task.id);
      return updatedTask || task;
    });
    setLocalTasks(newLocalTasks);

    // Send update to server
    try {
      const response = await fetch('/api/tasks/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: updatedTasks.map((t) => ({ id: t.id, display_order: t.display_order })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task order');
      }

      // Refresh the entire task list from parent
      onRefresh();
    } catch (error) {
      console.error('Error updating task order:', error);
      // Revert on error
      setLocalTasks(tasks);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">ガントチャート</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded ${
                viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              日
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded ${
                viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              週
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded ${
                viewMode === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              月
            </button>
            <input
              type="date"
              value={startDate.toISOString().split('T')[0]}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="px-3 py-1 bg-gray-700 text-white rounded border border-gray-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Timeline header */}
            <div className="flex border-b border-gray-700">
              <div className="w-64 flex-shrink-0 p-2 font-bold text-gray-300">タスク</div>
              <div className="flex-1 flex relative p-2">
                {timelineDates.map((date, index) => {
                  const today = new Date();
                  const isToday = viewMode === 'day'
                    ? date.toDateString() === today.toDateString()
                    : viewMode === 'week'
                    ? date <= today && new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000) > today
                    : date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

                  return (
                    <div
                      key={index}
                      className={`flex-1 text-center text-xs border-l border-gray-700 flex flex-col items-center justify-center ${
                        isToday ? 'bg-cyan-500/70 text-yellow-300 font-semibold' : 'text-gray-400'
                      }`}
                    >
                      {viewMode === 'month' ? (
                        formatDate(date)
                      ) : viewMode === 'week' ? (
                        formatDate(date)
                      ) : (
                        <>
                          <div>{date.getMonth() + 1}月</div>
                          <div>{date.getDate()}日</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tasks grouped by category and subcategory */}
            {Object.entries(groupedTasks).map(([category, subCategories]) => {
              // Get all tasks in this category
              const allCategoryTasks: Task[] = [];
              Object.values(subCategories).forEach((tasks) => {
                allCategoryTasks.push(...tasks);
              });
              const categoryPosition = getCategoryPosition(allCategoryTasks);

              return (
                <div key={category}>
                  {/* Category header */}
                  <div className="flex bg-gray-700 cursor-pointer hover:bg-gray-600">
                    <div
                      className="w-64 flex-shrink-0 p-2 font-bold text-white flex items-center"
                      onClick={() => toggleCategory(category)}
                    >
                      <span className="mr-2">{expandedCategories.has(category) ? '▼' : '▶'}</span>
                      {category}
                    </div>
                    <div className="flex-1 flex relative p-2">
                      {timelineDates.map((date, index) => {
                        const today = new Date();
                        const isToday = viewMode === 'day'
                          ? date.toDateString() === today.toDateString()
                          : viewMode === 'week'
                          ? date <= today && new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000) > today
                          : date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

                        return (
                          <div
                            key={index}
                            className={`flex-1 border-l border-gray-700 ${
                              isToday ? 'bg-cyan-500/70' : ''
                            }`}
                          />
                        );
                      })}
                      {categoryPosition && (
                        <div
                          className="absolute h-8 rounded bg-gray-500 opacity-60 pointer-events-none"
                          style={{
                            left: categoryPosition.left,
                            width: categoryPosition.width,
                            top: '50%',
                            transform: 'translateY(-50%)',
                          }}
                          title={`${category}: ${categoryPosition.start.toLocaleDateString('ja-JP')} - ${categoryPosition.end.toLocaleDateString('ja-JP')}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Subcategories */}
                  {expandedCategories.has(category) &&
                    Object.entries(subCategories).map(([subCategory, subTasks]) => {
                      const subCategoryKey = `${category}-${subCategory}`;
                      const subCategoryPosition = getCategoryPosition(subTasks);

                      return (
                        <div key={subCategoryKey}>
                          {/* Subcategory header */}
                          <div className="flex bg-gray-750 cursor-pointer hover:bg-gray-650">
                            <div
                              className="w-64 flex-shrink-0 p-2 pl-6 font-semibold text-gray-200 flex items-center"
                              onClick={() => toggleSubCategory(subCategoryKey)}
                            >
                              <span className="mr-2">
                                {expandedSubCategories.has(subCategoryKey) ? '▼' : '▶'}
                              </span>
                              {subCategory}
                            </div>
                            <div className="flex-1 flex relative p-2">
                              {timelineDates.map((date, index) => {
                                const today = new Date();
                                const isToday = viewMode === 'day'
                                  ? date.toDateString() === today.toDateString()
                                  : viewMode === 'week'
                                  ? date <= today && new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000) > today
                                  : date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

                                return (
                                  <div
                                    key={index}
                                    className={`flex-1 border-l border-gray-700 ${
                                      isToday ? 'bg-cyan-500/70' : ''
                                    }`}
                                  />
                                );
                              })}
                              {subCategoryPosition && (
                                <div
                                  className="absolute h-6 rounded bg-gray-400 opacity-60 pointer-events-none"
                                  style={{
                                    left: subCategoryPosition.left,
                                    width: subCategoryPosition.width,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                  }}
                                  title={`${subCategory}: ${subCategoryPosition.start.toLocaleDateString('ja-JP')} - ${subCategoryPosition.end.toLocaleDateString('ja-JP')}`}
                                />
                              )}
                            </div>
                          </div>

                      {/* Tasks */}
                      {expandedSubCategories.has(subCategoryKey) && (
                        <SortableContext
                          items={subTasks.map((t) => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {subTasks.map((task) => {
                            const position = getTaskPosition(task);
                            return (
                              <SortableTaskRow
                                key={task.id}
                                task={task}
                                position={position}
                                timelineDates={timelineDates}
                                viewMode={viewMode}
                                onTaskClick={onTaskClick}
                                getStatusColor={getStatusColor}
                              />
                            );
                          })}
                        </SortableContext>
                      )}
                    </div>
                  );
                })}
                </div>
              );
            })}
          </div>
        </div>

        <EventForm
          isOpen={isEventFormOpen}
          onClose={() => {
            setIsEventFormOpen(false);
            setSelectedTaskId(null);
            setSelectedDate(null);
          }}
          onSave={onRefresh}
          taskId={selectedTaskId || undefined}
        />
      </div>
    </DndContext>
  );
}
