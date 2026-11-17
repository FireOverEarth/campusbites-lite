// Local price conversion; callers must validate complete query syntax first.
const number='(?:[0-9]{1,9}(?:\\.[0-9]{1,2})?|[零〇一二两三四五六七八九十百千万]+(?:点[零〇一二三四五六七八九]{1,2})?)';
export function moneyCents(text:string):number{
 if(/^\d/.test(text))return Math.round(Number(text)*100);
 const digits='零一二三四五六七八九';
 const digit=(s:string)=>s==='两'?2:s==='〇'?0:digits.indexOf(s);
 const [integer,fraction='']=text.split('点');let total=0,section=0,n=0;
 for(const c of integer){if('十百千万'.includes(c)){const unit=({十:10,百:100,千:1000,万:10000} as Record<string,number>)[c];if(unit===10000){total+=(section+n)*unit;section=0;}else section+=(n||1)*unit;n=0;}else n=digit(c);}
 return (total+section+n)*100+Number([...fraction].map(digit).join('').padEnd(2,'0'));
}
export function priceAmounts(text:string):number[]{return [...text.matchAll(new RegExp('('+number+')\\s*(?:元|块)','gu'))].map(m=>moneyCents(m[1]));}
export function extractPriceBounds(text:string){
 let min:number|null=null,max:number|null=null;
 const lower=(v:number)=>{min=min===null?v:Math.max(min,v);};
 const upper=(v:number)=>{max=max===null?v:Math.min(max,v);};
 let rest=text.replace(new RegExp('(?<![\\d.负−+\\-])('+number+')\\s*(?:元|块)?\\s*(?:到|至|~|～)\\s*('+number+')\\s*(?:元|块)(?:之间|以内|的)?','gu'),(_,a:string,b:string)=>{lower(moneyCents(a));upper(moneyCents(b));return ' ';});
 rest=rest.replace(new RegExp('(?<![\\d.负−+\\-])('+number+')\\s*(?:元|块)(以上|以下|以内|起)(?:的)?','gu'),(_,n:string,op:string)=>{(op==='以上'||op==='起'?lower:upper)(moneyCents(n));return ' ';});
 rest=rest.replace(new RegExp('(不超过|别超过|最多|至少|起码|不少于|不低于|超过|高于|大于|低于|少于|不到)\\s*('+number+')\\s*(?:元|块)(?:的)?','gu'),(_,op:string,n:string)=>{const v=moneyCents(n);if(/^(至少|起码|不少于|不低于)$/.test(op))lower(v);else if(/^(超过|高于|大于)$/.test(op))lower(v+1);else upper(v-(/^(低于|少于|不到)$/.test(op)?1:0));return ' ';});
 return {rest,min,max};
}
