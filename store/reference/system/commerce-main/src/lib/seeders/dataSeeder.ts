import { BaseSeeder } from "./baseSeeder";

/**
 * DataSeeder service to manage and run all seeders
 */
export class DataSeeder {
  private seeders: BaseSeeder[] = [];
  private seederMap: Map<string, BaseSeeder> = new Map();
  private hasInitialized = false;

  /**
   * Register a seeder with the service
   * @param seeder The seeder to register
   */
  register(seeder: BaseSeeder): void {
    if (this.seederMap.has(seeder.name)) {
      console.warn(`Seeder with name '${seeder.name}' already registered, skipping.`);
      return;
    }

    this.seeders.push(seeder);
    this.seederMap.set(seeder.name, seeder);
  }

  /**
   * Register multiple seeders at once
   * @param seeders Array of seeders to register
   */
  registerMany(seeders: BaseSeeder[]): void {
    seeders.forEach(seeder => this.register(seeder));
  }

  /**
   * Run a specific seeder by name
   * @param name Name of the seeder to run
   */
  async runSeeder(name: string): Promise<void> {
    const seeder = this.seederMap.get(name);
    
    if (!seeder) {
      throw new Error(`No seeder registered with name '${name}'`);
    }

    try {
      const dataExists = await seeder.checkIfDataExists();
      
      if (dataExists) {
        console.log(`Data for seeder '${seeder.name}' already exists, skipping.`);
        return;
      }
      
      console.log(`Running seeder: ${seeder.name}`);
      await seeder.seed();
      console.log(`Completed seeder: ${seeder.name}`);
    } catch (error) {
      console.error(`Error running seeder '${seeder.name}':`, error);
      throw error;
    }
  }

  /**
   * Run all registered seeders in priority order
   */
  async runAll(): Promise<void> {
    // Sort seeders by priority (lowest first)
    const sortedSeeders = [...this.seeders].sort((a, b) => a.priority - b.priority);
    
    for (const seeder of sortedSeeders) {
      await this.runSeeder(seeder.name);
    }
  }

  /**
   * Initialize default seeders
   * This is called automatically when needed, but can be called manually
   * to eagerly initialize seeders
   */
  async initialize(): Promise<void> {
    if (this.hasInitialized) return;
    
    // Import all seeders here
    const { PaymentMethodSeeder } = await import('./paymentMethodSeeder');
    const { SystemCategoriesSeeder } = await import('./systemCategoriesSeeder');
    const { RfmConfigSeeder } = await import('./rfmConfigSeeder');

    // Register all default seeders
    this.registerMany([
      new PaymentMethodSeeder(),
      new SystemCategoriesSeeder(),
      new RfmConfigSeeder(),
    ]);
    
    this.hasInitialized = true;
  }

  /**
   * Run all necessary seeders on application startup
   */
  async seedOnStartup(): Promise<void> {
    await this.initialize();
    await this.runAll();
  }
}

// Create a singleton instance
export const dataSeeder = new DataSeeder();