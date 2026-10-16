// src/worker-factory.js — Worker module en dev/Pages, Worker Blob dans le fichier autonome (build).
export function createWorker() {
  if (globalThis.FREUDIFF_WORKER_SRC) {
    const url = URL.createObjectURL(new Blob([globalThis.FREUDIFF_WORKER_SRC], { type: 'text/javascript' }));
    return new Worker(url);
  }
  return createModuleWorker();
}
// Le build remplace cette fonction entière : elle lit l'URL du module courant, interdite dans un script classique.
function createModuleWorker() {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}
