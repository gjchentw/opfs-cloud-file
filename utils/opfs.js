export async function readOpfsFile(path) {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(path);
    const file = await handle.getFile();
    return await file.arrayBuffer();
  } catch (e) {
    return null;
  }
}

export async function writeOpfsFile(path, buffer) {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(path, { create: true });
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
}
