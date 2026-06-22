// Photo storage abstraction. Driver chosen by STORAGE_DRIVER:
//   local  (default) — write to a PersistentVolume, served at /uploads
//   s3              — AWS S3 (or any S3-compatible endpoint, e.g. MinIO)
//   azure           — Azure Blob Storage
// The cloud SDKs are imported lazily so the local driver has zero cloud deps at
// runtime and a missing-config driver never breaks startup.
import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/data/uploads';
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function storageInfo() {
  return { driver: DRIVER };
}

// Accepts a base64 data URL, validates it, stores it, and returns { url } or { error }.
export async function savePhotoDataUrl(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return { error: 'Unsupported image format.' };
  const contentType = m[1];
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'Photo must be 2 MB or smaller.' };
  const key = `${crypto.randomUUID()}.${ext}`;

  try {
    if (DRIVER === 's3') return { url: await putS3(key, bytes, contentType) };
    if (DRIVER === 'azure') return { url: await putAzure(key, bytes, contentType) };
    return { url: await putLocal(key, bytes) };
  } catch (e) {
    console.error('photo upload failed', e);
    return { error: 'Photo upload failed.' };
  }
}

// --- local -----------------------------------------------------------------
async function putLocal(key, bytes) {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(join(UPLOADS_DIR, key), bytes);
  return `/uploads/${key}`;
}

// --- S3 / S3-compatible ----------------------------------------------------
let _s3;
async function s3Client() {
  if (!_s3) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    _s3 = new S3Client({
      region: process.env.S3_REGION || undefined,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || 'false') === 'true',
      // If explicit keys aren't given, the SDK uses the default chain
      // (IRSA / instance profile / env) — recommended on EKS.
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }
  return _s3;
}

async function putS3(key, bytes, contentType) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET is not set.');
  const prefix = process.env.S3_PREFIX ? `${process.env.S3_PREFIX.replace(/\/$/, '')}/` : '';
  const fullKey = `${prefix}${key}`;
  const client = await s3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fullKey,
      Body: bytes,
      ContentType: contentType,
      ...(process.env.S3_ACL ? { ACL: process.env.S3_ACL } : {}),
    })
  );
  return s3PublicUrl(fullKey);
}

function s3PublicUrl(fullKey) {
  const base = process.env.S3_PUBLIC_BASE_URL; // e.g. a CloudFront / CDN domain
  if (base) return `${base.replace(/\/$/, '')}/${fullKey}`;
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    const e = endpoint.replace(/\/$/, '');
    return String(process.env.S3_FORCE_PATH_STYLE || 'false') === 'true'
      ? `${e}/${bucket}/${fullKey}`
      : `${e}/${fullKey}`;
  }
  const region = process.env.S3_REGION || 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${fullKey}`;
}

// --- Azure Blob ------------------------------------------------------------
let _azContainer;
async function azureContainer() {
  if (!_azContainer) {
    const { BlobServiceClient, StorageSharedKeyCredential } = await import('@azure/storage-blob');
    let svc;
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      svc = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    } else {
      const account = process.env.AZURE_STORAGE_ACCOUNT;
      const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
      if (!account || !accountKey) {
        throw new Error('Set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT(+_KEY).');
      }
      const cred = new StorageSharedKeyCredential(account, accountKey);
      svc = new BlobServiceClient(`https://${account}.blob.core.windows.net`, cred);
    }
    _azContainer = svc.getContainerClient(process.env.AZURE_STORAGE_CONTAINER);
  }
  return _azContainer;
}

async function putAzure(key, bytes, contentType) {
  if (!process.env.AZURE_STORAGE_CONTAINER) throw new Error('AZURE_STORAGE_CONTAINER is not set.');
  const container = await azureContainer();
  const block = container.getBlockBlobClient(key);
  await block.uploadData(bytes, { blobHTTPHeaders: { blobContentType: contentType } });
  const base = process.env.AZURE_PUBLIC_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/${key}` : block.url;
}
