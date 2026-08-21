import { db } from '@/lib/db/drizzle';
import { deleteCache } from '@/modules/cache';
import { widgets, storefrontLayouts } from '@/lib/db/schema';
import { count, eq, ilike, or, and, lte, gte, isNotNull } from 'drizzle-orm';
import {
    CreateWidgetInput,
    UpdateWidgetInput,
    Widget,
    PaginationParams,
    PaginatedWidgetsResult,
    createWidgetSchema,
    updateWidgetSchema,
} from '../types/customizationTypes';

// Helper function to convert raw DB widget to Widget type
function mapDbToWidget(dbWidget: any): Widget {
    // Handle isActive boolean which might be boolean or string "TRUE"/"FALSE"
    let isActive = true;
    const rawActive = dbWidget.isActive ?? dbWidget.is_active;
    if (typeof rawActive === 'string') {
        isActive = rawActive.toUpperCase() === 'TRUE';
    } else if (rawActive !== undefined && rawActive !== null) {
        isActive = !!rawActive;
    }

    // Robust mapping to handle potential variations in DB driver or column naming
    return {
        id: dbWidget.id,
        layoutId: dbWidget.layoutId || dbWidget.layout_id,
        type: dbWidget.type,
        order: typeof dbWidget.order === 'number' ? dbWidget.order : (typeof dbWidget.sort_order === 'number' ? dbWidget.sort_order : 0),
        isActive,
        createdAt: dbWidget.createdAt || dbWidget.created_at || new Date(),
        updatedAt: dbWidget.updatedAt || dbWidget.updated_at || new Date(),
        data: dbWidget.data || dbWidget.config || {},
        style: dbWidget.style || dbWidget.extra_config || undefined,
        targeting: dbWidget.targeting || undefined,
    } as Widget;
}

// Helper function to resolve the current active layout ID
export async function getActiveLayoutId(): Promise<string | undefined> {
    const now = new Date();
    // Use Libya timezone (UTC+2)
    const libyaOffset = 2 * 60; // minutes
    const libyaTime = new Date(now.getTime() + (libyaOffset + now.getTimezoneOffset()) * 60000);
    const currentDay = libyaTime.getDay(); // 0=Sunday
    const currentHour = libyaTime.getHours();

    // 1. Fetch all non-global layouts to check active schedule in memory
    const scheduledLayouts = await db.select().from(storefrontLayouts)
        .where(eq(storefrontLayouts.isGlobalActive, false));

    // Sort them descending by updatedAt so newest tweaks win if multiple match
    scheduledLayouts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    for (const layout of scheduledLayouts) {
        let isMatching = false;

        const hasDateRange = layout.activeStartDate !== null && layout.activeEndDate !== null;
        const hasDays = layout.activeDays !== null && layout.activeDays.length > 0;
        const hasHours = layout.activeStartHour !== null && layout.activeEndHour !== null;

        // Must have at least one scheduling property to be considered scheduled
        if (hasDateRange || hasDays || hasHours) {
            isMatching = true;

            if (hasDateRange && isMatching) {
                if (now < layout.activeStartDate! || now > layout.activeEndDate!) {
                    isMatching = false;
                }
            }

            if (hasDays && isMatching) {
                if (!layout.activeDays!.includes(currentDay)) {
                    isMatching = false;
                }
            }

            if (hasHours && isMatching) {
                const startHour = layout.activeStartHour!;
                const endHour = layout.activeEndHour!;
                if (startHour <= endHour) {
                    if (currentHour < startHour || currentHour >= endHour) isMatching = false;
                } else {
                    // Overnight
                    if (currentHour < startHour && currentHour >= endHour) isMatching = false;
                }
            }

            if (isMatching) {
                return layout.id;
            }
        }
    }

    // 2. Fallback to the global active layout
    const defaultLayout = await db.select().from(storefrontLayouts)
        .where(eq(storefrontLayouts.isGlobalActive, true))
        .limit(1);

    if (defaultLayout.length > 0) {
        return defaultLayout[0].id;
    }

    return undefined;
}

