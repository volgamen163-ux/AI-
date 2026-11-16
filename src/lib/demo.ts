import type { Workspace } from "./types";
export const DEMO:Workspace = {
 companies:[
 {id:"demo-a",inn:"ДЕМО-А",name:"ООО «Маяк» (учебная)",region:"Самара",activity:"Полиграфия",director:"Иванов П. И.",legal_address:"Учебная улица, 14, Самара",email:"contact@example.test",verification_status:"unverified",source_provider:"demo"},
 {id:"demo-b",inn:"ДЕМО-Б",name:"ООО «Сфера» (учебная)",region:"Самара",activity:"Канцелярские товары",director:"Иванов П. И.",legal_address:"Учебная улица, 14, Самара",verification_status:"unverified",source_provider:"demo"},
 {id:"demo-c",inn:"ДЕМО-В",name:"АО «Вектор» (учебная)",region:"Тольятти",activity:"Промышленное оборудование",director:"Петров Н. Н.",verification_status:"unverified",source_provider:"demo"}
 ],
 products:[
 {id:"dp1",company_id:"demo-a",name:"Бланк А4, 120 г/м²",category:"Полиграфия",unit:"1000 шт.",availability:"on_request"},
 {id:"dp2",company_id:"demo-b",name:"Ежедневник А5, 2027",category:"Канцелярия",unit:"шт.",availability:"in_stock",stock_qty:45},
 {id:"dp3",company_id:"demo-c",name:"Кабель промышленный",category:"Электротехника",unit:"м",availability:"unknown"}
 ],
 procurements:[
 {id:"dproc1",company_id:"demo-a",procedure_number:"DEMO-44-001",customer:"Учебный заказчик №1",event_type:"participation",law:"44-FZ",amount:85000,occurred_at:"2026-10-12",is_demo:true,verification_status:"unverified",source_provider:"demo"},
 {id:"dproc2",company_id:"demo-a",procedure_number:"DEMO-44-001",customer:"Учебный заказчик №1",event_type:"contract",law:"44-FZ",amount:81000,occurred_at:"2026-10-28",is_demo:true,verification_status:"unverified",source_provider:"demo"}
 ],
 courts:[
 {id:"dc1",company_id:"demo-b",case_number:"DEMO-А00-001",court_name:"Учебный арбитражный суд",role:"plaintiff",stage:"Рассматривается",claim_amount:25000,filed_at:"2026-09-03",is_demo:true,verification_status:"unverified",source_provider:"demo"}
 ],
 offers:[
 {id:"do1",product_id:"dp1",seller_name:"Учебное предложение №1",unit_price:2100,currency:"RUB",stock_status:"on_request",observed_at:"2026-11-01",verification_status:"unverified"},
 {id:"do2",product_id:"dp1",seller_name:"Учебное предложение №2",unit_price:1750,currency:"RUB",stock_status:"in_stock",observed_at:"2026-11-03",verification_status:"unverified"},
 {id:"do3",product_id:"dp1",seller_name:"Учебное предложение №3",unit_price:2400,currency:"RUB",stock_status:"unknown",observed_at:"2026-11-04",verification_status:"unverified"},
 {id:"do4",product_id:"dp2",seller_name:"Учебное предложение №4",unit_price:390,currency:"RUB",stock_status:"in_stock",observed_at:"2026-11-04",verification_status:"unverified"}
 ],
 relations:[]
};
