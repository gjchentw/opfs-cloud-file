/**
 * md5 helper: use SparkMD5 if available in global (browser),
 * otherwise fallback to a simple JS implementation is not provided.
 */
export async function md5FromArrayBuffer(ab) {
  if (typeof self !== 'undefined' && self.SparkMD5 && self.SparkMD5.ArrayBuffer) {
    return self.SparkMD5.ArrayBuffer.hash(ab);
  }
  // fallback: compute via string conversion (not ideal for large binary)
  const u8 = new Uint8Array(ab);
  let s = '';
  for (let i=0;i<u8.length;i++) s += String.fromCharCode(u8[i]);
  // naive md5 via external lib required; here we just return a hex digest placeholder
  // Consumers should include SparkMD5 in browser to get proper md5.
  return 'md5-fallback-' + u8.length;
}
