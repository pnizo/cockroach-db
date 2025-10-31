import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const orders = await query('SELECT * FROM category_order ORDER BY display_order');
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching category orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category orders' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { category, direction } = await request.json();

    if (!category || !direction) {
      return NextResponse.json(
        { error: 'Category and direction are required' },
        { status: 400 }
      );
    }

    // Get all categories ordered by display_order
    const allOrders = await query('SELECT * FROM category_order ORDER BY display_order');

    // If this category doesn't exist in the order table, add it
    const existingIndex = allOrders.findIndex((o: any) => o.category === category);

    if (existingIndex === -1) {
      // Insert new category at the end
      const maxOrder = allOrders.length > 0 ? Math.max(...allOrders.map((o: any) => o.display_order)) : -1;
      await query(
        'INSERT INTO category_order (category, display_order) VALUES ($1, $2)',
        [category, maxOrder + 1]
      );
      const updatedOrders = await query('SELECT * FROM category_order ORDER BY display_order');
      return NextResponse.json({ orders: updatedOrders });
    }

    const currentOrder = allOrders[existingIndex].display_order;

    if (direction === 'up') {
      if (existingIndex === 0) {
        // Already at the top
        return NextResponse.json({ orders: allOrders });
      }

      const prevOrder = allOrders[existingIndex - 1].display_order;
      const prevCategory = allOrders[existingIndex - 1].category;

      // Swap orders
      await query('UPDATE category_order SET display_order = $1 WHERE category = $2', [prevOrder, category]);
      await query('UPDATE category_order SET display_order = $1 WHERE category = $2', [currentOrder, prevCategory]);
    } else if (direction === 'down') {
      if (existingIndex === allOrders.length - 1) {
        // Already at the bottom
        return NextResponse.json({ orders: allOrders });
      }

      const nextOrder = allOrders[existingIndex + 1].display_order;
      const nextCategory = allOrders[existingIndex + 1].category;

      // Swap orders
      await query('UPDATE category_order SET display_order = $1 WHERE category = $2', [nextOrder, category]);
      await query('UPDATE category_order SET display_order = $1 WHERE category = $2', [currentOrder, nextCategory]);
    }

    const updatedOrders = await query('SELECT * FROM category_order ORDER BY display_order');
    return NextResponse.json({ orders: updatedOrders });
  } catch (error) {
    console.error('Error updating category order:', error);
    return NextResponse.json(
      { error: 'Failed to update category order' },
      { status: 500 }
    );
  }
}
