// Qué efecto suena para cada cambio de navegación.
const SOUND_FOR_CHANGE = {
  item: 'move',
  move: 'move',
  category: 'category',
  commit: 'confirm',
  link: 'confirm',
  action: 'confirm',
  launch: 'launch',
  close: 'back',
};

export function soundForChange(change) {
  if (change.type === 'open') return change.kind === 'list' ? 'confirm' : 'panel';
  return SOUND_FOR_CHANGE[change.type] ?? null;
}
