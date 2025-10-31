import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let orders;
    if (category) {
      orders = await query(
        'SELECT * FROM subcategory_order WHERE category = $1 ORDER BY display_order',
        [category]
      );
    } else {
      orders = await query('SELECT * FROM subcategory_order ORDER BY category, display_order');
    }

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching subcategory orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subcategory orders' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { category, sub_category, direction } = await request.json();

    if (!category || !sub_category || !direction) {
      return NextResponse.json(
        { error: 'Category, sub_category, and direction are required' },
        { status: 400 }
      );
    }

    // Get all subcategories for this category ordered by display_order
    const allOrders = await query(
      'SELECT * FROM subcategory_order WHERE category = $1 ORDER BY display_order',
      [category]
    );

    // If this subcategory doesn't exist in the order table, add it
    const existingIndex = allOrders.findIndex(
      (o: any) => o.sub_category === sub_category
    );

    if (existingIndex === -1) {
      // Insert new subcategory at the end for this category
      const maxOrder = allOrders.length > 0
        ? Math.max(...allOrders.map((o: any) => o.display_order))
        : -1;
      await query(
        'INSERT INTO subcategory_order (category, sub_category, display_order) VALUES ($1, $2, $3)',
        [category, sub_category, maxOrder + 1]
      );
      const updatedOrders = await query(
        'SELECT * FROM subcategory_order WHERE category = $1 ORDER BY display_order',
        [category]
      );
      return NextResponse.json({ orders: updatedOrders });
    }

    const currentOrder = allOrders[existingIndex].display_order;

    if (direction === 'up') {
      if (existingIndex === 0) {
        // Already at the top
        return NextResponse.json({ orders: allOrders });
      }

      const prevOrder = allOrders[existingIndex - 1].display_order;
      const prevSubCategory = allOrders[existingIndex - 1].sub_category;

      // Swap orders
      await query(
        'UPDATE subcategory_order SET display_order = $1 WHERE category = $2 AND sub_category = $3',
        [prevOrder, category, sub_category]
      );
      await query(
        'UPDATE subcategory_order SET display_order = $1 WHERE category = $2 AND sub_category = $3',
        [currentOrder, category, prevSubCategory]
      );
    } else if (direction === 'down') {
      if (existingIndex === allOrders.length - 1) {
        // Already at the bottom
        return NextResponse.json({ orders: allOrders });
      }

      const nextOrder = allOrders[existingIndex + 1].display_order;
      const nextSubCategory = allOrders[existingIndex + 1].sub_category;

      // Swap orders
      await query(
        'UPDATE subcategory_order SET display_order = $1 WHERE category = $2 AND sub_category = $3',
        [nextOrder, category, sub_category]
      );
      await query(
        'UPDATE subcategory_order SET display_order = $1 WHERE category = $2 AND sub_category = $3',
        [currentOrder, category, nextSubCategory]
      );
    }

    const updatedOrders = await query(
      'SELECT * FROM subcategory_order WHERE category = $1 ORDER BY display_order',
      [category]
    );
    return NextResponse.json({ orders: updatedOrders });
  } catch (error) {
    console.error('Error updating subcategory order:', error);
    return NextResponse.json(
      { error: 'Failed to update subcategory order' },
      { status: 500 }
    );
  }
}