// List all widgets with pagination
export async function listWidgets(params: PaginationParams & { layoutId?: string } = {}): Promise<PaginatedWidgetsResult> {
    const { page = 1, limit = 10, layoutId } = params;
    const offset = (page - 1) * limit;

    let targetLayoutId = layoutId;
    if (!targetLayoutId) {
        targetLayoutId = await getActiveLayoutId();
    }

    if (!targetLayoutId) {
        // No layout found, return empty
        return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const dbWidgets = await db.select()
        .from(widgets)
        .where(eq(widgets.layoutId, targetLayoutId))
        .limit(limit)
        .offset(offset)
        .orderBy(widgets.order);

    const totalRes = await db.select({ count: count() }).from(widgets).where(eq(widgets.layoutId, targetLayoutId));
    const total = totalRes[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
        data: dbWidgets.map(mapDbToWidget),
        total,
        page,
        limit,
        totalPages,
    };
}

// Create a new widget
export async function createWidget(inputData: unknown): Promise<Widget> {
    const validatedData = createWidgetSchema.parse(inputData) as CreateWidgetInput;

    let layoutId = validatedData.layoutId;
    if (!layoutId) {
        layoutId = await getActiveLayoutId();
        if (!layoutId) {
            throw new Error("لا يوجد تخطيط نشط لحفظ العنصر فيه");
        }
    }

    const [newWidget] = await db.insert(widgets).values({ ...validatedData, layoutId }).returning();
    await deleteCache("home-widgets-v2");
    return mapDbToWidget(newWidget);
}

// Update an existing widget
export async function updateWidget(id: string, inputData: unknown): Promise<Widget | undefined> {
    const validatedData = updateWidgetSchema.parse(inputData) as UpdateWidgetInput;

    if (Object.keys(validatedData).length === 0) {
        return getWidgetById(id);
    }

    const [updatedWidget] = await db.update(widgets).set({
        ...validatedData,
        updatedAt: new Date(),
    }).where(eq(widgets.id, id)).returning();

    await deleteCache("home-widgets-v2");

    return updatedWidget ? mapDbToWidget(updatedWidget) : undefined;
}

// Delete a widget
export async function deleteWidget(id: string): Promise<boolean> {
    const result = await db.delete(widgets).where(eq(widgets.id, id));
    await deleteCache("home-widgets-v2");
    return (result.rowCount ?? 0) > 0;
}

// Get a single widget by ID
export async function getWidgetById(id: string): Promise<Widget | undefined> {
    const [dbWidget] = await db.select().from(widgets).where(eq(widgets.id, id));
    return dbWidget ? mapDbToWidget(dbWidget) : undefined;
}

// Update the order of multiple widgets
// Update multiple widgets (content + order)
export async function batchUpdateWidgets(updates: Partial<Widget>[]): Promise<void> {
    await db.transaction(async (tx) => {
        await Promise.all(
            updates.map((widget) => {
                const { id, ...data } = widget;
                if (!id) return Promise.resolve();

                // Prepare update object
                const updateData: any = {
                    updatedAt: new Date()
                };

                if (data.order !== undefined) updateData.order = data.order;
                if (data.isActive !== undefined) updateData.isActive = data.isActive;
                if (data.data) updateData.data = data.data;
                if (data.style) updateData.style = data.style;
                if (data.targeting !== undefined) updateData.targeting = data.targeting;

                return tx.update(widgets)
                    .set(updateData)
                    .where(eq(widgets.id, id));
            })
        );
    });
    await deleteCache("home-widgets-v2");
}

// ─── LAYOUT MANAGEMENT ──────────────────────────────────────────

export async function listLayouts() {
    return await db.select().from(storefrontLayouts).orderBy(storefrontLayouts.createdAt);
}

export async function getLayoutById(id: string) {
    const res = await db.select().from(storefrontLayouts).where(eq(storefrontLayouts.id, id)).limit(1);
    return res[0];
}

export async function createLayout(data: any) {
    if (data.isGlobalActive) {
        // Unset any existing global active
        await db.update(storefrontLayouts).set({ isGlobalActive: false });
    }

    // Convert activeStartDate / activeEndDate if strings
    const activeStartDate = data.activeStartDate ? new Date(data.activeStartDate) : null;
    const activeEndDate = data.activeEndDate ? new Date(data.activeEndDate) : null;

    const [newLayout] = await db.insert(storefrontLayouts).values({
        name: data.name,
        isGlobalActive: data.isGlobalActive || false,
        activeStartDate,
        activeEndDate,
        activeDays: data.activeDays ?? null,
        activeStartHour: data.activeStartHour ?? null,
        activeEndHour: data.activeEndHour ?? null,
    }).returning();

    if (newLayout.isGlobalActive) await deleteCache("home-widgets-v2");
    return newLayout;
}

export async function updateLayout(id: string, data: any) {
    if (data.isGlobalActive) {
        // Unset any existing global active
        await db.update(storefrontLayouts).set({ isGlobalActive: false }).where(eq(storefrontLayouts.isGlobalActive, true));
    }

    const updatePayload: any = { updatedAt: new Date() };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.isGlobalActive !== undefined) updatePayload.isGlobalActive = data.isGlobalActive;
    if (data.activeStartDate !== undefined) updatePayload.activeStartDate = data.activeStartDate ? new Date(data.activeStartDate) : null;
    if (data.activeEndDate !== undefined) updatePayload.activeEndDate = data.activeEndDate ? new Date(data.activeEndDate) : null;
    if (data.activeDays !== undefined) updatePayload.activeDays = data.activeDays;
    if (data.activeStartHour !== undefined) updatePayload.activeStartHour = data.activeStartHour;
    if (data.activeEndHour !== undefined) updatePayload.activeEndHour = data.activeEndHour;

    const [updated] = await db.update(storefrontLayouts).set(updatePayload).where(eq(storefrontLayouts.id, id)).returning();

    await deleteCache("home-widgets-v2");
    return updated;
}

