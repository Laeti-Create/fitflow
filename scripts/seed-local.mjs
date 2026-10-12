// Fixed fictitious identities; cannot address a real Firebase host/project.
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {setDoc,doc} from 'firebase/firestore';
const projectId='demo-fitflow';
const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080}});
try {
  for(const name of ['alice','bob']) {
    const response=await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},
      body:JSON.stringify({localId:name,email:`${name}@example.test`,password:'fitflow-local-test-only',emailVerified:true,displayName:name})
    });
    if(!response.ok) {const result=await response.json();if(!['EMAIL_EXISTS','DUPLICATE_LOCAL_ID'].includes(result.error?.message)) throw new Error('Impossible de préparer Auth local');}
    await env.withSecurityRulesDisabled(async ctx=>{
      await setDoc(doc(ctx.firestore(),'accessGrants',name),{active:true});
      await setDoc(doc(ctx.firestore(),'users',name,'profile','main'),{firstname:name,startWeight:70,targetWeight:70,height:1.65,startDate:'2026-10-12',stepLength:0.56});
    });
  }
  console.log('Alice et Bob prêts dans demo-fitflow uniquement. Aucun compte réel créé.');
} finally {await env.cleanup();}
