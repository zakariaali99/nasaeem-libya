/**
 * Role-Based Access Control (RBAC) Definitions
 * 
 * This file defines the comprehensive list of roles for the E-commerce platform
 * and provides utility functions for checking permissions.
 */

export const ROLES = {
    // Super Users
    OWNER: "owner",
    ADMIN: "admin",
    MANAGER: "manager", // Store Manager

    // Finance & Analytics
    ACCOUNTANT: "accountant", // Financial Controller
    DATA_ANALYST: "data_analyst",

    // Advanced Product Management
    SEO_SPECIALIST: "seo_specialist",
    INVENTORY_PLANNER: "inventory_planner",
    VISUAL_MERCHANDISER: "visual_merchandiser",

    // Technical
    DEVELOPER: "developer",

    // Marketplace
    VENDOR: "vendor",
    AFFILIATE: "affiliate",

    // Customer Service
    SUPPORT: "support", // Tier 1
    DISPUTE_MANAGER: "dispute_manager", // Risk/Fraud

    // Integration/Operational (Legacy/Generic)
    EDITOR: "editor",
    FULFILLMENT: "fulfillment",
    USER: "user",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Hierarchy definition for simple inequality checks
// Higher number = more qualified
const ROLE_HIERARCHY: Record<Role, number> = {
    [ROLES.OWNER]: 100,
    [ROLES.ADMIN]: 90,
    [ROLES.MANAGER]: 80,
    [ROLES.DEVELOPER]: 75, // Technical access

    [ROLES.DISPUTE_MANAGER]: 60,
    [ROLES.ACCOUNTANT]: 50,
    [ROLES.VISUAL_MERCHANDISER]: 45,
    [ROLES.SEO_SPECIALIST]: 45,
    [ROLES.INVENTORY_PLANNER]: 45,
    [ROLES.EDITOR]: 40,

    [ROLES.FULFILLMENT]: 35,
    [ROLES.SUPPORT]: 30,
    [ROLES.DATA_ANALYST]: 25, // Read-only mostly

    [ROLES.VENDOR]: 20,
    [ROLES.AFFILIATE]: 10,
    [ROLES.USER]: 0,
};

/**
 * Checks if a user has the required permission level based on their role.
 */
export function hasPermission(userRole: string, requiredRole: Role): boolean {
    const userLevel = ROLE_HIERARCHY[userRole as Role] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

    return userLevel >= requiredLevel;
}

/**
 * Helper to get a human-readable label for a role
 */
export function getRoleLabel(role: string): string {
    switch (role) {
        case ROLES.OWNER: return "المالك";
        case ROLES.ADMIN: return "مدير النظام";
        case ROLES.MANAGER: return "مدير المتجر";

        case ROLES.ACCOUNTANT: return "محاسب / مراقب مالي";
        case ROLES.DATA_ANALYST: return "محلل بيانات";

        case ROLES.SEO_SPECIALIST: return "خبير سيو";
        case ROLES.INVENTORY_PLANNER: return "مخطط المخزون";
        case ROLES.VISUAL_MERCHANDISER: return "منسق بصري";

        case ROLES.DEVELOPER: return "مطور";

        case ROLES.VENDOR: return "بائع";
        case ROLES.AFFILIATE: return "مسوق بالعمولة";

        case ROLES.SUPPORT: return "دعم فني";
        case ROLES.DISPUTE_MANAGER: return "مدير نزاعات";

        case ROLES.EDITOR: return "محرر";
        case ROLES.FULFILLMENT: return "مسؤول الشحن";
        case ROLES.USER: return "مستخدم";
        default: return role;
    }
}

/**
 * Pre-defined Permission Groups for easier controller protection
 */
export const PERMISSIONS = {
    // Products
    MANAGE_PRODUCTS: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER], // Create/Delete
    EDIT_PRODUCTS_RESTRICTED: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.SEO_SPECIALIST, ROLES.VISUAL_MERCHANDISER, ROLES.INVENTORY_PLANNER], // Update with logic
    VIEW_PRODUCTS_INTERNAL: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.SEO_SPECIALIST, ROLES.INVENTORY_PLANNER, ROLES.VISUAL_MERCHANDISER, ROLES.SUPPORT, ROLES.FULFILLMENT, ROLES.VENDOR], // Drafts etc

    // Stock/Inventory
    MANAGE_INVENTORY: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.INVENTORY_PLANNER, ROLES.FULFILLMENT],

    // Design/Content (Categories, Collections, Images)
    MANAGE_CONTENT: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.VISUAL_MERCHANDISER],

    // SEO
    MANAGE_SEO: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.SEO_SPECIALIST],

    // Orders
    VIEW_ORDERS: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT, ROLES.DISPUTE_MANAGER, ROLES.FULFILLMENT, ROLES.ACCOUNTANT],
    MANAGE_ORDERS: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.DISPUTE_MANAGER, ROLES.FULFILLMENT], // Update status

    // Finance (Payments, Invoices)
    VIEW_FINANCE: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.DISPUTE_MANAGER],
    MANAGE_FINANCE: [ROLES.OWNER, ROLES.ADMIN, ROLES.ACCOUNTANT], // Payouts etc

    // Technical/Integrations (API Keys, etc)
    MANAGE_INTEGRATIONS: [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER],
} as const;
