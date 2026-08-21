/**
 * Base interface that all data seeders must implement
 */
export interface BaseSeeder {
  /**
   * Unique name for the seeder
   */
  name: string;
  
  /**
   * Check if the data already exists in the database
   * @returns Promise<boolean> - True if data exists, false otherwise
   */
  checkIfDataExists(): Promise<boolean>;
  
  /**
   * Seed the data into the database
   * @returns Promise<void>
   */
  seed(): Promise<void>;
  
  /**
   * Priority order for this seeder (lower numbers run first)
   * Useful when seeders depend on each other
   */
  priority: number;
}