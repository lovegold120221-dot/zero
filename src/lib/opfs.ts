export async function getOpfsRoot() {
  return await navigator.storage.getDirectory();
}

export async function getOpfsDirectory(path: string): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').filter(Boolean);
  let currentHandle = await getOpfsRoot();
  
  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
  }
  
  return currentHandle;
}

export async function saveFileToOpfs(directoryPath: string, fileName: string, file: File | Blob | ArrayBuffer | Uint8Array | string): Promise<string> {
  const dirHandle = await getOpfsDirectory(directoryPath);
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  
  // Create a writable stream to the file.
  const writable = await fileHandle.createWritable();
  
  // Write the contents
  await writable.write(file);
  
  // Close the file
  await writable.close();
  
  // Return the path
  return `${directoryPath}/${fileName}`;
}

export async function readFileFromOpfs(filePath: string): Promise<File | null> {
  try {
    const parts = filePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return null;
    
    const directoryPath = parts.join('/');
    const dirHandle = await getOpfsDirectory(directoryPath);
    const fileHandle = await dirHandle.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch (err) {
    console.error(`Failed to read file from OPFS at ${filePath}:`, err);
    return null;
  }
}

export async function deleteFileFromOpfs(filePath: string): Promise<boolean> {
  try {
    const parts = filePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return false;
    
    const directoryPath = parts.join('/');
    const dirHandle = await getOpfsDirectory(directoryPath);
    await dirHandle.removeEntry(fileName);
    return true;
  } catch (err) {
    console.error(`Failed to delete file from OPFS at ${filePath}:`, err);
    return false;
  }
}

export async function getOpfsFileUrl(filePath: string): Promise<string | null> {
  const file = await readFileFromOpfs(filePath);
  if (!file) return null;
  return URL.createObjectURL(file);
}
