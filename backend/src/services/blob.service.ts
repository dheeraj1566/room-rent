import { createRequire } from "node:module";
import env from "../config/env.js";

type UploadedBlob = {
  blobId: string;
  blobUrl: string;
  accessUrl: string;
};

const require = createRequire(import.meta.url);
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  SASProtocol,
  generateBlobSASQueryParameters,
} = require("@azure/storage-blob") as {
  BlobServiceClient: any;
  StorageSharedKeyCredential: any;
  BlobSASPermissions: any;
  SASProtocol: any;
  generateBlobSASQueryParameters: any;
};

const parseConnectionStringPart = (key: string): string | null => {
  const source = env.AZURE_STORAGE_CONNECTION_STRING;
  if (!source) return null;
  const match = source.match(new RegExp(`${key}=([^;]+)`));
  return match?.[1] ?? null;
};

const getStorageAccountName = (): string => {
  return env.AZURE_STORAGE_ACCOUNT_NAME || parseConnectionStringPart("AccountName") || "";
};

const getStorageAccountKey = (): string => {
  return env.AZURE_STORAGE_ACCOUNT_KEY || parseConnectionStringPart("AccountKey") || "";
};

const getBlobServiceClient = () => {
  if (env.AZURE_STORAGE_CONNECTION_STRING) {
    return BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING);
  }

  const accountName = getStorageAccountName();
  const accountKey = getStorageAccountKey();
  if (!accountName || !accountKey) {
    throw new Error("Azure Blob config missing. Set account name/key or connection string.");
  }

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const accountUrl = `https://${accountName}.blob.core.windows.net`;
  return new BlobServiceClient(accountUrl, credential);
};

export const getBlobUrlFromId = (blobId: string): string => {
  const accountName = getStorageAccountName();
  if (!accountName) {
    throw new Error("Azure account name missing");
  }
  return `https://${accountName}.blob.core.windows.net/${env.AZURE_STORAGE_CONTAINER_NAME}/${blobId}`;
};

export const generateReadSasUrl = (blobId: string, expiresInHours = 24 * 365 * 5): string => {
  const accountName = getStorageAccountName();
  const accountKey = getStorageAccountKey();
  if (!accountName || !accountKey) {
    throw new Error("Azure account key is required to generate SAS URLs");
  }

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const expiresOn = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const sas = generateBlobSASQueryParameters(
    {
      containerName: env.AZURE_STORAGE_CONTAINER_NAME,
      blobName: blobId,
      permissions: BlobSASPermissions.parse("r"),
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential
  ).toString();

  return `${getBlobUrlFromId(blobId)}?${sas}`;
};

export class BlobService {
  static async uploadImage(file: Express.Multer.File): Promise<UploadedBlob> {
    const blobService = getBlobServiceClient();
    const containerClient = blobService.getContainerClient(env.AZURE_STORAGE_CONTAINER_NAME);

    const originalExt = (file.originalname.split(".").pop() || "jpg").toLowerCase();
    const safeExt = /^[a-z0-9]+$/.test(originalExt) ? originalExt : "jpg";
    const blobId = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${safeExt}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobId);
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype || "application/octet-stream",
      },
    });

    return {
      blobId,
      blobUrl: blockBlobClient.url,
      accessUrl: generateReadSasUrl(blobId),
    };
  }

  static async moveBlobToListingFolder(
    sourceBlobId: string,
    listingId: string
  ): Promise<{ blobId: string; blobUrl: string }> {
    const blobService = getBlobServiceClient();
    const containerClient = blobService.getContainerClient(env.AZURE_STORAGE_CONTAINER_NAME);

    const normalizedSourceBlobId = sourceBlobId.replace(/^\/+/, "");
    if (normalizedSourceBlobId.startsWith(`listings/${listingId}/`)) {
      return {
        blobId: normalizedSourceBlobId,
        blobUrl: getBlobUrlFromId(normalizedSourceBlobId),
      };
    }

    const sourceBlobClient = containerClient.getBlockBlobClient(normalizedSourceBlobId);
    const sourceExists = await sourceBlobClient.exists();
    if (!sourceExists) {
      return {
        blobId: normalizedSourceBlobId,
        blobUrl: getBlobUrlFromId(normalizedSourceBlobId),
      };
    }

    const sourceName = normalizedSourceBlobId.split("/").pop() || `${Date.now()}.jpg`;
    const targetBlobId = `listings/${listingId}/${sourceName}`;
    const targetBlobClient = containerClient.getBlockBlobClient(targetBlobId);

    const downloaded = await sourceBlobClient.downloadToBuffer();
    const sourceProperties = await sourceBlobClient.getProperties();
    await targetBlobClient.uploadData(downloaded, {
      blobHTTPHeaders: {
        blobContentType: sourceProperties.contentType || "application/octet-stream",
      },
    });

    try {
      await sourceBlobClient.deleteIfExists();
    } catch {
      // Ignore cleanup failures; target blob is already persisted.
    }

    return {
      blobId: targetBlobId,
      blobUrl: targetBlobClient.url,
    };
  }
}
