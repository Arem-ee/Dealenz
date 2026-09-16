let pendingFile: File | null = null

export function setPendingFile(file: File | null) {
  pendingFile = file
}

export function getPendingFile(): File | null {
  return pendingFile
}

export function clearPendingFile() {
  pendingFile = null
}
