import { Widget, WidgetTargeting, TargetingRule, UserTargetingContext } from '../types/customizationTypes';

/**
 * Filters widgets by targeting rules based on the current user's context.
 *
 * Rules logic:
 * - Widgets without targeting (or targeting.enabled=false) → always visible
 * - Rules are grouped by type, each type evaluates to pass/fail
 * - Different rule types are combined with OR logic (any type match = pass)
 * - Multiple rules of the SAME type are combined with AND logic
 *
 * Example: auth_status=guest OR segment in [gold] → shows to guests AND gold users
 */
export function filterWidgetsBySegment(
    widgets: Widget[],
    context: UserTargetingContext,
): Widget[] {
    return widgets.filter((widget) => evaluateTargeting(widget.targeting, context));
}

function evaluateTargeting(
    targeting: WidgetTargeting | undefined,
    context: UserTargetingContext,
): boolean {
    // No targeting or disabled → everyone sees it
    if (!targeting || !targeting.enabled || targeting.rules.length === 0) {
        return true;
    }

    // Group rules by type
    const rulesByType = new Map<string, TargetingRule[]>();
    for (const rule of targeting.rules) {
        const existing = rulesByType.get(rule.type) || [];
        existing.push(rule);
        rulesByType.set(rule.type, existing);
    }

    // OR across types: at least one rule type must pass
    for (const [type, rules] of rulesByType) {
        if (evaluateRuleGroup(type, rules, context)) {
            return true;
        }
    }

    return false;
}

function evaluateRuleGroup(
    type: string,
    rules: TargetingRule[],
    context: UserTargetingContext,
): boolean {
    // AND within the same type: all rules of this type must pass
    return rules.every((rule) => evaluateRule(rule, context));
}

function evaluateRule(rule: TargetingRule, context: UserTargetingContext): boolean {
    switch (rule.type) {
        case 'auth_status': {
            if (rule.value === 'guest') return context.isGuest;
            if (rule.value === 'authenticated') return !context.isGuest;
            return false;
        }

        case 'segment': {
            // Guests have no segment — segment rules always fail for guests
            if (context.isGuest || context.segment === null) {
                return false;
            }

            if (rule.operator === 'in') {
                return rule.value.includes(context.segment);
            }
            if (rule.operator === 'not_in') {
                return !rule.value.includes(context.segment);
            }
            return false;
        }

        case 'time_range': {
            const now = new Date();
            // Use Libya timezone (UTC+2)
            const libyaOffset = 2 * 60; // minutes
            const libyaTime = new Date(now.getTime() + (libyaOffset + now.getTimezoneOffset()) * 60000);
            const currentDay = libyaTime.getDay(); // 0=Sunday
            const currentHour = libyaTime.getHours();

            const { days, startHour, endHour, startDate, endDate } = rule.value;

            // Date range check (optional)
            if (startDate || endDate) {
                const todayStr = libyaTime.toISOString().split('T')[0];
                if (startDate && todayStr < startDate) return false;
                if (endDate && todayStr > endDate) return false;
            }

            // Day-of-week check (optional)
            if (days && days.length > 0) {
                if (!days.includes(currentDay)) return false;
            }

            // Hour range check (optional)
            if (startHour !== undefined && endHour !== undefined) {
                if (startHour <= endHour) {
                    // Normal range: e.g. 9-17
                    if (currentHour < startHour || currentHour >= endHour) return false;
                } else {
                    // Overnight range: e.g. 22-6
                    if (currentHour < startHour && currentHour >= endHour) return false;
                }
            }

            return true;
        }

        case 'region': {
            // If we don't know the user's region, region rules fail
            if (!context.region) return false;

            if (rule.operator === 'in') {
                return rule.value.includes(context.region);
            }
            if (rule.operator === 'not_in') {
                return !rule.value.includes(context.region);
            }
            return false;
        }

        default:
            // Unknown rule type — fail open (don't block unknown future rules)
            return true;
    }
}
