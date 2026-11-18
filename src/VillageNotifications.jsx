import {useState} from 'react';
const KEY='santa-village-notifications';
export function useVillageNotifications(){
 const [preferences,setPreferences]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem(KEY));return {hidden:saved?.hidden===true,dismissed:Array.isArray(saved?.dismissed)?saved.dismissed.filter(v=>typeof v==='string'):[]};}catch{return {hidden:false,dismissed:[]};}});
 function update(next){setPreferences(previous=>{const value=next(previous);try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}return value;});}
 const hasHidden=preferences.hidden||preferences.dismissed.length>0;
 return {hidden:preferences.hidden,hasHidden,visible:id=>!preferences.hidden&&!preferences.dismissed.includes(id),dismiss:id=>update(p=>({...p,dismissed:[...new Set([...p.dismissed,id])]})),toggle:()=>update(()=>({hidden:!hasHidden,dismissed:[]}))};
}
