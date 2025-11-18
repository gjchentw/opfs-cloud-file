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
  const folders = path.split('/').filter((f) => f.length);
  const filename = folders.pop();
  const place = folders.length ? await mkdir(root, folders) : root;
  const handle = await place.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
}

export async function mkdir(on, folders) {
  if (folders.length) {
    const folder = folders.shift();
    const next = await on.getDirectoryHandle(folder, { create: true });
    return await mkdir(next, folders);
  }

  return on;
}