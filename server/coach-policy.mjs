// Pure policy for the future trusted server, NOT an HTTP endpoint or token verifier.
// Caller must supply verified Firebase/App Check results, never request.body.auth.
import {coachReadiness,requireThat,number,text} from '../hybrid/domain.mjs';
export function authorizeCoach({verifiedIdentity,verifiedAppCheck,grant,profile}) {
  requireThat(verifiedIdentity && typeof verifiedIdentity.uid === 'string' && verifiedIdentity.uid.length > 0,'Authentification requise');
  requireThat(verifiedIdentity.emailVerified === true,'Email non vérifié');
  requireThat(verifiedAppCheck === true,'Application non vérifiée');
  requireThat(grant?.active === true,'Invitation inactive');
  const readiness=coachReadiness(profile);
  requireThat(readiness.ready,readiness.reasons.join(' ; '));
  return {uid:verifiedIdentity.uid,profile:readiness.profile};
}
export function maximumReservation({inputTokens,outputTokens,searchCalls,rates}) {
  for(const [k,v] of Object.entries({inputTokens,outputTokens,searchCalls})) {
    number(v,0,10000000,k);requireThat(Number.isInteger(v),'Unités entières requises');
  }
  number(rates.inputPerMillion,0,1000,'Tarif entrée');number(rates.outputPerMillion,0,1000,'Tarif sortie');number(rates.searchPerCall,0,100,'Tarif recherche');
  // Micro-USD integers; includes reasoning tokens in outputTokens. Rates are
  // server configuration, never client supplied. Taxes/hosting excluded.
  const microUsd=Math.ceil(inputTokens*rates.inputPerMillion+outputTokens*rates.outputPerMillion+searchCalls*rates.searchPerCall*1e6);
  requireThat(Number.isSafeInteger(microUsd),'Réservation hors limites');
  return microUsd;
}
export function budgetAllows({reservedMicroUsd,spentMicroUsd,limitMicroUsd,nextMicroUsd}) {
  for(const v of [reservedMicroUsd,spentMicroUsd,limitMicroUsd,nextMicroUsd]) requireThat(Number.isSafeInteger(v) && v>=0,'Budget invalide');
  return nextMicroUsd <= limitMicroUsd - spentMicroUsd - reservedMicroUsd;
}
export function validateRequestId(id) {
  text(id,80,'Identifiant de requête');requireThat(/^[A-Za-z0-9_-]{16,80}$/.test(id),'Identifiant de requête invalide');return id;
}
