// No persistent health drafts by default. Account change destroys the working copy.
export function createSessionStore() {
  let uid = null, generation = 0;
  let data = {};
  return {
    switchUser(nextUid) { if(nextUid !== uid) { uid=nextUid; generation++; data={}; } },
    capture() { if(!uid) throw new Error('Connexion requise'); return {uid,generation}; },
    isCurrent(token) { return Boolean(token && token.uid === uid && token.generation === generation); },
    read(key) { return data[key] === undefined ? null : structuredClone(data[key]); },
    write(token,key,value) { if(!this.isCurrent(token)) throw new Error('Compte modifié : résultat ignoré'); data[key]=structuredClone(value); },
    clear() { generation++; data={}; },
    export() { return structuredClone(data); }
  };
}
