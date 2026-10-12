const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const noImports = (file) => source(file).replace(/^import[\s\S]*?;\s*/gm, '');

// Execute the actual legacy functions in isolation. SDK calls are synthetic;
// neither these tests nor their fixtures initialize a real Firebase connection.
function sandbox() {
  const events = {};
  const saved = new Map();
  const warnings = [];
  const alerts = [];
  let now = 16000;
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({
    firebaseConfig: {}, console: { warn: (...args) => warnings.push(args), error: (...args) => warnings.push(args) },
    structuredClone, Date: Clock, URL, Number, JSON, Math,
    localStorage: { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    document: {
      readyState: 'loading', querySelector: () => null, querySelectorAll: () => [],
      addEventListener: (name, callback) => { (events[name] ||= []).push(callback); }
    },
    window: { addEventListener: () => {}, dispatchEvent: () => {} },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    confirm: () => true, alert: (message) => alerts.push(message),
    getApps: () => [], initializeApp: () => ({}), getAuth: () => ({}), getFirestore: () => ({}),
    GoogleAuthProvider: class {}, CustomEvent: class {}, navigator: {},
    getDoc: () => {}, doc: () => ({}),
    serverTimestamp: () => ({ syntheticTimestamp: true }),
    deleteDoc: async () => { throw new Error('synthetic permission-denied'); },
    updateDoc: async () => { throw new Error('synthetic permission-denied'); },
    getNutritionEntries: () => []
  });
  return { context, events, saved, alerts, clock: (value) => { now = value; }, run: (code) => vm.runInContext(code, context) };
}

function appSandbox() {
  const box = sandbox();
  box.run(noImports('app.js').replace(/\ninit\(\);\s*$/, ''));
  box.run('render=()=>{};');
  return box;
}

function guidedSandbox() {
  const box = sandbox();
  box.run(source('running-guided.js'));
  box.run('updateDisplay=()=>{}; renderPhase=()=>{}; signal=()=>{}; requestWakeLock=()=>{}; releaseWakeLock=()=>{}; current={phases:[{seconds:60},{seconds:60},{seconds:60}]}; phaseIndex=0; totalStartedAt=1000; phaseStartedAt=1000;');
  return box;
}

test('all application JavaScript parses as ES modules', () => {
  const files = fs.readdirSync(root).filter((file) => file.endsWith('.js'));
  assert.ok(files.length >= 31);
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source(file), encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test('app shell is directly loaded on a first visit', () => {
  assert.match(source('index.html'), /<script type="module" src="app-shell\.js"><\/script>/);
  assert.match(source('index.html'), /href="app-shell\.css"/);
});

test('all cached assets exist and shell versions match', () => {
  const box = sandbox();
  box.context.self = { registration: { scope: 'https://example.test/fitflow/test/' }, addEventListener: () => {} };
  box.run(source('service-worker.js'));
  const files = box.run('[...CORE_FILES,...FEATURE_FILES]');
  for (const file of files) if (file) assert.ok(fs.existsSync(path.join(root, file)), file);
  const version = box.run('APP_SHELL_VERSION');
  assert.ok(source('app-shell.js').includes(`const FITFLOW_VERSION = "${version}"`));
  assert.equal(JSON.parse(source('test-build.json')).version, version);
});

test('existing page has no duplicate element identifiers', () => {
  const ids = [...source('index.html').matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('running handlers bind once across auth callbacks', () => {
  const box = sandbox(); box.run(noImports('running.js'));
  box.run('bind(); bind(); bind();');
  assert.equal(box.events.click.length, 1);
});

test('deletion uses run ID despite an unsorted underlying history', async () => {
  const box = sandbox(); box.run(noImports('running.js'));
  box.run('runs=[{id:"older",date:"2026-10-10"},{id:"newer",date:"2026-10-12"}]; renderRuns=()=>{};');
  await box.run('deleteRun("newer")');
  assert.equal(box.run('JSON.stringify(runs.map(r=>r.id))'), '["older"]');
  assert.match(source('running.js'), /data-run-id=/);
});

test('deleting an unknown run leaves history unchanged', async () => {
  const box = sandbox(); box.run(noImports('running.js'));
  box.run('runs=[{id:"protected"}];');
  await box.run('deleteRun("missing")');
  assert.equal(box.run('runs.length'), 1);
});

test('failed walk deletion preserves in-memory data', async () => {
  const box = appSandbox();
  box.run('firebase={db:{}};state.user={uid:"audit"};state.walks=[{id:"protected",date:"2026-10-12"}];');
  assert.equal(await box.run('removeArrayEntry("walks","walks",0,"audit")'), false);
  assert.equal(box.run('state.walks[0].id'), 'protected');
  assert.equal(box.alerts.length, 1);
});

test('failed edit preserves original values', async () => {
  const box = appSandbox();
  box.run('firebase={db:{}};state.user={uid:"audit"};state.weights=[{id:"protected",weight:70}];');
  assert.equal(await box.run('updateArrayEntry("weights","weights",0,{weight:60})'), false);
  assert.equal(box.run('state.weights[0].weight'), 70);
});

test('successful deletion removes the same ID after a concurrent reorder', async () => {
  const box = appSandbox();
  box.run('firebase={db:{}};state.user={uid:"audit"};state.walks=[{id:"target"},{id:"other"}];');
  box.context.deleteDoc = async () => { box.run('state.walks.reverse()'); };
  assert.equal(await box.run('removeArrayEntry("walks","walks",0,"audit")'), true);
  assert.equal(box.run('state.walks[0].id'), 'other');
});

test('successful edit preserves concurrent unrelated changes', async () => {
  const box = appSandbox();
  box.run('firebase={db:{}};state.user={uid:"audit"};state.weights=[{id:"target",weight:70,comment:"before"}];');
  box.context.updateDoc = async () => { box.run('state.weights[0].comment="concurrent"'); };
  assert.equal(await box.run('updateArrayEntry("weights","weights",0,{weight:69})'), true);
  assert.equal(box.run('state.weights[0].comment'), 'concurrent');
  assert.equal(box.run('state.weights[0].weight'), 69);
});

test('demo deletion persists the resulting array', async () => {
  const box = appSandbox();
  box.run('state.walks=[{id:"remove"},{id:"keep"}];');
  await box.run('removeArrayEntry("walks","walks",0,"audit")');
  assert.equal(JSON.parse(box.saved.get('fitflow:demo:walks'))[0].id, 'keep');
});

test('demo edit persists the resulting values', async () => {
  const box = appSandbox();
  box.run('state.weights=[{id:"target",weight:70}];');
  await box.run('updateArrayEntry("weights","weights",0,{weight:69})');
  assert.equal(JSON.parse(box.saved.get('fitflow:demo:weights'))[0].weight, 69);
});

test('authenticated empty collections are not replaced with samples', async () => {
  const box = appSandbox();
  box.context.getDoc = async () => ({ exists: () => true, data: () => ({ firstname: 'Audit' }) });
  box.context.getDocs = async () => ({ docs: [] });
  box.context.collection = () => ({}); box.context.query = () => ({}); box.context.orderBy = () => ({});
  box.run('firebase={db:{}};state.user={uid:"audit"};');
  await box.run('loadRemote()');
  assert.equal(box.run('[state.walks,state.weights,state.strengthSessions,state.measurements].every(list=>list.length===0)'), true);
});

test('guided elapsed time retains pause duration on next phase', () => {
  const box = guidedSandbox();
  box.run('pausedTotal=5000;phasePausedTotal=5000;');
  assert.equal(box.run('elapsedTotal()'), 10);
  box.run('advancePhase()');
  assert.equal(box.run('elapsedTotal()'), 10);
  assert.equal(box.run('phaseElapsed()'), 0);
});

test('guided elapsed time retains pause duration on previous phase', () => {
  const box = guidedSandbox();
  box.run('phaseIndex=1;pausedTotal=5000;phasePausedTotal=5000;previousPhase();');
  assert.equal(box.run('elapsedTotal()'), 10);
  assert.equal(box.run('phaseElapsed()'), 0);
});

test('phase change while paused accounts for the unfinished pause', () => {
  const box = guidedSandbox();
  box.run('isPaused=true;pausedAt=11000;advancePhase();');
  assert.equal(box.run('elapsedTotal()'), 10);
});

test('pause and resume update both phase and session clocks', () => {
  const box = guidedSandbox();
  box.clock(11000); box.run('togglePause()');
  box.clock(16000); box.run('togglePause()');
  assert.equal(box.run('elapsedTotal()'), 10);
  assert.equal(box.run('phaseElapsed()'), 10);
  box.run('advancePhase()'); box.clock(21000);
  assert.equal(box.run('elapsedTotal()'), 15);
  assert.equal(box.run('phaseElapsed()'), 5);
});

test('reset clears both pause counters', () => {
  const box = guidedSandbox(); box.run('pausedTotal=5000;phasePausedTotal=2000;resetState();');
  assert.equal(box.run('pausedTotal+phasePausedTotal'), 0);
});

test('calorie budget follows a changed profile target', () => {
  const box = sandbox();
  const elements = {};
  const element = (selector) => elements[selector] ||= { textContent: '', innerHTML: '', dataset: {}, style: {}, closest: () => null };
  box.context.document.querySelector = element;
  box.run(noImports('nutrition.js').split('\nif (firebase) {')[0]);
  box.run('renderMacroRow=()=>{};renderFavorites=()=>{};renderMeals=()=>{};nutritionMessages=()=>[];');
  box.run(`(function(){${source('nutrition-net-budget.js')}\nwindow.auditAdjust=adjustNutritionBudget;})();`);
  box.run('state.profile.calorieTarget=1650;renderNutrition();');
  element('#nutrition-activity').textContent = '200'; box.run('window.auditAdjust()');
  assert.equal(element('#nutrition-target').dataset.baseTarget, '1650');
  box.run('state.profile.calorieTarget=1950;renderNutrition();');
  element('#nutrition-activity').textContent = '200'; box.run('window.auditAdjust()');
  assert.equal(element('#nutrition-target').textContent.replace(/\s/g, ''), '2150');
});

test('food and favorite units cannot inject markup', () => {
  const box = sandbox(); box.run(noImports('nutrition.js').split('\nif (firebase) {')[0]);
  box.run('const unsafe={name:"Food",referenceType:"portion",quantity:1,unit:"<img src=x onerror=alert(1)>"};');
  assert.equal(box.run('renderFoodItem(unsafe).includes("<img")'), false);
  assert.equal(box.run('renderFavoriteItem(unsafe,0).includes("<img")'), false);
});

test('existing food calculations keep per-100 and portion semantics', () => {
  const box = sandbox(); box.run(noImports('nutrition.js').split('\nif (firebase) {')[0]);
  assert.equal(box.run('calcFood({quantity:150,baseCalories:100,baseProtein:10}).calories'), 150);
  assert.equal(box.run('calcFood({quantity:150,baseCalories:100,baseProtein:10}).protein'), 15);
  assert.equal(box.run('calcFood({referenceType:"portion",quantity:2,baseCalories:100,baseProtein:10}).calories'), 200);
});

test('nutrition store preserves ID-based update, deduplication and removal', () => {
  const box = sandbox(); box.run(source('nutrition-store.js').replace(/^export /gm, ''));
  box.run('replaceNutritionEntries([{id:"a",calories:100}]);addNutritionEntryToStore({id:"a",calories:200});');
  assert.equal(box.run('getNutritionEntries().length'), 1);
  box.run('updateNutritionEntryInStore("a",{calories:300});');
  assert.equal(box.run('getNutritionEntries()[0].calories'), 300);
  box.run('removeNutritionEntryFromStore("a");');
  assert.equal(box.run('getNutritionEntries().length'), 0);
});

test('activating test worker leaves stable and unrelated caches intact', async () => {
  const box = sandbox(); const deleted = []; let activate;
  box.context.caches = { keys: async () => ['fitflow-cache-fitflow-0.53.0-develop.3','fitflow-cache-fitflow-test-0.53.0-develop.3','another-app'], delete: async (key) => deleted.push(key) };
  box.context.self = { registration: { scope: 'https://example.test/fitflow/test/' }, addEventListener: (name, handler) => { if(name === 'activate') activate = handler; }, clients: { claim: async () => {} } };
  box.run(source('service-worker.js'));
  let pending; activate({ waitUntil: (promise) => { pending = promise; } }); await pending;
  assert.deepEqual(deleted, ['fitflow-cache-fitflow-test-0.53.0-develop.3']);
});

test('cache repair leaves other environments and data stores intact', async () => {
  const box = sandbox(); const deleted = [];
  box.context.window.confirm = () => true;
  box.context.window.location = { reload: () => {} };
  box.context.navigator.serviceWorker = { getRegistration: async () => ({ scope: 'https://example.test/fitflow/test/', update: async () => {} }) };
  box.context.caches = { keys: async () => ['fitflow-cache-fitflow-0.53.0-develop.3','fitflow-cache-fitflow-test-0.53.0-develop.3','another-app'], delete: async (key) => deleted.push(key) };
  box.context.window.caches = box.context.caches;
  box.saved.set('fitflow:audit:profile', '{"firstname":"Audit"}');
  box.run(source('app-shell.js'));
  await box.run('repairAppCache()');
  assert.deepEqual(deleted, ['fitflow-cache-fitflow-test-0.53.0-develop.3']);
  assert.equal(box.saved.get('fitflow:audit:profile'), '{"firstname":"Audit"}');
});


test('activating stable worker keeps test caches, including legacy names', async () => {
  const box = sandbox(); const deleted = []; let activate;
  box.context.caches = { keys: async () => ['fitflow-cache-fitflow-0.53.0-develop.3','fitflow-cache-fitflow::0.53.0-develop.4','fitflow-cache-fitflow-test-0.53.0-develop.3','fitflow-cache-fitflow-test::0.53.0-develop.4'], delete: async (key) => deleted.push(key) };
  box.context.self = { registration: { scope: 'https://example.test/fitflow/' }, addEventListener: (name, handler) => { if(name === 'activate') activate = handler; }, clients: { claim: async () => {} } };
  box.run(source('service-worker.js'));
  let pending; activate({ waitUntil: (promise) => { pending = promise; } }); await pending;
  assert.deepEqual(deleted, ['fitflow-cache-fitflow-0.53.0-develop.3']);
});
