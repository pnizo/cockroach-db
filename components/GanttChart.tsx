'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import EventForm from './EventForm';
import TaskForm from './TaskForm';
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
import {
  initializeTaskOrder,
  updateTaskOrderForSubcategory,
  sortTasksByOrder,
  cleanupTaskOrder,
  addTaskToOrder,
  initializeCategoryOrder,
  saveCategoryOrder,
  loadCategoryOrder,
  initializeSubcategoryOrder,
  saveSubcategoryOrder,
  loadSubcategoryOrder,
  loadTaskOrder,
  addCategoryToOrder,
  addSubcategoryToOrder,
} from '@/lib/taskOrderStorage';

// Helper function to parse date strings without timezone issues
const parseDateString = (dateString: string): Date => {
  // Add time component to ensure local timezone interpretation
  return new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`);
};

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
  note: string | null;
  events: Event[];
}

interface Event {
  id: string;
  name: string;
  due_date: string | null;
  assignee: string | null;
  status: string;
  task_id: string;
  note: string | null;
}

interface GanttChartProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask?: (category: string, subCategory: string) => void;
  onRefresh: () => void;
}

type ViewMode = 'week' | 'day';

// Timeline display constants
const CELL_WIDTH_DAY = 30;
const CELL_WIDTH_WEEK = 30;
const TIMELINE_UNITS = 120;
const TIMELINE_PADDING = 8; // p-2 = 0.5rem = 8px

const STORAGE_KEY_CATEGORIES = 'gantt_expanded_categories';
const STORAGE_KEY_SUBCATEGORIES = 'gantt_expanded_subcategories';
const STORAGE_KEY_SCROLL_POSITION = 'gantt_scroll_position';
const STORAGE_KEY_SHOULD_RESTORE = 'gantt_should_restore_scroll';

// Sortable Task Row Component
interface SortableTaskRowProps {
  task: Task;
  position: { left: string; width: string; start: Date; end: Date } | null;
  timelineDates: Date[];
  viewMode: ViewMode;
  onTaskClick: (task: Task) => void;
  getStatusColor: (status: string) => string;
  getEventColor: (status: string) => { bg: string; hover: string; border: string };
  handleEventClick: (event: Event) => void;
  handleAddEvent: (taskId: string, date: string) => void;
  handleTaskEdit: (task: Task) => void;
  mouseDownInfo: { taskId: string; mouseDownX: number; mouseDownTime: number } | null;
  setMouseDownInfo: (info: { taskId: string; mouseDownX: number; mouseDownTime: number } | null) => void;
  lastClickInfo: { taskId: string; time: number } | null;
  setLastClickInfo: (info: { taskId: string; time: number } | null) => void;
  singleClickTimer: NodeJS.Timeout | null;
  setSingleClickTimer: (timer: NodeJS.Timeout | null) => void;
  timelineWidth: number;
  cellWidth: number;
  unitInMs: number;
}

function SortableTaskRow({
  task,
  position,
  timelineDates,
  viewMode,
  onTaskClick,
  getStatusColor,
  getEventColor,
  handleEventClick,
  handleAddEvent,
  handleTaskEdit,
  mouseDownInfo,
  setMouseDownInfo,
  lastClickInfo,
  setLastClickInfo,
  singleClickTimer,
  setSingleClickTimer,
  timelineWidth,
  cellWidth,
  unitInMs,
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
      className="flex border-b border-gray-700 hover:bg-gray-700 group"
    >
      <div
        className="w-88 flex-shrink-0 p-2 pl-10 text-gray-300 flex items-center justify-between sticky left-0 bg-gray-800 group-hover:bg-gray-700 z-20"
      >
        <div className="flex items-center">
          <span
            className="mr-2 text-gray-500 cursor-move"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </span>
          <span
            className="cursor-pointer hover:text-white hover:underline"
            onClick={() => onTaskClick(task)}
          >
            {task.name}
          </span>
        </div>
        {task.assignee && (
          <span
            className="ml-2 text-gray-400 text-sm cursor-pointer hover:text-white hover:underline"
            onClick={() => handleTaskEdit(task)}
          >
            {task.assignee}
          </span>
        )}
      </div>
      <div className="flex relative p-2" style={{ width: `${timelineWidth}px` }}>
        {timelineDates.map((date, index) => {
          return (
            <div
              key={index}
              className="border-l border-gray-700"
              style={{ width: `${cellWidth}px` }}
            />
          );
        })}
        {position && (
          <>
            {/* Main task bar */}
            <div
              className={`absolute h-6 rounded ${getStatusColor(
                task.status
              )} opacity-80 hover:opacity-100 pointer-events-auto cursor-pointer`}
              style={{
                left: position.left,
                width: position.width,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setMouseDownInfo({
                  taskId: task.id,
                  mouseDownX: e.clientX,
                  mouseDownTime: Date.now(),
                });
              }}
              onMouseUp={(e) => {
                e.stopPropagation();

                // Check if this was a click (not a drag)
                if (mouseDownInfo && mouseDownInfo.taskId === task.id) {
                  const timeDiff = Date.now() - mouseDownInfo.mouseDownTime;
                  const distanceMoved = Math.abs(e.clientX - mouseDownInfo.mouseDownX);

                  // If mouse didn't move much and time was short, treat as click
                  if (timeDiff < 300 && distanceMoved < 5) {
                    const now = Date.now();

                    // Check for double-click
                    if (lastClickInfo &&
                        lastClickInfo.taskId === task.id &&
                        now - lastClickInfo.time < 300) {
                      // Double-click detected
                      if (singleClickTimer) {
                        clearTimeout(singleClickTimer);
                        setSingleClickTimer(null);
                      }
                      setLastClickInfo(null);
                      setMouseDownInfo(null);

                      // Open task edit dialog
                      handleTaskEdit(task);
                    } else {
                      // Single click - delay execution to check for double-click
                      setLastClickInfo({ taskId: task.id, time: now });

                      // Calculate clicked position for event creation
                      const container = e.currentTarget.parentElement;
                      if (container) {
                        const containerRect = container.getBoundingClientRect();
                        const clickX = e.clientX - containerRect.left;

                        // Calculate which unit was clicked
                        const clickedUnit = Math.floor(clickX / cellWidth);

                        // Calculate the date (without the +1 shift)
                        const chartStart = timelineDates[0];
                        const clickedDate = new Date(chartStart);
                        if (viewMode === 'day') {
                          clickedDate.setDate(chartStart.getDate() + clickedUnit);
                        } else {
                          clickedDate.setDate(chartStart.getDate() + clickedUnit * 7);
                        }

                        // Format date as YYYY-MM-DD
                        const dateStr = clickedDate.toISOString().split('T')[0];

                        // Delay single-click action
                        const timer = setTimeout(() => {
                          handleAddEvent(task.id, dateStr);
                          setSingleClickTimer(null);
                        }, 300);

                        setSingleClickTimer(timer);
                      }

                      setMouseDownInfo(null);
                    }
                  }
                }
              }}
              onClick={(e) => {
                e.stopPropagation(); // Prevent task edit dialog
              }}
              title={`${task.name} (${task.status})${task.note ? '\nメモ: ' + task.note : ''}`}
            >
              <div className="text-xs text-white px-2 py-1 truncate pointer-events-none">
                {task.name}
              </div>
            </div>
          </>
        )}
        {/* Event markers with balloons */}
        {(() => {
          // Group events by date
          const eventsByDate = new Map<string, typeof task.events>();
          task.events.forEach((event) => {
            if (event.due_date) {
              const dateKey = event.due_date.split('T')[0]; // Use YYYY-MM-DD as key
              if (!eventsByDate.has(dateKey)) {
                eventsByDate.set(dateKey, []);
              }
              eventsByDate.get(dateKey)!.push(event);
            }
          });

          return task.events.map((event, eventIndex) => {
            if (!event.due_date) return null;
            const eventDate = parseDateString(event.due_date);
            const dateKey = event.due_date.split('T')[0];

            // Find which timeline cell this event falls in
            let eventCellIndex = -1;
            for (let i = 0; i < timelineDates.length; i++) {
              const cellDate = timelineDates[i];
              const nextCellDate = i < timelineDates.length - 1
                ? timelineDates[i + 1]
                : new Date(cellDate.getTime() + unitInMs);

              if (eventDate >= cellDate && eventDate < nextCellDate) {
                eventCellIndex = i;
                break;
              }
            }

            if (eventCellIndex === -1) return null; // Event is outside visible range

            // Calculate position using fixed cell width (add +1 for shift, center in cell)
            const eventPos = (eventCellIndex + 1) * (cellWidth - 0.14) + ((cellWidth - 0.14) / 2);

            // Calculate vertical offset for stacked events on same date
            const eventsOnThisDate = eventsByDate.get(dateKey) || [];
            const indexInDate = eventsOnThisDate.findIndex(e => e.id === event.id);
            const totalEventsOnDate = eventsOnThisDate.length;
            const verticalOffset = (indexInDate - (totalEventsOnDate - 1) / 2) * 24; // 24px spacing

            const eventColor = getEventColor(event.status);

            return (
              <div
                key={event.id}
                className="absolute cursor-pointer group"
                style={{
                  left: `${eventPos + TIMELINE_PADDING}px`,
                  top: '50%',
                  transform: `translate(-50%, calc(-50% + ${verticalOffset}px))`,
                  zIndex: 12,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEventClick(event);
                }}
              >
                {/* Balloon */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                  <div className={`${eventColor.bg} ${eventColor.hover} text-white text-xs px-2 py-1 rounded shadow-md max-w-[150px] truncate pointer-events-auto`}>
                    {event.name}
                  </div>
                  {/* Arrow pointing down */}
                  <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent ${eventColor.border}`}></div>
                </div>
                {/* Dot */}
                <div className={`w-3 h-3 ${eventColor.bg} rounded-full border-2 border-white`}></div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