export async function deleteLayout(id: string) {
    // Only allow deletion if it's not the LAST global layout
    const layout = await getLayoutById(id);
    if (layout?.isGlobalActive) {
        const all = await listLayouts();
        if (all.length <= 1) {
            throw new Error("لا يمكن حذف التخطيط الأساسي الوحيد.");
        }
        // Make another layout global
        const another = all.find(l => l.id !== id);
        if (another) {
            await db.update(storefrontLayouts).set({ isGlobalActive: true }).where(eq(storefrontLayouts.id, another.id));
        }
    }
    await db.delete(storefrontLayouts).where(eq(storefrontLayouts.id, id));
    await deleteCache("home-widgets-v2");
    return true;
}

export async function duplicateLayout(id: string, newName: string) {
    const layoutToCopy = await getLayoutById(id);
    if (!layoutToCopy) throw new Error("التخطيط غير موجود");

    // Create the new layout
    const [newLayout] = await db.insert(storefrontLayouts).values({
        name: newName,
        isGlobalActive: false, // duplications shouldn't immediately take over
        activeStartDate: layoutToCopy.activeStartDate,
        activeEndDate: layoutToCopy.activeEndDate,
        activeDays: layoutToCopy.activeDays,
        activeStartHour: layoutToCopy.activeStartHour,
        activeEndHour: layoutToCopy.activeEndHour,
    }).returning();

    // Fetch widgets using drizzle native directly
    const dbWidgets = await db.select().from(widgets).where(eq(widgets.layoutId, id));

    // Duplicate widgets to the new Layout
    if (dbWidgets.length > 0) {
        const insertPayloads = dbWidgets.map(w => ({
            layoutId: newLayout.id,
            type: w.type,
            data: w.data,
            order: w.order,
            isActive: w.isActive,
            style: w.style,
            targeting: w.targeting,
        }));
        await db.insert(widgets).values(insertPayloads);
    }

    return newLayout;
}
