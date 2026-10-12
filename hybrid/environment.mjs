export function isLoopback(hostname) {
  return ['localhost','127.0.0.1','[::1]','::1'].includes(hostname);
}
export function selectFirebaseConfig(production, hostname) {
  return isLoopback(hostname) ? {
    apiKey:'demo-fitflow-local-only', authDomain:'demo-fitflow.firebaseapp.com',
    projectId:'demo-fitflow', appId:'1:123456789:web:fitflow-local'
  } : production;
}