export default function GanttChart({ tasks, onTaskClick, onAddTask, onRefresh }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 14); // 2週間前
    return date;
  });

  // Scroll container ref for preserving scroll position
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldRestoreScroll = useRef<boolean>(false);

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
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Click detection for task bars
  const [mouseDownInfo, setMouseDownInfo] = useState<{
    taskId: string;
    mouseDownX: number;
    mouseDownTime: number;
  } | null>(null);

  // Double-click detection for task bars
  const [lastClickInfo, setLastClickInfo] = useState<{
    taskId: string;
    time: number;
  } | null>(null);
  const [singleClickTimer, setSingleClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Sync local tasks with props and initialize/cleanup localStorage order
  useEffect(() => {
    setLocalTasks(tasks);

    // Initialize task order from localStorage or DB on first load
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      cleanupTaskOrder(taskIds); // Remove deleted tasks from order
      initializeTaskOrder(tasks); // Initialize if not exists
      initializeCategoryOrder(tasks); // Initialize category order
      initializeSubcategoryOrder(tasks); // Initialize subcategory order

      // Ensure new categories/subcategories are added to order
      const categories = Array.from(new Set(tasks.map(t => t.category)));
      categories.forEach(cat => addCategoryToOrder(cat));

      const subcategories = new Map<string, Set<string>>();
      tasks.forEach(task => {
        if (!subcategories.has(task.category)) {
          subcategories.set(task.category, new Set());
        }
        subcategories.get(task.category)!.add(task.sub_category);
      });
      subcategories.forEach((subs, cat) => {
        subs.forEach(sub => addSubcategoryToOrder(cat, sub));
      });
    }
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

  // Restore scroll position after tasks update
  useEffect(() => {
    const shouldRestore = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_SHOULD_RESTORE) === 'true'
      : false;

    // console.log('[Scroll Debug] Restore effect triggered', {
    //   shouldRestore,
    //   shouldRestoreRef: shouldRestoreScroll.current,
    //   hasRef: !!scrollContainerRef.current,
    //   tasksLength: tasks.length
    // });

    if (shouldRestore && scrollContainerRef.current) {
      const savedPosition = localStorage.getItem(STORAGE_KEY_SCROLL_POSITION);
      // console.log('[Scroll Debug] Saved position from localStorage:', savedPosition);

      if (savedPosition) {
        try {
          const { scrollLeft, scrollTop } = JSON.parse(savedPosition);
          // console.log('[Scroll Debug] Parsed position:', { scrollLeft, scrollTop });

          // Use setTimeout to ensure DOM is updated
          setTimeout(() => {
            if (scrollContainerRef.current) {
              // console.log('[Scroll Debug] Restoring scroll position...', { scrollLeft, scrollTop });
              scrollContainerRef.current.scrollLeft = scrollLeft;
              scrollContainerRef.current.scrollTop = scrollTop;
              // console.log('[Scroll Debug] Scroll position restored. Current:', {
              //   left: scrollContainerRef.current.scrollLeft,
              //   top: scrollContainerRef.current.scrollTop
              // });
            }
            // Clear the flag after restoration
            if (typeof window !== 'undefined') {
              localStorage.removeItem(STORAGE_KEY_SHOULD_RESTORE);
            }
            shouldRestoreScroll.current = false;
          }, 100); // Increased timeout to ensure DOM is fully updated
        } catch (e) {
          console.error('[Scroll Debug] Error parsing saved position:', e);
        }
      }
    }
  }, [tasks]);

  // Save scroll position on scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    // console.log('[Scroll Debug] Setting up scroll event listener', { hasRef: !!scrollContainer });

    if (!scrollContainer) return;

    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        const position = {
          scrollLeft: scrollContainer.scrollLeft,
          scrollTop: scrollContainer.scrollTop,
        };
        //console.log('[Scroll Debug] Scroll event fired, saving position:', position);
        localStorage.setItem(STORAGE_KEY_SCROLL_POSITION, JSON.stringify(position));
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    // console.log('[Scroll Debug] Scroll event listener attached');

    return () => {
      // console.log('[Scroll Debug] Removing scroll event listener');
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks by category and subcategory (sorted by localStorage order)
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Record<string, Task[]>> = {};

    // Sort tasks using localStorage order first
    const sortedTasks = sortTasksByOrder(localTasks);

    sortedTasks.forEach((task) => {
      if (!groups[task.category]) {
        groups[task.category] = {};
      }
      if (!groups[task.category][task.sub_category]) {
        groups[task.category][task.sub_category] = [];
      }
      groups[task.category][task.sub_category].push(task);
    });

    return groups;
  }, [localTasks]);

  // Get sorted categories based on localStorage order
  const sortedCategories = useMemo(() => {
    const categories = Object.keys(groupedTasks);
    const categoryOrder = loadCategoryOrder();

    // Sort by localStorage order
    return categories.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);

      // If not in order, put at end
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });
  }, [groupedTasks]);

  // Get sorted subcategories for a category based on localStorage order
  const getSortedSubCategories = (category: string) => {
    const subCategories = Object.keys(groupedTasks[category] || {});
    const subcategoryOrder = loadSubcategoryOrder();
    const categorySubOrder = subcategoryOrder[category] || [];

    return subCategories.sort((a, b) => {
      const indexA = categorySubOrder.indexOf(a);
      const indexB = categorySubOrder.indexOf(b);

      // If not in order, put at end
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });
  };

  // Generate timeline dates - Fixed 120 units
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];

    if (viewMode === 'week') {
      // 120 weeks
      for (let i = 0; i < TIMELINE_UNITS; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i * 7);
        dates.push(d);
      }
    } else {
      // 120 days
      for (let i = 0; i < TIMELINE_UNITS; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dates.push(d);
      }
    }

    return dates;
  }, [startDate, viewMode]);

  // Calculate timeline width and cell width
  const timelineWidth = useMemo(() => {
    return viewMode === 'day'
      ? TIMELINE_UNITS * CELL_WIDTH_DAY  // 4800px
      : TIMELINE_UNITS * CELL_WIDTH_WEEK; // 7200px
  }, [viewMode]);

  const cellWidth = viewMode === 'day' ? CELL_WIDTH_DAY : CELL_WIDTH_WEEK;
  const unitInMs = viewMode === 'day'
    ? 24 * 60 * 60 * 1000  // 1 day in milliseconds
    : 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

  // Calculate today's position for the vertical bar
  const todayPosition = useMemo(() => {
    const today = new Date();
    const todayIndex = timelineDates.findIndex(date => {
      if (viewMode === 'day') {
        return date.toDateString() === today.toDateString();
      } else {
        return date <= today && new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000) > today;
      }
    });

    if (todayIndex === -1) return null;

    return 352 + todayIndex * (cellWidth - 0.14); // 352px = fixed column width
  }, [timelineDates, viewMode, cellWidth]);

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

  const moveCategoryOrder = (category: string, direction: 'up' | 'down') => {
    const currentOrder = loadCategoryOrder();
    const index = currentOrder.indexOf(category);

    if (index === -1) return; // Category not found

    if (direction === 'up' && index > 0) {
      // Swap with previous
      const newOrder = [...currentOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      saveCategoryOrder(newOrder);

      // Force re-render by updating local tasks
      setLocalTasks([...localTasks]);
    } else if (direction === 'down' && index < currentOrder.length - 1) {
      // Swap with next
      const newOrder = [...currentOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      saveCategoryOrder(newOrder);

      // Force re-render by updating local tasks
      setLocalTasks([...localTasks]);
    }
  };

  const moveSubCategoryOrder = (category: string, subCategory: string, direction: 'up' | 'down') => {
    const currentOrder = loadSubcategoryOrder();
    const categoryOrder = currentOrder[category] || [];
    const index = categoryOrder.indexOf(subCategory);

    if (index === -1) return; // Subcategory not found

    if (direction === 'up' && index > 0) {
      // Swap with previous
      const newCategoryOrder = [...categoryOrder];
      [newCategoryOrder[index - 1], newCategoryOrder[index]] = [newCategoryOrder[index], newCategoryOrder[index - 1]];

      const newOrder = { ...currentOrder, [category]: newCategoryOrder };
      saveSubcategoryOrder(newOrder);

      // Force re-render by updating local tasks
      setLocalTasks([...localTasks]);
    } else if (direction === 'down' && index < categoryOrder.length - 1) {
      // Swap with next
      const newCategoryOrder = [...categoryOrder];
      [newCategoryOrder[index], newCategoryOrder[index + 1]] = [newCategoryOrder[index + 1], newCategoryOrder[index]];

      const newOrder = { ...currentOrder, [category]: newCategoryOrder };
      saveSubcategoryOrder(newOrder);

      // Force re-render by updating local tasks
      setLocalTasks([...localTasks]);
    }
  };

  const getTaskPosition = (task: Task) => {
    const taskStart = task.start_date
      ? parseDateString(task.start_date)
      : task.events.length > 0
      ? new Date(Math.min(...task.events.filter(e => e.due_date).map(e => parseDateString(e.due_date!).getTime())))
      : null;

    const taskEnd = task.end_date
      ? parseDateString(task.end_date)
      : task.events.length > 0
      ? new Date(Math.max(...task.events.filter(e => e.due_date).map(e => parseDateString(e.due_date!).getTime())))
      : null;

    if (!taskStart || !taskEnd) return null;

    // Find which timeline cell the task starts and ends in
    let startCellIndex = -1;
    let endCellIndex = -1;

    for (let i = 0; i < timelineDates.length; i++) {
      const cellDate = timelineDates[i];
      const nextCellDate = i < timelineDates.length - 1
        ? timelineDates[i + 1]
        : new Date(cellDate.getTime() + unitInMs);

      // Check if taskStart falls in this cell
      if (startCellIndex === -1 && taskStart >= cellDate && taskStart < nextCellDate) {
        startCellIndex = i;
      }

      // Check if taskEnd falls in this cell (inclusive of the cell date)
      if (endCellIndex === -1 && taskEnd >= cellDate && taskEnd < nextCellDate) {
        endCellIndex = i;
      }
    }

    // If task is completely before visible range
    if (startCellIndex === -1 && taskEnd < timelineDates[0]) return null;

    // If task starts before visible range, clip to start
    if (startCellIndex === -1) startCellIndex = -1; // Will be clipped to 0 later

    // If task ends after visible range, clip to end
    if (endCellIndex === -1 && taskEnd >= timelineDates[0]) {
      endCellIndex = timelineDates.length - 1;
    }

    // Calculate position using fixed cell width (add +1 for shift)
    const leftPx = (startCellIndex + 1) * (cellWidth - 0.14);
    const widthInCells = endCellIndex - startCellIndex + 1;
    let widthPx = widthInCells * (cellWidth - 0.14);

    // If the bar starts before the visible area, adjust the width
    if (leftPx < 0) {
      widthPx = widthPx + leftPx; // leftPx is negative, so this subtracts from width
    }

    return {
      left: `${Math.max(0, leftPx) + TIMELINE_PADDING}px`,
      width: `${Math.max(cellWidth, widthPx)}px`,
      start: taskStart,
      end: taskEnd,
    };
  };

  const getCategoryPosition = (tasks: Task[]) => {
    const allDates: Date[] = [];

    tasks.forEach((task) => {
      const taskStart = task.start_date
        ? parseDateString(task.start_date)
        : task.events.length > 0
        ? new Date(Math.min(...task.events.filter(e => e.due_date).map(e => parseDateString(e.due_date!).getTime())))
        : null;

      const taskEnd = task.end_date
        ? parseDateString(task.end_date)
        : task.events.length > 0
        ? new Date(Math.max(...task.events.filter(e => e.due_date).map(e => parseDateString(e.due_date!).getTime())))
        : null;

      if (taskStart) allDates.push(taskStart);
      if (taskEnd) allDates.push(taskEnd);
    });

    if (allDates.length === 0) return null;

    const categoryStart = new Date(Math.min(...allDates.map(d => d.getTime())));
    const categoryEnd = new Date(Math.max(...allDates.map(d => d.getTime())));

    // Find which timeline cell the category starts and ends in
    let startCellIndex = -1;
    let endCellIndex = -1;

    for (let i = 0; i < timelineDates.length; i++) {
      const cellDate = timelineDates[i];
      const nextCellDate = i < timelineDates.length - 1
        ? timelineDates[i + 1]
        : new Date(cellDate.getTime() + unitInMs);

      // Check if categoryStart falls in this cell
      if (startCellIndex === -1 && categoryStart >= cellDate && categoryStart < nextCellDate) {
        startCellIndex = i;
      }

      // Check if categoryEnd falls in this cell
      if (endCellIndex === -1 && categoryEnd >= cellDate && categoryEnd < nextCellDate) {
        endCellIndex = i;
      }
    }

    // If category is completely before visible range
    if (startCellIndex === -1 && categoryEnd < timelineDates[0]) return null;

    // If category starts before visible range, clip to start
    if (startCellIndex === -1) startCellIndex = -1; // Will be clipped to 0 later

    // If category ends after visible range, clip to end
    if (endCellIndex === -1 && categoryEnd >= timelineDates[0]) {
      endCellIndex = timelineDates.length - 1;
    }

    // Calculate position using fixed cell width (add +1 for shift)
    const leftPx = (startCellIndex + 1) * (cellWidth - 0.14);
    const widthInCells = endCellIndex - startCellIndex + 1;
    let widthPx = widthInCells * (cellWidth - 0.14);

    // If the bar starts before the visible area, adjust the width
    if (leftPx < 0) {
      widthPx = widthPx + leftPx; // leftPx is negative, so this subtracts from width
    }

    return {
      left: `${Math.max(0, leftPx) + TIMELINE_PADDING}px`,
      width: `${Math.max(cellWidth, widthPx)}px`,
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

  const getEventColor = (status: string) => {
    const colors: Record<string, { bg: string; hover: string; border: string }> = {
      ToDo: { bg: 'bg-gray-500', hover: 'hover:bg-gray-400', border: 'border-t-gray-500' },
      InProgress: { bg: 'bg-blue-500', hover: 'hover:bg-blue-400', border: 'border-t-blue-500' },
      Confirmed: { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-400', border: 'border-t-yellow-500' },
      IceBox: { bg: 'bg-purple-500', hover: 'hover:bg-purple-400', border: 'border-t-purple-500' },
      Done: { bg: 'bg-green-500', hover: 'hover:bg-green-400', border: 'border-t-green-500' },
    };
    return colors[status] || { bg: 'bg-red-500', hover: 'hover:bg-red-400', border: 'border-t-red-500' };
  };

  // Save scroll position and prepare for restoration
  const saveScrollPositionAndRefresh = () => {
    // console.log('[Scroll Debug] saveScrollPositionAndRefresh called');
    // console.log('[Scroll Debug] Ref exists:', !!scrollContainerRef.current);

    if (scrollContainerRef.current && typeof window !== 'undefined') {
      const position = {
        scrollLeft: scrollContainerRef.current.scrollLeft,
        scrollTop: scrollContainerRef.current.scrollTop,
      };
      // console.log('[Scroll Debug] Saving position before refresh:', position);
      localStorage.setItem(STORAGE_KEY_SCROLL_POSITION, JSON.stringify(position));
      localStorage.setItem(STORAGE_KEY_SHOULD_RESTORE, 'true');
      shouldRestoreScroll.current = true;
      // console.log('[Scroll Debug] shouldRestoreScroll flag saved to localStorage');
    }
    // console.log('[Scroll Debug] Calling onRefresh...');
    onRefresh();
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setSelectedTaskId(event.task_id);
    setIsEventFormOpen(true);
  };

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleAddEvent = (taskId: string, date: string) => {
    setSelectedTaskId(taskId);
    setSelectedDate(date);
    setIsEventFormOpen(true);
  };

  const handleTaskEdit = (task: Task) => {
    setSelectedTask(task);
    setIsTaskFormOpen(true);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      // Load current order from localStorage
      const categoryOrder = loadCategoryOrder();
      const subcategoryOrder = loadSubcategoryOrder();
      const taskOrder = loadTaskOrder();

      // Convert expand state Sets to Arrays
      const expandedCategoriesArray = Array.from(expandedCategories);
      const expandedSubcategoriesArray = Array.from(expandedSubCategories);

      console.log('[GANTT] Saving order and expand state to database...');
      console.log('[GANTT] Category order:', categoryOrder);
      console.log('[GANTT] Subcategory order:', subcategoryOrder);
      console.log('[GANTT] Task order:', taskOrder);
      console.log('[GANTT] Expanded categories:', expandedCategoriesArray);
      console.log('[GANTT] Expanded subcategories:', expandedSubcategoriesArray);

      // Send to API
      const response = await fetch('/api/order/save-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: categoryOrder,
          subcategories: subcategoryOrder,
          tasks: taskOrder,
          expandedCategories: expandedCategoriesArray,
          expandedSubcategories: expandedSubcategoriesArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存に失敗しました');
      }

      console.log('[GANTT] Order and expand state saved successfully:', data);
      alert('並び順と展開状態を保存しました');
    } catch (error) {
      console.error('[GANTT] Error saving order:', error);
      alert(
        error instanceof Error
          ? `保存に失敗しました: ${error.message}`
          : '保存に失敗しました'
      );
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
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

    // Reorder the tasks within the subcategory
    const reorderedSubcategoryTasks = arrayMove(subcategoryTasks, oldIndex, newIndex);

    // Create a map for quick lookup of reordered tasks by ID
    const reorderedMap = new Map(reorderedSubcategoryTasks.map((task, index) => [task.id, index]));

    // Separate tasks into the reordered subcategory and others
    const otherTasks = localTasks.filter(
      (t) => t.category !== activeTask.category || t.sub_category !== activeTask.sub_category
    );

    // Rebuild the task list:
    // 1. Keep all tasks that are NOT in the affected subcategory
    // 2. Insert the reordered subcategory tasks in the correct position
    const newLocalTasks: Task[] = [];
    let reorderedInserted = false;

    for (const task of localTasks) {
      const isInReorderedSubcategory =
        task.category === activeTask.category && task.sub_category === activeTask.sub_category;

      if (isInReorderedSubcategory) {
        // Insert all reordered tasks at the position of the first task in this subcategory
        if (!reorderedInserted) {
          newLocalTasks.push(...reorderedSubcategoryTasks);
          reorderedInserted = true;
        }
        // Skip individual tasks from this subcategory (already added as a group)
      } else {
        // Add tasks from other subcategories as-is
        newLocalTasks.push(task);
      }
    }

    setLocalTasks(newLocalTasks);

    // Save the new order to localStorage (no API call, no page reload)
    const taskIds = reorderedSubcategoryTasks.map(t => t.id);
    updateTaskOrderForSubcategory(activeTask.category, activeTask.sub_category, taskIds);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="bg-gray-800 rounded-lg p-2">
        <div className="mb-2 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-0.5 rounded ${
                viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              日
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-0.5 rounded ${
                viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              週
            </button>
            <input
              type="date"
              value={startDate.toISOString().split('T')[0]}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="px-3 py-0.5 bg-gray-700 text-white rounded border border-gray-600"
            />
          </div>
        </div>

        <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-224px)]">
          <div className="relative" style={{ width: `${timelineWidth + 352}px` }}>
            {/* Today vertical bar */}
            {todayPosition !== null && (
              <div
                className="absolute top-0 bottom-0 bg-cyan-500/30 pointer-events-none"
                style={{
                  left: `${todayPosition + TIMELINE_PADDING}px`,
                  width: `${cellWidth}px`,
                  zIndex: 15,
                }}
              />
            )}
            {/* Timeline header */}
            <div className="flex border-b border-gray-700 sticky top-0 bg-gray-800 z-30">
              <div className="w-88 flex-shrink-0 p-2 font-bold text-gray-300 sticky left-0 bg-gray-800 z-30 flex items-center justify-between">
                <span>タスク</span>
                <button
                  onClick={handleSaveOrder}
                  disabled={isSavingOrder}
                  className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                >
                  {isSavingOrder ? '保存中...' : '並び順を保存'}
                </button>
              </div>
              <div className="flex relative p-2" style={{ width: `${timelineWidth}px` }}>
                {timelineDates.map((date, index) => {
                  const today = new Date();
                  const isToday = viewMode === 'day'
                    ? date.toDateString() === today.toDateString()
                    : date <= today && new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000) > today;

                  return (
                    <div
                      key={index}
                      className={`text-center text-xs border-l border-gray-700 flex flex-col items-center justify-center ${
                        isToday ? 'text-yellow-300 font-semibold' : 'text-gray-400'
                      }`}
                      style={{ width: `${cellWidth}px` }}
                    >
                      {viewMode === 'week' ? (
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
            {sortedCategories.map((category, categoryIndex) => {
              const subCategories = groupedTasks[category];
              // Get all tasks in this category
              const allCategoryTasks: Task[] = [];
              Object.values(subCategories).forEach((tasks) => {
                allCategoryTasks.push(...tasks);
              });
              const categoryPosition = getCategoryPosition(allCategoryTasks);

              const isFirstCategory = categoryIndex === 0;
              const isLastCategory = categoryIndex === sortedCategories.length - 1;

              return (
                <div key={category}>
                  {/* Category header */}
                  <div className="flex bg-gray-700 hover:bg-gray-600 group">
                    <div className="w-88 flex-shrink-0 p-2 font-bold text-white flex items-center gap-2 sticky left-0 bg-gray-700 group-hover:bg-gray-600 z-20">
                      <span
                        className="cursor-pointer"
                        onClick={() => toggleCategory(category)}
                      >
                        {expandedCategories.has(category) ? '▼' : '▶'}
                      </span>
                      <span
                        className="flex-1 cursor-pointer"
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                      </span>
                      <div className="flex gap-1">
                        {onAddTask && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Get the first subcategory for this category
                              const firstSubCategory = Object.keys(subCategories)[0] || '';
                              onAddTask(category, firstSubCategory);
                            }}
                            className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded cursor-pointer"
                            title="タスク追加"
                          >
                            ＋
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isFirstCategory) moveCategoryOrder(category, 'up');
                          }}
                          disabled={isFirstCategory}
                          className={`text-xs px-1 py-0.5 rounded ${
                            isFirstCategory
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 hover:bg-gray-500 cursor-pointer'
                          }`}
                          title={isFirstCategory ? '一番上です' : '上へ移動'}
                        >
                          ▲
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLastCategory) moveCategoryOrder(category, 'down');
                          }}
                          disabled={isLastCategory}
                          className={`text-xs px-1 py-0.5 rounded ${
                            isLastCategory
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 hover:bg-gray-500 cursor-pointer'
                          }`}
                          title={isLastCategory ? '一番下です' : '下へ移動'}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                    <div className="flex relative p-2" style={{ width: `${timelineWidth}px` }}>
                      {timelineDates.map((date, index) => {
                        return (
                          <div
                            key={index}
                            className="border-l border-gray-700"
                            style={{ width: `${cellWidth}px` }}
                          />
                        );
                      })}
                      {categoryPosition && (
                        <>
                          <div
                            className="absolute h-8 rounded bg-gray-500 opacity-60 pointer-events-none"
                            style={{
                              left: categoryPosition.left,
                              width: categoryPosition.width,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              zIndex: 5,
                            }}
                            title={`${category}: ${categoryPosition.start.toLocaleDateString('ja-JP')} - ${categoryPosition.end.toLocaleDateString('ja-JP')}`}
                          />
                          {/* Event markers for all tasks in category */}
                          {(() => {
                            // Collect all events from category tasks
                            const allEvents = allCategoryTasks.flatMap(task =>
                              (task.events || []).map(event => ({ task, event }))
                            );

                            // Group events by date
                            const eventsByDate = new Map<string, typeof allEvents>();
                            allEvents.forEach(({ task, event }) => {
                              if (event.due_date) {
                                const dateKey = event.due_date.split('T')[0];
                                if (!eventsByDate.has(dateKey)) {
                                  eventsByDate.set(dateKey, []);
                                }
                                eventsByDate.get(dateKey)!.push({ task, event });
                              }
                            });

                            return allEvents.map(({ task, event }, eventIndex) => {
                              if (!event.due_date) return null;
                              const eventDate = parseDateString(event.due_date);
                              const dateKey = event.due_date.split('T')[0];

                              // Find which timeline cell this event falls in
                              let eventCellIndex = -1;
                              for (let i = 0; i < timelineDates.length; i++) {
                                const cellDate = timelineDates[i];
                                const nextCellDate = i < timelineDates.length - 1
                                  ? timelineDates[i + 1]
                                  : new Date(cellDate.getTime() + unitInMs);

                                if (eventDate >= cellDate && eventDate < nextCellDate) {
                                  eventCellIndex = i;
                                  break;
                                }
                              }

                              if (eventCellIndex === -1) return null; // Event is outside visible range

                              // Calculate position using fixed cell width (add +1 for shift, center in cell)
                              const eventPos = (eventCellIndex + 1) * (cellWidth - 0.14) + ((cellWidth - 0.14) / 2);

                              // Calculate vertical offset for stacked events on same date
                              const eventsOnThisDate = eventsByDate.get(dateKey) || [];
                              const indexInDate = eventsOnThisDate.findIndex(e => e.event.id === event.id);
                              const totalEventsOnDate = eventsOnThisDate.length;
                              const verticalOffset = (indexInDate - (totalEventsOnDate - 1) / 2) * 12; // 12px spacing

                              const eventColor = getEventColor(event.status);
                              const tooltipText = `${task.sub_category} : ${task.name} : ${event.name}${event.note ? '\nメモ: ' + event.note : ''}`;

                              return (
                                <div
                                  key={`cat-event-${event.id}-${eventIndex}`}
                                  className="absolute cursor-pointer"
                                  style={{
                                    left: `${eventPos + TIMELINE_PADDING}px`,
                                    top: '50%',
                                    transform: `translate(-50%, calc(-50% + ${verticalOffset}px))`,
                                    zIndex: 12,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEventClick(event);
                                  }}
                                  title={tooltipText}
                                >
                                  <div className={`w-2.5 h-2.5 ${eventColor.bg} rounded-full border border-white`}></div>
                                </div>
                              );
                            });
                          })()}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Subcategories */}
                  {expandedCategories.has(category) &&
                    getSortedSubCategories(category).map((subCategory, subCategoryIndex, subCategoryArray) => {
                      const subTasks = subCategories[subCategory];
                      const subCategoryKey = `${category}-${subCategory}`;
                      const subCategoryPosition = getCategoryPosition(subTasks);

                      const isFirstSubCategory = subCategoryIndex === 0;
                      const isLastSubCategory = subCategoryIndex === subCategoryArray.length - 1;

                      return (
                        <div key={subCategoryKey}>
                          {/* Subcategory header */}
                          <div className="flex bg-gray-800 hover:bg-gray-700 group">
                            <div className="w-88 flex-shrink-0 p-2 pl-6 font-semibold text-gray-200 flex items-center gap-2 sticky left-0 bg-gray-800 group-hover:bg-gray-700 z-20">
                              <span
                                className="cursor-pointer"
                                onClick={() => toggleSubCategory(subCategoryKey)}
                              >
                                {expandedSubCategories.has(subCategoryKey) ? '▼' : '▶'}
                              </span>
                              <span
                                className="flex-1 cursor-pointer"
                                onClick={() => toggleSubCategory(subCategoryKey)}
                              >
                                {subCategory}
                              </span>
                              <div className="flex gap-1">
                                {onAddTask && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddTask(category, subCategory);
                                    }}
                                    className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded cursor-pointer"
                                    title="タスク追加"
                                  >
                                    ＋
                                  </button>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isFirstSubCategory) moveSubCategoryOrder(category, subCategory, 'up');
                                  }}
                                  disabled={isFirstSubCategory}
                                  className={`text-xs px-1 py-0.5 rounded ${
                                    isFirstSubCategory
                                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                      : 'bg-gray-600 hover:bg-gray-500 cursor-pointer'
                                  }`}
                                  title={isFirstSubCategory ? '一番上です' : '上へ移動'}
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isLastSubCategory) moveSubCategoryOrder(category, subCategory, 'down');
                                  }}
                                  disabled={isLastSubCategory}
                                  className={`text-xs px-1 py-0.5 rounded ${
                                    isLastSubCategory
                                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                      : 'bg-gray-600 hover:bg-gray-500 cursor-pointer'
                                  }`}
                                  title={isLastSubCategory ? '一番下です' : '下へ移動'}
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                            <div className="flex relative p-2" style={{ width: `${timelineWidth}px` }}>
                              {timelineDates.map((date, index) => {
                                return (
                                  <div
                                    key={index}
                                    className="border-l border-gray-700"
                                    style={{ width: `${cellWidth}px` }}
                                  />
                                );
                              })}
                              {subCategoryPosition && (
                                <>
                                  <div
                                    className="absolute h-6 rounded bg-gray-400 opacity-60 pointer-events-none"
                                    style={{
                                      left: subCategoryPosition.left,
                                      width: subCategoryPosition.width,
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      zIndex: 5,
                                    }}
                                    title={`${subCategory}: ${subCategoryPosition.start.toLocaleDateString('ja-JP')} - ${subCategoryPosition.end.toLocaleDateString('ja-JP')}`}
                                  />
                                  {/* Event markers for all tasks in subcategory */}
                                  {(() => {
                                    // Collect all events from subcategory tasks
                                    const allEvents = subTasks.flatMap(task =>
                                      (task.events || []).map(event => ({ task, event }))
                                    );

                                    // Group events by date
                                    const eventsByDate = new Map<string, typeof allEvents>();
                                    allEvents.forEach(({ task, event }) => {
                                      if (event.due_date) {
                                        const dateKey = event.due_date.split('T')[0];
                                        if (!eventsByDate.has(dateKey)) {
                                          eventsByDate.set(dateKey, []);
                                        }
                                        eventsByDate.get(dateKey)!.push({ task, event });
                                      }
                                    });

                                    return allEvents.map(({ task, event }, eventIndex) => {
                                      if (!event.due_date) return null;
                                      const eventDate = parseDateString(event.due_date);
                                      const dateKey = event.due_date.split('T')[0];

                                      // Find which timeline cell this event falls in
                                      let eventCellIndex = -1;
                                      for (let i = 0; i < timelineDates.length; i++) {
                                        const cellDate = timelineDates[i];
                                        const nextCellDate = i < timelineDates.length - 1
                                          ? timelineDates[i + 1]
                                          : new Date(cellDate.getTime() + unitInMs);

                                        if (eventDate >= cellDate && eventDate < nextCellDate) {
                                          eventCellIndex = i;
                                          break;
                                        }
                                      }

                                      if (eventCellIndex === -1) return null; // Event is outside visible range

                                      // Calculate position using fixed cell width (add +1 for shift, center in cell)
                                      const eventPos = (eventCellIndex + 1) * (cellWidth - 0.14) + ((cellWidth - 0.14) / 2);

                                      // Calculate vertical offset for stacked events on same date
                                      const eventsOnThisDate = eventsByDate.get(dateKey) || [];
                                      const indexInDate = eventsOnThisDate.findIndex(e => e.event.id === event.id);
                                      const totalEventsOnDate = eventsOnThisDate.length;
                                      const verticalOffset = (indexInDate - (totalEventsOnDate - 1) / 2) * 12; // 12px spacing

                                      const eventColor = getEventColor(event.status);
                                      const tooltipText = `${task.name} : ${event.name}${event.note ? '\nメモ: ' + event.note : ''}`;

                                      return (
                                        <div
                                          key={`subcat-event-${event.id}-${eventIndex}`}
                                          className="absolute cursor-pointer"
                                          style={{
                                            left: `${eventPos + TIMELINE_PADDING}px`,
                                            top: '50%',
                                            transform: `translate(-50%, calc(-50% + ${verticalOffset}px))`,
                                            zIndex: 12,
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEventClick(event);
                                          }}
                                          title={tooltipText}
                                        >
                                          <div className={`w-2.5 h-2.5 ${eventColor.bg} rounded-full border border-white`}></div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </>
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
                                getEventColor={getEventColor}
                                handleEventClick={handleEventClick}
                                handleAddEvent={handleAddEvent}
                                handleTaskEdit={handleTaskEdit}
                                mouseDownInfo={mouseDownInfo}
                                setMouseDownInfo={setMouseDownInfo}
                                lastClickInfo={lastClickInfo}
                                setLastClickInfo={setLastClickInfo}
                                singleClickTimer={singleClickTimer}
                                setSingleClickTimer={setSingleClickTimer}
                                timelineWidth={timelineWidth}
                                cellWidth={cellWidth}
                                unitInMs={unitInMs}
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
            setSelectedEvent(null);
          }}
          onSave={saveScrollPositionAndRefresh}
          taskId={selectedTaskId || undefined}
          editData={selectedEvent}
          selectedDate={selectedDate}
          taskAssignee={selectedTaskId ? localTasks.find(t => t.id === selectedTaskId)?.assignee : null}
        />

        <TaskForm
          isOpen={isTaskFormOpen}
          onClose={() => {
            setIsTaskFormOpen(false);
            setSelectedTask(null);
          }}
          onSave={saveScrollPositionAndRefresh}
          editData={selectedTask}
        />
      </div>
    </DndContext>
  );
}
