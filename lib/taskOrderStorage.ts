/**
 * Task Order Storage - localStorage management for task, category, and subcategory ordering
 *
 * This module manages the display order of tasks, categories, and subcategories
 * using browser localStorage instead of database persistence.
 */

// Minimal task interface for ordering purposes
export interface MinimalTask {
  id: string;
  category: string;
  sub_category: string;
  display_order: number;
}

// Generic task type that extends MinimalTask
export type Task<T extends MinimalTask = MinimalTask> = T;

// Storage keys
const TASK_ORDER_KEY = 'gantt_task_order';
const CATEGORY_ORDER_KEY = 'gantt_category_order';
const SUBCATEGORY_ORDER_KEY = 'gantt_subcategory_order';

/**
 * Get subcategory key for organizing tasks
 */
function getSubcategoryKey(category: string, subCategory: string): string {
  return `${category}::${subCategory}`;
}

/**
 * Load task order from localStorage
 * Returns a map of subcategory keys to task ID arrays
 */
export function loadTaskOrder(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(TASK_ORDER_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load task order from localStorage:', error);
    return {};
  }
}

/**
 * Save task order to localStorage
 */
export function saveTaskOrder(order: Record<string, string[]>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(TASK_ORDER_KEY, JSON.stringify(order));
  } catch (error) {
    console.error('Failed to save task order to localStorage:', error);
  }
}

/**
 * Initialize task order from database tasks if not already in localStorage
 */
export function initializeTaskOrder<T extends MinimalTask>(tasks: T[]): Record<string, string[]> {
  const existingOrder = loadTaskOrder();

  // If we already have order data, return it
  if (Object.keys(existingOrder).length > 0) {
    return existingOrder;
  }

  // Initialize from database display_order
  const newOrder: Record<string, string[]> = {};

  // Group tasks by subcategory
  const tasksBySubcategory: Record<string, T[]> = {};

  tasks.forEach(task => {
    const key = getSubcategoryKey(task.category, task.sub_category);
    if (!tasksBySubcategory[key]) {
      tasksBySubcategory[key] = [];
    }
    tasksBySubcategory[key].push(task);
  });

  // Sort each subcategory's tasks by display_order and extract IDs
  Object.keys(tasksBySubcategory).forEach(key => {
    newOrder[key] = tasksBySubcategory[key]
      .sort((a, b) => a.display_order - b.display_order)
      .map(task => task.id);
  });

  // Save to localStorage
  saveTaskOrder(newOrder);

  return newOrder;
}

/**
 * Update task order for a specific subcategory
 */
export function updateTaskOrderForSubcategory(
  category: string,
  subCategory: string,
  taskIds: string[]
): void {
  const order = loadTaskOrder();
  const key = getSubcategoryKey(category, subCategory);
  order[key] = taskIds;
  saveTaskOrder(order);
}

/**
 * Add a new task to the order (appends to end of its subcategory)
 */
export function addTaskToOrder<T extends MinimalTask>(task: T): void {
  const order = loadTaskOrder();
  const key = getSubcategoryKey(task.category, task.sub_category);

  if (!order[key]) {
    order[key] = [];
  }

  // Only add if not already present
  if (!order[key].includes(task.id)) {
    order[key].push(task.id);
  }

  saveTaskOrder(order);
}

/**
 * Add a new task to the end of a specific subcategory by ID
 * Used when creating new tasks to immediately register them in localStorage
 */
export function addNewTaskToSubcategory(
  category: string,
  subCategory: string,
  taskId: string
): void {
  const order = loadTaskOrder();
  const key = getSubcategoryKey(category, subCategory);

  if (!order[key]) {
    order[key] = [];
  }

  // Only add if not already present
  if (!order[key].includes(taskId)) {
    order[key].push(taskId);
  }

  saveTaskOrder(order);
}

/**
 * Remove a task from the order
 */
export function removeTaskFromOrder(taskId: string): void {
  const order = loadTaskOrder();

  // Remove from all subcategories
  Object.keys(order).forEach(key => {
    order[key] = order[key].filter(id => id !== taskId);
  });

  saveTaskOrder(order);
}

/**
 * Clean up deleted tasks from order (remove IDs that don't exist in current tasks)
 */
export function cleanupTaskOrder(existingTaskIds: string[]): void {
  const order = loadTaskOrder();
  const taskIdSet = new Set(existingTaskIds);
  let changed = false;

  Object.keys(order).forEach(key => {
    const before = order[key].length;
    order[key] = order[key].filter(id => taskIdSet.has(id));
    if (order[key].length !== before) {
      changed = true;
    }
  });

  if (changed) {
    saveTaskOrder(order);
  }
}

