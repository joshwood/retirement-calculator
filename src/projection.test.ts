import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectSavings } from './projection.ts';
const base = { startingBalance: 10000, monthlyContribution: 100, years: 2, annualReturn: 0 };
const near = (a: number, b: number) => assert.ok(Math.abs(a-b) <= Math.max(1,Math.abs(b))*1e-10, `${a} != ${b}`);
test('zero return and annual snapshots', () => { const rows=projectSavings(base); assert.equal(rows.length,3); assert.deepEqual(rows.at(-1),{year:2,balance:12400,invested:12400,growth:0}); });
test('zero horizon includes only the initial balance', () => assert.deepEqual(projectSavings({...base,years:0}),[{year:0,balance:10000,invested:10000,growth:0}]));
test('effective annual return compounds correctly', () => near(projectSavings({...base,monthlyContribution:0,years:1,annualReturn:10}).at(-1)!.balance,11000));
test('negative growth is preserved', () => {const last=projectSavings({...base,monthlyContribution:0,annualReturn:-20}).at(-1)!;near(last.balance,6400);near(last.growth,-3600);});
test('end-of-month contribution timing, independently calculated', () => near(projectSavings({...base,startingBalance:1000,years:1,annualReturn:12.68250301319698}).at(-1)!.balance,2395.075331451668));
test('minus 99 percent boundary', () => near(projectSavings({...base,monthlyContribution:0,years:1,annualReturn:-99}).at(-1)!.balance,100));
test('all zero amounts remain zero', () => assert.ok(projectSavings({...base,startingBalance:0,monthlyContribution:0,years:80,annualReturn:30}).every(row=>row.balance===0)));
test('upper supported bounds remain finite', () => assert.ok(projectSavings({startingBalance:1e9,monthlyContribution:1e7,years:80,annualReturn:30}).every(row=>Number.isFinite(row.balance))));
test('rejects invalid input', () => {for(const patch of [{years:1.5},{years:-1},{years:81},{annualReturn:-100},{annualReturn:31},{startingBalance:-1},{startingBalance:1e10},{monthlyContribution:-1},{monthlyContribution:1e8},{startingBalance:NaN},{annualReturn:Infinity}]) assert.throws(()=>projectSavings({...base,...patch}),RangeError);});
test('matches closed form at a long horizon', () => {const r=Math.expm1(Math.log1p(.07)/12),n=360;const expected=50000*Math.pow(1+r,n)+500*Math.expm1(n*Math.log1p(r))/r;near(projectSavings({startingBalance:50000,monthlyContribution:500,years:30,annualReturn:7}).at(-1)!.balance,expected);});

import { projectAccounts, type Account } from './projection.ts';
const account:Account={id:'a',name:'Example',type:'Taxable brokerage',balance:10000,priceGrowth:4,incomeYield:2,monthlyContribution:100};
test('separate accounts retain their own rates and totals sum at every year',()=>{
 const accounts=[account,{...account,id:'b',balance:5000,priceGrowth:-10,incomeYield:0,monthlyContribution:50}];
 const result=projectAccounts(accounts,2);
 near(result.byAccount[0].rows[1].balance,10600+100*Math.expm1(Math.log(1.06))/Math.expm1(Math.log(1.06)/12));
 const expectedB=projectSavings({startingBalance:5000,monthlyContribution:50,annualReturn:-10,years:2});
 result.rows.forEach((row,i)=>{near(result.byAccount[1].rows[i].balance,expectedB[i].balance);for(const key of ['balance','invested','growth'] as const) near(row[key],result.byAccount.reduce((sum,item)=>sum+item.rows[i][key],0));});
});
test('growth and reinvested income add once, without multiplicative double counting',()=>{
 near(projectAccounts([{...account,monthlyContribution:0}],1).rows[1].balance,10600);
 near(projectAccounts([{...account,monthlyContribution:0,priceGrowth:0,incomeYield:5}],2).rows[2].balance,11025);
 near(projectAccounts([{...account,monthlyContribution:0,priceGrowth:-10,incomeYield:2}],1).rows[1].balance,9200);
});
test('zero years and zero returns preserve combined invested amounts',()=>{
 assert.deepEqual(projectAccounts([account,{...account,id:'b',balance:2000}],0).rows,[{year:0,balance:12000,invested:12000,growth:0}]);
 const last=projectAccounts([{...account,priceGrowth:0,incomeYield:0},{...account,id:'b',balance:0,priceGrowth:0,incomeYield:0,monthlyContribution:50}],2).rows[2];
 assert.deepEqual(last,{year:2,balance:13600,invested:13600,growth:0});
});
test('account type is a label and does not change projection',()=>{
 assert.deepEqual(projectAccounts([account],3).rows,projectAccounts([{...account,type:'Roth IRA'}],3).rows);
});
test('reject invalid account fields, combined rates, duplicate IDs and collection bounds',()=>{
 for(const patch of [{name:' '},{name:'a'.repeat(61)},{id:''},{type:'Unknown'},{balance:-1},{balance:NaN},{balance:Infinity},{priceGrowth:-100},{priceGrowth:31},{incomeYield:-1},{incomeYield:31},{incomeYield:NaN},{priceGrowth:20,incomeYield:11},{monthlyContribution:-1},{monthlyContribution:1e8}]) assert.throws(()=>projectAccounts([{...account,...patch} as Account],1),RangeError);
 for(const items of [[],[account,account],Array.from({length:21},(_,i)=>({...account,id:String(i)}))]) assert.throws(()=>projectAccounts(items,1),RangeError);
 assert.throws(()=>projectAccounts([account],1.5),RangeError);
});
test('20 accounts at supported upper limits remain finite',()=>{
 const result=projectAccounts(Array.from({length:20},(_,i)=>({...account,id:String(i),balance:1e9,monthlyContribution:1e7,priceGrowth:20,incomeYield:10})),80);
 assert.ok(result.rows.every(row=>Number.isFinite(row.balance)));
});
