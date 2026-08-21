-- Realistic legacy fixture exercising the importer's edge cases.
INSERT INTO cities (id, name, code, delivery_fee, is_active) VALUES
 ('c-tripoli','طرابلس','TIP',15.00,true),
 ('c-benghazi','بنغازي','BEN',25.00,true),
 ('c-misrata','مصراتة','MIS',20.00,false);

INSERT INTO regions (id, name, city_id, delivery_fee, estimated_delivery_days, is_active) VALUES
 ('r-hay','حي الأندلس','c-tripoli',5.00,2,true),
 ('r-gargaresh','قرقارش','c-tripoli',0.00,2,true),
 ('r-sabri','الصابري','c-benghazi',8.00,3,true);

-- Users: mixed roles, synthetic emails, one with NO phone (must be skipped).
INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at,phone_number,phone_number_verified,role,banned) VALUES
 ('u-owner','زكريا','user0911111111@my-site.com',false,now(),now(),'0911111111',true,'owner',false),
 ('u-admin','مدير','user0922222222@my-site.com',false,now(),now(),'0922222222',true,'admin',false),
 ('u-support','دعم','real.support@example.ly',true,now(),now(),'0933333333',true,'support',false),
 ('u-cust1','عميل أول','user0944444444@my-site.com',false,now(),now(),'0944444444',true,'user',false),
 ('u-cust2','عميل ثاني','user0955555555@my-site.com',false,now(),now(),'0955555555',false,'affiliate',true),
 ('u-nophone','بدون هاتف','orphan@my-site.com',false,now(),now(),NULL,false,'user',false),
 ('u-weird','دور غريب','user0966666666@my-site.com',false,now(),now(),'0966666666',true,'grand_wizard',false);

INSERT INTO user_addresses (id,user_id,region_id,address,is_default) VALUES
 (gen_random_uuid(),'u-cust1','r-hay','شارع النصر، بناية 12',true),
 (gen_random_uuid(),'u-cust2','r-sabri','شارع دبي',true);

INSERT INTO collections (id,name,slug,description,is_active) VALUES
 (gen_random_uuid(),'عروض الصيف','summer-sale','تخفيضات الصيف',true);

INSERT INTO products (id,name,slug,description,price,compare_at_price,sku,is_active,has_variants,track_quantity,stock,reserved_stock,weight) VALUES
 ('11111111-1111-1111-1111-111111111111','عطر الياسمين','jasmine-perfume','عطر شرقي فاخر',120.00,150.00,'PRF-001',true,true,true,50,3,0.35),
 ('22222222-2222-2222-2222-222222222222','عطر العود','oud-perfume','عود طبيعي',300.00,NULL,'PRF-002',true,false,true,10,0,0.50),
 ('33333333-3333-3333-3333-333333333333','منتج غير نشط','inactive-product',NULL,NULL,NULL,NULL,false,false,false,0,0,NULL);

INSERT INTO variant_options (id,name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','الحجم');
INSERT INTO variant_values (id,option_id,value) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','50 مل'),
 ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','100 مل');

INSERT INTO product_variants (id,product_id,title,sku,price,inventory_quantity,reserved_stock,is_active) VALUES
 ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','الياسمين 50 مل','PRF-001-50',120.00,30,1,true),
 ('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','الياسمين 100 مل','PRF-001-100',200.00,20,2,true);

INSERT INTO product_variant_options (variant_id,option_id,value_id) VALUES
 ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001'),
 ('cccccccc-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002');

INSERT INTO product_images (id,product_id,variant_id,url,alt_text,sort_order) VALUES
 (gen_random_uuid(),'11111111-1111-1111-1111-111111111111',NULL,'/uploads/images/full/abc123.webp','عطر الياسمين',0),
 (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','/uploads/images/full/def456.webp','50 مل',1),
 (gen_random_uuid(),'22222222-2222-2222-2222-222222222222',NULL,'/uploads/images/full/ghi789.webp','عود',0);

INSERT INTO product_to_category (product_id,category_id) SELECT '11111111-1111-1111-1111-111111111111', id FROM categories LIMIT 1;
INSERT INTO product_to_collection (product_id,collection_id) SELECT '11111111-1111-1111-1111-111111111111', id FROM collections LIMIT 1;

-- Discounts: two supported, two that v1 defers (must be skipped, not lost silently).
INSERT INTO discounts (id,code,name,type,value,percentage,is_active,usage_count) VALUES
 (gen_random_uuid(),'SAVE10','خصم 10%','percentage',NULL,10.00,true,5),
 (gen_random_uuid(),'FLAT20','خصم 20 دينار','fixed',20.00,NULL,true,2),
 (gen_random_uuid(),'BOGO1','اشترِ واحصل','bogo',NULL,NULL,true,0),
 (gen_random_uuid(),'TIER1','خصم متدرج','tiered',NULL,NULL,true,0);

INSERT INTO delivery_methods (id,name,code,is_active,configuration) VALUES
 (gen_random_uuid(),'وانكس','vanex',true,'{"apiKey":"REDACTED"}');

INSERT INTO orders (id,user_id,status,subtotal,discount_total,shipping_total,total,payment_method,shipping_address,shipping_region_id,shipping_city_id,order_number,shipping_status) VALUES
 ('dddddddd-0000-0000-0000-000000000001','u-cust1','completed',320.00,20.00,5.00,305.00,'moamalat','شارع النصر','r-hay','c-tripoli','202608MOA1234','delivered'),
 ('dddddddd-0000-0000-0000-000000000002','u-cust2','pending',300.00,0.00,8.00,308.00,'manual_payment','شارع دبي','r-sabri','c-benghazi','202608MAN5678','pending');

INSERT INTO order_items (id,order_id,product_id,variant_id,name,variant_title,quantity,price,discount_amount,line_item_total) VALUES
 (gen_random_uuid(),'dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','عطر الياسمين','50 مل',1,120.00,0,120.00),
 (gen_random_uuid(),'dddddddd-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',NULL,'عطر العود','',1,200.00,20.00,180.00),
 (gen_random_uuid(),'dddddddd-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',NULL,'عطر العود','',1,300.00,0,300.00);

INSERT INTO payments (id,order_id,payment_method,amount,currency,status,transaction_id,payment_data) VALUES
 (gen_random_uuid(),'dddddddd-0000-0000-0000-000000000001','moamalat',305.00,'LYD','completed','MOA-TXN-99','{"SystemReference":"99"}'),
 (gen_random_uuid(),'dddddddd-0000-0000-0000-000000000002','manual_payment',308.00,'LYD','pending','','{}');
