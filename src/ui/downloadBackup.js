/**
 * Descarga un backup como archivo JSON.
 *
 * @param {import('../domain/types.js').PantryBackup} backup Backup exportado.
 */
export function downloadBackup(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const exportedDate = backup.exportedAt.slice(0, 10);

  link.href = url;
  link.download = `despensapp-backup-${exportedDate}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
