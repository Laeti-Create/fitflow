import {firebaseApp,isLocalDevelopment} from '../firebase-config.js';
import {getFirestore,doc,getDoc,getDocs,collection,query,limit,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import {createRepository,ConflictError} from './repository.mjs';
export function localRepository(session) {
  if(!isLocalDevelopment) throw new Error('Parcours en attente de recette dans un projet isolé');
  const db=getFirestore(firebaseApp);
  const repository = createRepository(session,{
    async read(uid,collection,id) {
      const snapshot=await getDoc(doc(db,'users',uid,collection,id));
      return snapshot.exists() ? snapshot.data() : null;
    },
    async compareAndSet(uid,collection,id,payload,expectedRevision,isCurrent) {
      const reference=doc(db,'users',uid,collection,id);
      return runTransaction(db,async tx=>{
        const snapshot=await tx.get(reference);
        if(!isCurrent()) throw new Error('Compte modifié');
        const existing=snapshot.exists() ? snapshot.data() : null;
        if((existing?.revision ?? 0) !== expectedRevision) throw new ConflictError('Une autre sauvegarde a modifié ce document. Recharge avant de réessayer.');
        const revision=expectedRevision+1;
        tx.set(reference,{schemaVersion:1,revision,createdAt:existing?.createdAt ?? serverTimestamp(),updatedAt:serverTimestamp(),payload});
        return {revision,payload};
      });
    }
  });
  repository.loadCalendar = async () => {
    const token=session.capture();
    const snap=await getDocs(query(collection(db,'users',token.uid,'plannedActivities'),limit(367)));
    if(!session.isCurrent(token)) throw new Error('Compte modifié');
    if(snap.size > 366) throw new Error('Plus de 366 séances : pagination à mettre en place avant chargement');
    return snap.docs.map(d=>({id:d.id,...d.data().payload}));
  };
  repository.importCalendar = async (preview) => {
    const token=session.capture();
    return runTransaction(db,async tx=>{
      const refs=preview.rows.map(r=>doc(db,'users',token.uid,'plannedActivities',r.record.id));
      const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
      if(!session.isCurrent(token)) throw new Error('Compte modifié');
      let added=0;
      snapshots.forEach((s,i)=>{
        if(s.exists()) return;
        const {id,...payload}=preview.rows[i].record;
        tx.set(refs[i],{schemaVersion:1,revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),payload});
        added++;
      });
      return added;
    });
  };
  repository.saveStrength = async ({id,date,name,summary}) => {
    const token=session.capture();
    const ref=doc(db,'users',token.uid,'strengthSessions',id);
    return runTransaction(db,async tx=>{
      const old=await tx.get(ref);
      if(!session.isCurrent(token)) throw new Error('Compte modifié');
      if(old.exists()) return; // stable operation ID: repeated submission is a no-op
      tx.set(ref,{schemaVersion:2,date,name,duration:null,totalSets:summary.workSets,
        totalVolume:summary.unknownVolumeSets ? null : summary.knownVolumeKg,
        knownVolumeKg:summary.knownVolumeKg,unknownVolumeSets:summary.unknownVolumeSets,
        sets:summary.sets,type:'full',effort:null,calories:null,comment:'',createdAt:serverTimestamp()});
    });
  };
  return repository;
}
