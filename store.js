import {config} from './config.js';
export const live=Boolean(config.supabaseUrl && config.supabaseAnonKey);
let token=JSON.parse(sessionStorage.getItem('momentum-auth')||'null');
export function logout(){token=null;sessionStorage.removeItem('momentum-auth');}
async function request(path,options={},auth=true){
 if(auth && token && token.expires_at<Date.now()+30000){const t=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:token.refresh_token})},false);saveToken(t);}
 const res=await fetch(config.supabaseUrl+path,{...options,headers:{apikey:config.supabaseAnonKey,'Content-Type':'application/json',...(auth&&token?{Authorization:`Bearer ${token.access_token}`} : {}),...options.headers}});
 const data=await res.text();if(!res.ok)throw Error((()=>{try {const e=JSON.parse(data);return e.message||e.msg||e.error_description||data;}catch{return data;}})());return data?JSON.parse(data):null;
}
function saveToken(t){token={...t,expires_at:Date.now()+t.expires_in*1000};sessionStorage.setItem('momentum-auth',JSON.stringify(token));}
export async function login(email,password){saveToken(await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})},false));return me();}
export async function me(){if(!token)return null;const users=await request('/rest/v1/profiles?id=eq.'+token.user.id);return users[0]||null;}
export async function read(table){return request('/rest/v1/'+table+'?select=*');}
export async function save(table,row){return request('/rest/v1/'+table+'?on_conflict='+ (table==='results'?'session_id,effort_id':'id'),{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});}
export async function remove(id){return request('/rest/v1/sessions?id=eq.'+id,{method:'DELETE'});}
