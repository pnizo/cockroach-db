import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface SaveOrderRequest {
  categories: string[];
  subcategories: Record<string, string[]>;
  tasks: Record<string, string[]>; // key: "category|subcategory", value: task IDs in order
  expandedCategories: string[]; // List of expanded category names
  expandedSubcategories: string[]; // List of expanded subcategory keys "category|subcategory"
}

export async function POST(request: Request) {
  try {
    const body: SaveOrderRequest = await request.json();
    const { categories, subcategories, tasks, expandedCategories, expandedSubcategories } = body;

    console.log('[SAVE_ORDER] Starting bulk order save...');
    console.log('[SAVE_ORDER] Categories:', categories.length);
    console.log('[SAVE_ORDER] Subcategories:', Object.keys(subcategories).length);
    console.log('[SAVE_ORDER] Task groups:', Object.keys(tasks).length);
    console.log('[SAVE_ORDER] Expanded categories:', expandedCategories?.length || 0);
    console.log('[SAVE_ORDER] Expanded subcategories:', expandedSubcategories?.length || 0);

    // 1. Save category order
    console.log('[SAVE_ORDER] Saving category order...');
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      await query(
        `INSERT INTO category_order (category, display_order)
         VALUES ($1, $2)
         ON CONFLICT (category)
         DO UPDATE SET display_order = $2`,
        [category, i]
      );
    }

    // 2. Save subcategory order
    console.log('[SAVE_ORDER] Saving subcategory order...');
    for (const category in subcategories) {
      const subCategoryList = subcategories[category];
      for (let i = 0; i < subCategoryList.length; i++) {
        const subCategory = subCategoryList[i];
        await query(
          `INSERT INTO subcategory_order (category, sub_category, display_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (category, sub_category)
           DO UPDATE SET display_order = $3`,
          [category, subCategory, i]
        );
      }
    }

    // 3. Save task order
    console.log('[SAVE_ORDER] Saving task order...');
    let taskUpdateCount = 0;
    for (const key in tasks) {
      const taskIds = tasks[key];
      for (let i = 0; i < taskIds.length; i++) {
        const taskId = taskIds[i];
        await query(
          `UPDATE task SET display_order = $1 WHERE id = $2`,
          [i, taskId]
        );
        taskUpdateCount++;
      }
    }

    // 4. Save category expand state
    console.log('[SAVE_ORDER] Saving category expand state...');
    const expandedCategoriesSet = new Set(expandedCategories || []);
    for (const category of categories) {
      const isExpanded = expandedCategoriesSet.has(category);
      await query(
        `INSERT INTO category_expand_state (category, is_expanded)
         VALUES ($1, $2)
         ON CONFLICT (category)
         DO UPDATE SET is_expanded = $2, updated_at = CURRENT_TIMESTAMP`,
        [category, isExpanded]
      );
    }

    // 5. Save subcategory expand state
    console.log('[SAVE_ORDER] Saving subcategory expand state...');
    const expandedSubcategoriesSet = new Set(expandedSubcategories || []);
    for (const category in subcategories) {
      const subCategoryList = subcategories[category];
      for (const subCategory of subCategoryList) {
        const key = `${category}|${subCategory}`;
        const isExpanded = expandedSubcategoriesSet.has(key);
        await query(
          `INSERT INTO subcategory_expand_state (category, sub_category, is_expanded)
           VALUES ($1, $2, $3)
           ON CONFLICT (category, sub_category)
           DO UPDATE SET is_expanded = $3, updated_at = CURRENT_TIMESTAMP`,
          [category, subCategory, isExpanded]
        );
      }
    }

    console.log('[SAVE_ORDER] Order saved successfully');
    console.log(`[SAVE_ORDER] Updated ${taskUpdateCount} tasks`);

    return NextResponse.json({
      success: true,
      message: '並び順と展開状態を保存しました',
      stats: {
        categories: categories.length,
        subcategories: Object.values(subcategories).flat().length,
        tasks: taskUpdateCount,
        expandedCategories: expandedCategories?.length || 0,
        expandedSubcategories: expandedSubcategories?.length || 0
      }
    });

  } catch (error) {
    console.error('[SAVE_ORDER] Error saving order:', error);
    return NextResponse.json(
      {
        success: false,
        error: '並び順の保存に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
