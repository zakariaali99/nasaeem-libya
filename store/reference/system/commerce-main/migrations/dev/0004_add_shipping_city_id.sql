-- Add shipping_city_id column to orders table
ALTER TABLE "orders" ADD COLUMN "shipping_city_id" varchar;

-- Add foreign key constraint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_city_id_cities_id_fk" FOREIGN KEY ("shipping_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;

-- Create index for the new column
CREATE INDEX "idx_orders_shipping_city_id" ON "orders" USING btree ("shipping_city_id");