/**
 * Sort tasks according to localStorage order
 */
export function sortTasksByOrder<T extends MinimalTask>(tasks: T[]): T[] {
  const order = loadTaskOrder();
  const sorted: T[] = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // Group by subcategory
  const tasksBySubcategory: Record<string, T[]> = {};
  tasks.forEach(task => {
    const key = getSubcategoryKey(task.category, task.sub_category);
    if (!tasksBySubcategory[key]) {
      tasksBySubcategory[key] = [];
    }
    tasksBySubcategory[key].push(task);
  });

  // Sort each subcategory according to order
  Object.keys(tasksBySubcategory).forEach(key => {
    const subcategoryTasks = tasksBySubcategory[key];
    const orderedIds = order[key] || [];

    // First add tasks in the specified order
    orderedIds.forEach(id => {
      const task = taskMap.get(id);
      if (task && subcategoryTasks.includes(task)) {
        sorted.push(task);
      }
    });

    // Then add any tasks not in the order (newly added tasks)
    subcategoryTasks.forEach(task => {
      if (!orderedIds.includes(task.id)) {
        sorted.push(task);
      }
    });
  });

  return sorted;
}

// ========== Category Order Management ==========

/**
 * Load category order from localStorage
 */
export function loadCategoryOrder(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(CATEGORY_ORDER_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load category order from localStorage:', error);
    return [];
  }
}

/**
 * Save category order to localStorage
 */
export function saveCategoryOrder(categories: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(categories));
  } catch (error) {
    console.error('Failed to save category order to localStorage:', error);
  }
}

/**
 * Initialize category order from tasks
 */
export function initializeCategoryOrder<T extends MinimalTask>(tasks: T[]): string[] {
  const existingOrder = loadCategoryOrder();

  if (existingOrder.length > 0) {
    return existingOrder;
  }

  // Extract unique categories and sort by their first task's display_order
  const categoryMap = new Map<string, number>();

  tasks.forEach(task => {
    if (!categoryMap.has(task.category)) {
      categoryMap.set(task.category, task.display_order);
    }
  });

  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(entry => entry[0]);

  saveCategoryOrder(categories);
  return categories;
}

/**
 * Add a new category to the order
 */
export function addCategoryToOrder(category: string): void {
  const order = loadCategoryOrder();

  if (!order.includes(category)) {
    order.push(category);
    saveCategoryOrder(order);
  }
}

// ========== Subcategory Order Management ==========

/**
 * Load subcategory order from localStorage
 */
export function loadSubcategoryOrder(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(SUBCATEGORY_ORDER_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load subcategory order from localStorage:', error);
    return {};
  }
}

/**
 * Save subcategory order to localStorage
 */
export function saveSubcategoryOrder(order: Record<string, string[]>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SUBCATEGORY_ORDER_KEY, JSON.stringify(order));
  } catch (error) {
    console.error('Failed to save subcategory order to localStorage:', error);
  }
}

/**
 * Initialize subcategory order from tasks
 */
export function initializeSubcategoryOrder<T extends MinimalTask>(tasks: T[]): Record<string, string[]> {
  const existingOrder = loadSubcategoryOrder();

  if (Object.keys(existingOrder).length > 0) {
    return existingOrder;
  }

  const newOrder: Record<string, string[]> = {};

  // Group by category and track subcategories with their first display_order
  const subcategoryMap = new Map<string, Map<string, number>>();

  tasks.forEach(task => {
    if (!subcategoryMap.has(task.category)) {
      subcategoryMap.set(task.category, new Map());
    }
    const subMap = subcategoryMap.get(task.category)!;

    if (!subMap.has(task.sub_category)) {
      subMap.set(task.sub_category, task.display_order);
    }
  });

  // Sort subcategories within each category
  subcategoryMap.forEach((subMap, category) => {
    newOrder[category] = Array.from(subMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(entry => entry[0]);
  });

  saveSubcategoryOrder(newOrder);
  return newOrder;
}

/**
 * Add a new subcategory to the order
 */
export function addSubcategoryToOrder(category: string, subCategory: string): void {
  const order = loadSubcategoryOrder();

  if (!order[category]) {
    order[category] = [];
  }

  if (!order[category].includes(subCategory)) {
    order[category].push(subCategory);
    saveSubcategoryOrder(order);
  }
}
