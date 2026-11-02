export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function performance(efforts, results, threshold) {
  const best = new Map();
  return efforts.map(e => {
    const r = results.find(r => r.effort_id === e.id);
    // Protocol, timing distance, start type and ACTUAL gear must all match.
    if (!r || !(r.time > 0) || !e.protocol || !e.distance || !e.start || !(r.gear > 0)) return {id:e.id, loss:null};
    const key = JSON.stringify([e.protocol,e.distance,e.start,Number(r.gear)]);
    const previous = best.get(key);
    const baseline = Math.min(previous ?? Infinity, Number(r.time));
    best.set(key, baseline);
    const loss = (Number(r.time)/baseline-1)*100;
    return {id:e.id,loss,alert:threshold !== null && threshold !== '' && loss > Number(threshold)};
  });
}
export function validResult(r) {
  for (const k of ['time','split','gear','power','weight','reps','duration']) if (r[k] != null && (!Number.isFinite(r[k]) || r[k] <= 0)) return false;
  return (r.rpe == null || Number.isFinite(r.rpe) && r.rpe >= 1 && r.rpe <= 10) && !(r.split != null && r.time != null && r.split > r.time);
}
export function sample(athlete_id, date, kind='Track') {
 const templates={Track:['Maximum velocity','Build speed progressively. Stay relaxed. Maintain pressure through the line.','Flying 200 m',200,'flying','12 min',3],Gym:['Strength & intent','Move each rep with intent. Keep technique consistent. Stop a set if form deteriorates.','Back squat',null,'gym','3–5 min',4],Trainer:['Controlled aerobic work','Keep cadence smooth. Stay within the prescribed power range.','5 min at 180–220 W',null,'trainer','3 min easy',4]};
 const [title,cues,protocol,distance,start,recovery,n]=templates[kind];
 return {id:crypto.randomUUID(),athlete_id,date,kind,title,objective:kind==='Track'?'Develop maximum speed with high-quality efforts.':'Complete controlled, technically consistent work.',warmup:kind==='Track'?'20 min progressive warm-up; 2 controlled build-ups.':'10 min easy warm-up and progressive preparation.',cues,threshold:kind==='Track'?2:null,efforts:Array.from({length:n},(_,i)=>({id:crypto.randomUUID(),label:`${kind==='Gym'?'Set':'Effort'} ${i+1}`,protocol,distance,start,gear:kind==='Track'?125:null,recovery,prescription:kind==='Gym'?'3 reps · coach selects load':kind==='Trainer'?protocol:'Flying 200 m · full recovery'}))};
}
export function gearInches(chainring,sprocket,wheel=27){return wheel*chainring/sprocket;}
export function gearOptions(target,wheel=27){const rows=[];for(let front=42;front<=70;front++)for(let rear=12;rear<=22;rear++)rows.push({front,rear,inches:gearInches(front,rear,wheel)});return rows.sort((a,b)=>Math.abs(a.inches-target)-Math.abs(b.inches-target));}
