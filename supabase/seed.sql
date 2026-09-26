insert into public.shop_settings (
  id,shop_name_th,shop_name_en,phone,address_th,open_time,close_time,
  force_open,force_closed,buffet_price,child_price,dining_minutes,promptpay
) values (
  1,'ชาบูอร่อยจัง','Shabu Aroi Jang','06-1564-0529',
  '125/3 ม.5 ต.สามควายเผือก อ.เมือง จ.นครปฐม 73000',
  '11:00','22:00',false,false,299,149,120,'06-1564-0529'
)
on conflict(id) do update set
  shop_name_th=excluded.shop_name_th,shop_name_en=excluded.shop_name_en,
  phone=excluded.phone,address_th=excluded.address_th,open_time=excluded.open_time,
  close_time=excluded.close_time,buffet_price=excluded.buffet_price,
  child_price=excluded.child_price,dining_minutes=excluded.dining_minutes,promptpay=excluded.promptpay;

insert into public.restaurant_tables(code,seats,sort_order) values
('A01',2,1),('A02',2,2),('A03',4,3),('A04',4,4),('A05',4,5),
('A06',4,6),('A07',4,7),('A08',4,8),('A09',6,9),('A10',6,10),
('B01',6,11),('B02',6,12),('B03',8,13),('B04',8,14),('B05',10,15)
on conflict(code) do update set seats=excluded.seats,sort_order=excluded.sort_order;

insert into public.menu_categories(name_th,name_en,sort_order) values
('หมู','Pork',1),('เนื้อ','Beef',2),('ไก่','Chicken',3),('ซีฟู้ด','Seafood',4),
('ผัก','Vegetables',5),('เห็ด','Mushrooms',6),('เส้น','Noodles',7),('ของชาบู','Shabu Items',8),
('ของทานเล่น','Sides',9),('น้ำซุป','Soup',10),('น้ำจิ้ม','Sauce',11),
('เครื่องดื่ม','Drinks',12),('ของหวาน','Dessert',13)
on conflict(name_th) do update set name_en=excluded.name_en,sort_order=excluded.sort_order;

