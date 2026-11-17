const A=require('./core.js'),assert=require('assert');
const mk=()=>{const s=A.defState();s.cashOpen=1e6;s.banks=[{id:'b1',name:'ACB',open:2e6}];s.debts=[{id:'d1',type:'bank',name:'Visa',rate:12,extra:0},{id:'d2',type:'cash',name:'An',rate:0,extra:0}];return s};
const T=(k,o)=>({kind:k,date:'2026-11-01',...o});
let s=mk();
A.addTx(s,T('ci',{amount:1e5,src:'bal',acc:'cash',cat:'x'}));let c=A.calc(s);assert(c.cash==9e5&&c.da==0);                 // DƯ expense
A.addTx(s,T('cp',{amount:3e5,src:'debt',debt:'d1',cat:'x'}));c=A.calc(s);assert(c.cash==9e5&&c.dp==3e5);                 // NỢ expense
A.addTx(s,T('ti',{amount:5e5,acc:'b1',cat:'x'}));assert(A.calc(s).bal.b1==2.5e6);                                         // income
s.debts[0].extra=5e4;c=A.calc(s);assert(c.da==3.5e5&&c.net==c.total-c.da);                                                // actual>principal
A.addTx(s,T('repay',{amount:2e5,debt:'d1',acc:'b1'}));c=A.calc(s);assert(c.bal.b1==2.3e6&&c.dp==1e5&&c.da==1.5e5);       // repay
assert.throws(()=>A.addTx(s,T('repay',{amount:9e5,debt:'d1',acc:'b1'})));                                                  // > debt
A.addTx(s,T('lend',{id:'L1',amount:2e5,borrower:'B'}));c=A.calc(s);assert(c.cash==7e5);                                    // lend not expense/debt
A.addTx(s,T('collect',{amount:1e5,lendId:'L1',acc:'cash'}));assert(A.calc(s).cash==8e5&&A.lendLeft(s,'L1')==1e5);          // collect
A.addTx(s,T('collect',{amount:2e5,lendId:'L1',acc:'cash'}));assert(A.validate(s));s.tx.pop();                              // over-collect
A.addTx(s,T('borrow',{amount:1e6,fee:1e4,debt:'d2',acc:'cash'}));c=A.calc(s);assert(c.cash==1.8e6&&c.prin.d2==1.01e6);   // borrow+fee
const before=JSON.stringify(A.calc(s));s.fc.push({id:'f1',type:'chi',date:'2026-12-01',amount:5e5,src:'debt',debt:'d1',acc:null},{id:'f2',type:'thu',date:'2026-12-01',amount:1e6,acc:'b1'});
assert(JSON.stringify(A.calc(s))==before);                                                                                  // forecast isolated
let p=A.project(s,'2026-12-31');assert(p.net==p.total-p.da&&p.total==c.total+1e6&&p.debts[0].add==5e5);                   // forecast net
assert(A.project(s,'2026-11-20').total==c.total);                                                                           // date-aware
let d=JSON.parse(JSON.stringify(s));A.delTx(d,s.tx.find(t=>t.kind=='repay').id);assert(A.calc(d).prin.d1==3e5&&d.debts[0].extra==5e4&&!A.validate(d)); // delete repay restores
d=JSON.parse(JSON.stringify(s));A.delTx(d,'L1');assert(A.validate(d));                                                      // delete lend w/ collection blocked
d=JSON.parse(JSON.stringify(s));A.delTx(d,s.tx.find(t=>t.kind=='borrow').id);assert(!A.validate(d));
d=mk();A.addTx(d,T('ci',{amount:3e6,src:'bal',acc:'cash',cat:'x'}));assert(A.validate(d));                                  // negative balance blocked
assert(A.interest(Object.assign(mk(),{tx:[T('cp',{amount:36500,src:'debt',debt:'d1',date:'2026-01-01'})]}),'d1',10,'2026-01-01','2026-01-10')==100);
assert(A.validBackup(JSON.parse(JSON.stringify(s)))&&!A.validBackup({v:1}));
console.log('ALL OK');
