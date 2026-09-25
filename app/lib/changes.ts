// Tiny change notifications (no imports, so repo and sync can both use it without a cycle).
// local: the user edited shared data → sync soon. remote: sync wrote changes from the family → screens reload.
type Listener = () => void;

const local = new Set<Listener>();
const remote = new Set<Listener>();

export function onLocalChange(listener: Listener): () => void {
  local.add(listener);
  return () => local.delete(listener);
}

export function localChanged(): void {
  local.forEach((l) => l());
}

export function onRemoteChange(listener: Listener): () => void {
  remote.add(listener);
  return () => remote.delete(listener);
}

export function remoteChanged(): void {
  remote.forEach((l) => l());
}
