/*
 * ============================================================
 * 008 - Add BlobId to ListingPhotos
 * ============================================================
 * Stores Azure Blob object identifier for each photo.
 * ============================================================
 */

IF COL_LENGTH('dbo.ListingPhotos', 'BlobId') IS NULL
BEGIN
    ALTER TABLE dbo.ListingPhotos
    ADD BlobId VARCHAR(300) NULL;

    PRINT 'Added BlobId column to dbo.ListingPhotos.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ListingPhotos_BlobId'
      AND object_id = OBJECT_ID('dbo.ListingPhotos')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ListingPhotos_BlobId
        ON dbo.ListingPhotos (BlobId)
        WHERE BlobId IS NOT NULL;

    PRINT 'Created index IX_ListingPhotos_BlobId.';
END
GO