with data(category,name_th,name_en,emoji,sort_order) as (values
('หมู','หมูสามชั้น','Pork Belly','🥓',1),
('หมู','หมูสันคอ','Pork Collar','🥩',2),
('หมู','หมูนุ่ม','Tender Pork','🥩',3),
('หมู','หมูหมักงา','Sesame Pork','🥩',4),
('หมู','หมูพริกไทยดำ','Black Pepper Pork','🥩',5),
('หมู','เบคอน','Bacon','🥓',6),
('หมู','หมูเด้ง','Pork Balls','🍖',7),
('หมู','หมูพันเห็ดเข็มทอง','Enoki Pork Roll','🍄',8),
('หมู','ตับหมู','Pork Liver','🥩',9),
('เนื้อ','เนื้อสไลซ์','Beef Slice','🥩',10),
('เนื้อ','เนื้อใบพาย','Chuck Tender','🥩',11),
('เนื้อ','เนื้อริบอาย','Ribeye','🥩',12),
('เนื้อ','เนื้อติดมัน','Marbled Beef','🥩',13),
('เนื้อ','เนื้อหมักงา','Sesame Beef','🥩',14),
('เนื้อ','เนื้อพริกไทยดำ','Black Pepper Beef','🥩',15),
('ไก่','ไก่นุ่ม','Tender Chicken','🍗',16),
('ไก่','ไก่หมักงา','Sesame Chicken','🍗',17),
('ไก่','ไก่พริกไทยดำ','Black Pepper Chicken','🍗',18),
('ไก่','ไก่สไลซ์','Chicken Slice','🍗',19),
('ซีฟู้ด','กุ้ง','Shrimp','🦐',20),
('ซีฟู้ด','ปลาหมึก','Squid','🦑',21),
('ซีฟู้ด','ปลาดอลลี่','Dory Fish','🐟',22),
('ซีฟู้ด','หอยแมลงภู่','Mussels','🦪',23),
('ซีฟู้ด','ปูอัด','Crab Stick','🦀',24),
('ซีฟู้ด','เต้าหู้ปลา','Fish Tofu','🍢',25),
('ซีฟู้ด','หมึกกรอบ','Crispy Squid','🦑',26),
('ซีฟู้ด','แมงกะพรุน','Jellyfish','🪼',27),
('ผัก','ผักกาดขาว','Chinese Cabbage','🥬',28),
('ผัก','ผักบุ้ง','Morning Glory','🥬',29),
('ผัก','กะหล่ำปลี','Cabbage','🥬',30),
('ผัก','ขึ้นฉ่าย','Celery','🥬',31),
('ผัก','ต้นหอม','Spring Onion','🌿',32),
('ผัก','ข้าวโพด','Corn','🌽',33),
('ผัก','ข้าวโพดอ่อน','Baby Corn','🌽',34),
('ผัก','ฟักทอง','Pumpkin','🎃',35),
('ผัก','แครอท','Carrot','🥕',36),
('ผัก','หัวไชเท้า','Daikon','🥕',37),
('เห็ด','เห็ดเข็มทอง','Enoki','🍄',38),
('เห็ด','เห็ดออรินจิ','King Oyster Mushroom','🍄',39),
('เห็ด','เห็ดชิเมจิ','Shimeji','🍄',40),
('เห็ด','เห็ดหอม','Shiitake','🍄',41),
('เห็ด','เห็ดนางรม','Oyster Mushroom','🍄',42),
('เส้น','วุ้นเส้น','Glass Noodles','🍜',43),
('เส้น','บะหมี่หยก','Jade Noodles','🍜',44),
('เส้น','มาม่า','Instant Noodles','🍜',45),
('เส้น','อุด้ง','Udon','🍜',46),
('เส้น','เส้นแก้ว','Crystal Noodles','🍜',47),
('ของชาบู','ลูกชิ้นหมู','Pork Ball','🍢',48),
('ของชาบู','ลูกชิ้นเนื้อ','Beef Ball','🍢',49),
('ของชาบู','ลูกชิ้นปลา','Fish Ball','🍢',50),
('ของชาบู','ชีสบอล','Cheese Ball','🧀',51),
('ของชาบู','ฟองเต้าหู้','Bean Curd Sheet','🍢',52),
('ของชาบู','เต้าหู้ไข่','Egg Tofu','🍳',53),
('ของชาบู','เต้าหู้ขาว','White Tofu','⬜',54),
('ของชาบู','เกี๊ยวกุ้ง','Shrimp Wonton','🥟',55),
('ของชาบู','เกี๊ยวหมู','Pork Wonton','🥟',56),
('ของชาบู','ไส้กรอก','Sausage','🌭',57),
('ของชาบู','ไส้กรอกชีส','Cheese Sausage','🌭',58),
('ของทานเล่น','เฟรนช์ฟรายส์','French Fries','🍟',59),
('ของทานเล่น','นักเก็ตไก่','Chicken Nuggets','🍗',60),
('ของทานเล่น','ไก่ทอด','Fried Chicken','🍗',61),
('ของทานเล่น','เกี๊ยวทอด','Fried Wonton','🥟',62),
('ของทานเล่น','ปอเปี๊ยะทอด','Spring Rolls','🥠',63),
('ของทานเล่น','ข้าวผัดกระเทียม','Garlic Rice','🍚',64),
('ของทานเล่น','ข้าวสวย','Steamed Rice','🍚',65),
('น้ำซุป','น้ำดำญี่ปุ่น','Japanese Black Soup','🍲',66),
('น้ำซุป','น้ำใส','Clear Soup','🍲',67),
('น้ำซุป','ต้มยำ','Tom Yum','🌶️',68),
('น้ำซุป','หม่าล่า','Mala','🔥',69),
('น้ำซุป','สุกี้ยากี้','Sukiyaki','🍲',70),
('น้ำจิ้ม','น้ำจิ้มสุกี้','Suki Sauce','🥣',71),
('น้ำจิ้ม','น้ำจิ้มซีฟู้ด','Seafood Sauce','🌶️',72),
('น้ำจิ้ม','น้ำจิ้มงา','Sesame Sauce','🥣',73),
('น้ำจิ้ม','พอนสึ','Ponzu','🥣',74),
('น้ำจิ้ม','น้ำจิ้มหม่าล่า','Mala Sauce','🔥',75),
('เครื่องดื่ม','น้ำเปล่า','Water','💧',76),
('เครื่องดื่ม','โค้ก','Coke','🥤',77),
('เครื่องดื่ม','โค้กซีโร่','Coke Zero','🥤',78),
('เครื่องดื่ม','สไปรท์','Sprite','🥤',79),
('เครื่องดื่ม','แฟนต้า','Fanta','🥤',80),
('เครื่องดื่ม','ชาเขียว','Green Tea','🍵',81),
('เครื่องดื่ม','ชามะนาว','Lemon Tea','🍋',82),
('เครื่องดื่ม','น้ำเก๊กฮวย','Chrysanthemum Tea','🌼',83),
('ของหวาน','ไอศกรีมวานิลลา','Vanilla Ice Cream','🍨',84),
('ของหวาน','ไอศกรีมช็อกโกแลต','Chocolate Ice Cream','🍨',85),
('ของหวาน','ไอศกรีมสตรอว์เบอร์รี','Strawberry Ice Cream','🍓',86),
('ของหวาน','ไอศกรีมชาเขียว','Matcha Ice Cream','🍵',87),
('ของหวาน','เฉาก๊วย','Grass Jelly','🍮',88),
('ของหวาน','วุ้น','Jelly','🍮',89),
('ของหวาน','ผลไม้ตามฤดูกาล','Seasonal Fruit','🍉',90)
)
insert into public.menu_items(category_id,name_th,name_en,emoji,sort_order)
select c.id,d.name_th,d.name_en,d.emoji,d.sort_order
from data d
join public.menu_categories c on c.name_th=d.category
where not exists(select 1 from public.menu_items m where m.name_th=d.name_th);
