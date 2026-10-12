export class ConflictError extends Error {}
// transport supplies atomic compare-and-set and server timestamps.
export function createRepository(session, transport) {
  const collections = new Set(['coachProfiles','dailyRecovery','nutritionTargets','plannedActivities']);
  function check(collection,id) {
    if(!collections.has(collection) || typeof id !== 'string' || !id || id.includes('/') || id.length > 500) throw new Error('Chemin refusé');
  }
  return {
    async load(collection,id) {
      check(collection,id); const token=session.capture();
      const record=await transport.read(token.uid,collection,id);
      if(!session.isCurrent(token)) throw new Error('Compte modifié : lecture ignorée');
      return record;
    },
    async save(collection,id,payload,expectedRevision=0) {
      check(collection,id); const token=session.capture();
      if(!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('Révision invalide');
      const result=await transport.compareAndSet(token.uid,collection,id,structuredClone(payload),expectedRevision,()=>session.isCurrent(token));
      if(!session.isCurrent(token)) throw new Error('Compte modifié : résultat ignoré');
      return result;
    }
  };
}
