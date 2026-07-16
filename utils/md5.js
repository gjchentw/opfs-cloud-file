import SparkMD5 from 'spark-md5';

/**
 * md5 helper: compute a valid MD5 hash from an ArrayBuffer using SparkMD5.
 * Returns null on error.
 */
export async function md5FromArrayBuffer(ab) {
  try {
    return SparkMD5.ArrayBuffer.hash(ab);
  } catch (e) {
    return null;
  }
}
