import {readFileSync} from 'node:fs';
import {grammar} from 'ohm-js';
import {extractPriceBounds} from './money.ts';
import type {Item} from './catalog.ts';
export type Frame={schoolId:number;target:string;ingredient?:string;location:string|null;minPriceCents:number|null;maxPriceCents:number|null;mode:'CONCEPT'|'EXACT'};
export const cleanQuery=(text:string)=>text.normalize('NFC').trim();
export const frameKey=(frame:Frame)=>JSON.stringify(frame);
type Entity={text:string;food:boolean;ingredient:boolean;place:boolean};
type Trie={children:Map<string,Trie>;entity?:Entity};
type Part={kind:string;text:string};
const compiled=grammar(readFileSync(new URL('./queries.ohm',import.meta.url),'utf8'));
const semantics=compiled.createSemantics().addOperation<Part[]>('parts',{
 _nonterminal(...children){return ['Food','Ingredient','Place','Price'].includes(this.ctorName)?[{kind:this.ctorName,text:this.sourceString}]:children.flatMap(c=>c.parts());},
 _iter(...children){return children.flatMap(c=>c.parts());},_terminal(){return [];}
});
/** Construct once per catalog/school. Only declared source entities enter the trie. */
export class FastParser{
 private root:Trie={children:new Map()};
 private names=new Set<string>();
 constructor(rows:Item[],readonly schoolId:number){
  for(const row of rows.filter(r=>r.schoolId===schoolId)){
   this.add(row.name).food=true;this.names.add(row.name);
   if(row.area)this.add(row.area).place=true;
   for(const ingredient of row.ingredients??[])this.add(ingredient).ingredient=true;
  }
 }
 private add(text:string){let node=this.root;for(const char of text){let child=node.children.get(char);if(!child){child={children:new Map()};node.children.set(char,child);}node=child;}return node.entity??={text,food:false,ingredient:false,place:false};}
 parse(text:string):Frame|null{
  const query=cleanQuery(text);if(!query||query.length>500||/[«»]/u.test(query))return null;
  const base:Frame={schoolId:this.schoolId,target:'',location:null,minPriceCents:null,maxPriceCents:null,mode:'CONCEPT'};
  const exact=query.match(/^只要菜名(?:逐字)?(?:叫|是)[“「"]?(.+?)[”」"]?$/u);
  if(exact)return this.names.has(exact[1]!)?{...base,target:exact[1]!,mode:'EXACT'}:null;
  const chars=[...query],entities:Entity[]=[];let tokenized='';
  for(let i=0;i<chars.length;){let node=this.root,end=i,found:Entity|undefined;
   for(let j=i;j<chars.length;j++){const next=node.children.get(chars[j]!);if(!next)break;node=next;if(node.entity){found=node.entity;end=j+1;}}
   if(!found){tokenized+=chars[i++];continue;}
   // A conflicting location/name is ambiguous; do not discard either meaning.
   if(found.place&&(found.food||found.ingredient))return null;
   tokenized+=`«${found.ingredient?'I':found.food?'F':'P'}${entities.length}»`;entities.push(found);i=end;
  }
  const match=compiled.match(tokenized);if(match.failed())return null;
  const parts:Part[]=semantics(match).parts();const names=parts.filter(x=>x.kind==='Food'||x.kind==='Ingredient');if(names.length!==1)return null;
  for(const part of parts){
   if(part.kind==='Price'){const price=extractPriceBounds(part.text.replace(/^预算/u,''));if(price.rest.trim())return null;if(price.min!==null)base.minPriceCents=Math.max(base.minPriceCents??0,price.min);if(price.max!==null)base.maxPriceCents=Math.min(base.maxPriceCents??Infinity,price.max);continue;}
   const entity=entities[Number(part.text.slice(2,-1))]!;
   if(part.kind==='Food')base.target=entity.text;
   if(part.kind==='Ingredient')base.ingredient=entity.text;
   if(part.kind==='Place'){if(base.location&&base.location!==entity.text)return null;base.location=entity.text;}
  }
  return (base.minPriceCents??0)>(base.maxPriceCents??Infinity)?null:base;
 }
}
