import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answer} from '../src/engine.ts';
import type {Item} from '../src/catalog.ts';
const rows:Item[]=[{id:1,schoolId:1,shopId:1,shopName:'演示铺',name:'玉米猪肉蒸饺',area:'中苑',priceCents:1800,unit:'item',ingredients:['猪肉','玉米']}];
test('grammar combines intent, ingredient, area and price without model calls',()=>{
 for(const q of ['中苑推荐一个猪肉','我很想吃猪肉','猪肉哪里能吃？','推荐中苑20元以内的猪肉','我要吃玉米猪肉蒸饺啊'])assert.equal(answer(rows,1,q).status,'RESULTS',q);
 assert.equal(answer(rows,1,'中苑推荐低于18元的猪肉').status,'NO_RESULT');
 assert.equal(answer(rows,1,'中苑推荐18元以上的猪肉').status,'RESULTS');
 assert.equal(answer(rows,1,'只要菜名逐字叫“猪肉”').status,'HELP');
 assert.equal(answer(rows,2,'我要吃猪肉').status,'HELP');
});
test('unknown facts, modifiers and negation cannot become ingredient matches',()=>{
 for(const q of ['不要猪肉','我要吃奇怪的猪肉','我想吃猪肉，不要花生','«I0»'])assert.equal(answer(rows,1,q).status,'HELP',q);
 const unlabelled=rows.map(({ingredients,...r})=>r);
 assert.equal(answer(unlabelled,1,'推荐猪肉').status,'HELP');
 assert.equal(answer(rows.map(r=>({...r,priceCents:null})),1,'推荐20元以内的猪肉').status,'NO_RESULT');
 assert.equal(answer(rows.map(r=>({...r,area:null})),1,'推荐中苑的猪肉').status,'HELP');
});
