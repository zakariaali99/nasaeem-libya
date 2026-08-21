import MessageQueue from '../index';
import inventoryProcessor from './inventory';

/**
 * Register all queue processors
 */
export function registerProcessors() {
  // Inventory deduction jobs
  MessageQueue.processQueue('inventory', inventoryProcessor, 3);
}

// Automatically register processors on import
registerProcessors();
