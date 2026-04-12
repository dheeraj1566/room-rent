import sql from "mssql";
import { executeQuery, getPool } from "../config/db";
import type { ParsedAddress } from "./googleMaps.service";
import { BlobService, generateReadSasUrl } from "./blob.service.js";

// ─── Schema cache ───────────────────────────────────────────
// Queries sys.columns / INFORMATION_SCHEMA only ONCE per table, then caches
// the result for the process lifetime. Eliminates 6-8 redundant DB queries
// per request that were burning Azure SQL free-tier compute.
const schemaCache = new Map<string, Set<string>>();

async function getCachedColumns(tableName: string): Promise<Set<string>> {
  const key = tableName.toLowerCase();
  const cached = schemaCache.get(key);
  if (cached) return cached;

  const result = await executeQuery(`
    SELECT name AS ColumnName
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.${tableName}')
  `);
  const columns = new Set(
    result.recordset.map((c: { ColumnName: string }) => c.ColumnName),
  );
  schemaCache.set(key, columns);
  return columns;
}

export interface CreateListingDto {
  landlordId: string;
  roomDetails: {
    floorLevelId: number;
    maxOccupants: number;
    foodPreferenceId: number;
    allowSmoking: boolean;
    monthlyRent: number;
    furnishingTypeId: number;
    availableFrom: string;
    description?: string;
    securityDeposit?: number | null;
    propertyTypeId?: number;
    foodLevelId?: number;
    bedType?: "Single" | "Double" | "Mixed";
    singleBedCount?: number;
    doubleBedCount?: number;
  };
  photos?: {
    photoType: "Room" | "Exterior";
    photoUrl: string;
    blobId?: string;
    displayOrder?: number;
  }[];
  location: ParsedAddress & { latitude: number; longitude: number };
}

export interface UpdateListingDto {
  landlordId: string;
  listingId: string;
  roomDetails: CreateListingDto["roomDetails"];
  location: CreateListingDto["location"];
  photos?: CreateListingDto["photos"];
}

export interface ListingItem {
  listingId: string;
  landlordId: string;
  landlordName: string;
  landlordGender: string | null;
  title: string;
  description: string | null;
  floorLevelId: number;
  floorName: string;
  furnishingTypeId: number;
  furnishingName: string;
  maxOccupants: number;
  allowSmoking: boolean;
  foodPreferenceId: number;
  foodPreferenceName: string;
  propertyTypeId: number | null;
  monthlyRent: number;
  securityDeposit: number | null;
  availableFrom: string;
  addressLine: string;
  colony: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  statusId: number;
  createdAt: string;
  updatedAt: string;
  coverPhotoUrl: string | null;
}

export interface ListingPhotoItem {
  photoType: "Room" | "Exterior";
  photoUrl: string;
  displayOrder: number;
}

export interface ListingDetailsItem extends ListingItem {
  propertyTypeId: number | null;
  foodLevelId: number | null;
  bedType: string | null;
  singleBedCount: number | null;
  doubleBedCount: number | null;
  photos: ListingPhotoItem[];
}

export interface ListingFilters {
  search?: string;
  city?: string;
  minRent?: number;
  maxRent?: number;
  maxOccupants?: number[];
  floorLevelId?: number[];
  furnishingTypeId?: number[];
  foodPreferenceId?: number[];
  propertyTypeId?: number[];
  gender?: string[];
  allowSmoking?: boolean[];
  sortBy?: "newest" | "rent_asc" | "rent_desc";
  landlordId?: string;
}

export interface LocationOption {
  area: string;
  colonies: string[];
}

export class ListingsService {
  private static parseColonies(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
    }

    if (typeof raw !== "string") return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0);
      }
    } catch {
      // ignore
    }

    try {
      const parsed = JSON.parse(trimmed.replace(/'/g, '"')) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0);
      }
    } catch {
      // ignore
    }

    return trimmed
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter((item) => item.length > 0);
  }

  static async getLocationOptions(): Promise<LocationOption[]> {
    const pool = await getPool();

    const sourceResult = await executeQuery(`
      SELECT TOP 1
        s.name AS SchemaName,
        t.name AS TableName
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE EXISTS (
        SELECT 1 FROM sys.columns c
        WHERE c.object_id = t.object_id AND c.name = 'Area'
      )
      AND EXISTS (
        SELECT 1 FROM sys.columns c
        WHERE c.object_id = t.object_id AND c.name = 'Colonies'
      )
      ORDER BY
        CASE WHEN t.name IN ('Locations', 'Location', 'LocationMaster', 'LocationMasters') THEN 0 ELSE 1 END,
        t.name ASC
    `);

    const source = sourceResult.recordset[0] as
      | { SchemaName?: string; TableName?: string }
      | undefined;
    if (!source?.SchemaName || !source?.TableName) return [];

    const schemaName = source.SchemaName;
    const tableName = source.TableName;
    if (
      !/^[A-Za-z0-9_]+$/.test(schemaName) ||
      !/^[A-Za-z0-9_]+$/.test(tableName)
    ) {
      return [];
    }

    const colsResult = await executeQuery(`
      SELECT c.name AS ColumnName
      FROM sys.columns c
      JOIN sys.tables t ON t.object_id = c.object_id
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE s.name = '${schemaName}' AND t.name = '${tableName}'
    `);
    const columns = new Set(
      colsResult.recordset.map(
        (item: { ColumnName: string }) => item.ColumnName,
      ),
    );

    const qualifiedTable = `[${schemaName}].[${tableName}]`;
    const whereClause = columns.has("IsActive") ? "WHERE [IsActive] = 1" : "";

    const rowsResult = await executeQuery(`
      SELECT [Area], [Colonies]
      FROM ${qualifiedTable}
      ${whereClause}
      ORDER BY [Area] ASC
    `);

    const merged = new Map<string, Set<string>>();

    for (const row of rowsResult.recordset as Array<{
      Area?: string | null;
      Colonies?: unknown;
    }>) {
      const area = (row.Area || "").trim();
      if (!area) continue;
      const colonies = this.parseColonies(row.Colonies);
      if (!merged.has(area)) merged.set(area, new Set<string>());
      const current = merged.get(area)!;
      colonies.forEach((colony) => current.add(colony));
    }

    return [...merged.entries()]
      .map(([area, colonies]) => ({
        area,
        colonies: [...colonies].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.area.localeCompare(b.area));
  }

  private static parsePhotoObject(
    raw: string,
  ): {
    Exterior?: Array<{ blobId?: string; url?: string }>;
    Room?: Array<{ blobId?: string; url?: string }>;
  } | null {
    try {
      const parsed = JSON.parse(raw) as {
        Exterior?: Array<{ blobId?: string; url?: string }>;
        Room?: Array<{ blobId?: string; url?: string }>;
      };
      if (typeof parsed !== "object" || parsed === null) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private static tryExtractBlobId(photoUrl: string): string | null {
    try {
      const parsed = new URL(photoUrl);
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return null;
      return segments.slice(1).join("/");
    } catch {
      return null;
    }
  }

  private static async resolveCoverPhotoUrl(
    item: ListingItem,
  ): Promise<string | null> {
    if (!item.coverPhotoUrl) return null;
    if (item.coverPhotoUrl.includes("sig=")) return item.coverPhotoUrl;

    const photoObject = this.parsePhotoObject(item.coverPhotoUrl);
    if (photoObject) {
      const preferred =
        photoObject.Exterior?.[0] || photoObject.Room?.[0] || null;
      if (!preferred) return null;

      const resolvedBlobId = await BlobService.resolveReadableBlobId({
        listingId: item.listingId,
        blobId: preferred.blobId ?? null,
        photoUrl: preferred.url ?? null,
      });

      if (resolvedBlobId) {
        try {
          return generateReadSasUrl(resolvedBlobId);
        } catch {
          return preferred.url || null;
        }
      }
      return preferred.url || null;
    }

    const extractedBlobId = this.tryExtractBlobId(item.coverPhotoUrl);
    const resolvedBlobId = await BlobService.resolveReadableBlobId({
      listingId: item.listingId,
      blobId: extractedBlobId,
      photoUrl: item.coverPhotoUrl,
    });

    if (resolvedBlobId) {
      try {
        return generateReadSasUrl(resolvedBlobId);
      } catch {
        return item.coverPhotoUrl;
      }
    }

    return item.coverPhotoUrl;
  }

  private static async resolvePhotoUrl(input: {
    listingId: string;
    blobId?: string | null;
    photoUrl?: string | null;
  }): Promise<string | null> {
    const rawUrl = input.photoUrl?.trim() || null;
    if (rawUrl && rawUrl.includes("sig=")) return rawUrl;

    const resolvedBlobId = await BlobService.resolveReadableBlobId({
      listingId: input.listingId,
      blobId: input.blobId ?? null,
      photoUrl: rawUrl,
    });

    if (resolvedBlobId) {
      try {
        return generateReadSasUrl(resolvedBlobId);
      } catch {
        return rawUrl;
      }
    }

    return rawUrl;
  }

  private static async parsePhotoRecords(
    listingId: string,
    records: Array<{
      photoType: string | null;
      photoUrl: string | null;
      displayOrder: number | null;
    }>,
  ): Promise<ListingPhotoItem[]> {
    const output: ListingPhotoItem[] = [];

    for (const row of records) {
      if (!row.photoUrl) continue;
      const photoObject = this.parsePhotoObject(row.photoUrl);

      if (photoObject) {
        const exterior = photoObject.Exterior || [];
        const rooms = photoObject.Room || [];

        for (let i = 0; i < exterior.length; i++) {
          const candidate = exterior[i];
          const url = await this.resolvePhotoUrl({
            listingId,
            blobId: candidate?.blobId,
            photoUrl: candidate?.url,
          });
          if (!url) continue;
          output.push({
            photoType: "Exterior",
            photoUrl: url,
            displayOrder: i + 1,
          });
        }

        for (let i = 0; i < rooms.length; i++) {
          const candidate = rooms[i];
          const url = await this.resolvePhotoUrl({
            listingId,
            blobId: candidate?.blobId,
            photoUrl: candidate?.url,
          });
          if (!url) continue;
          output.push({
            photoType: "Room",
            photoUrl: url,
            displayOrder: i + 1,
          });
        }
        continue;
      }

      const url = await this.resolvePhotoUrl({
        listingId,
        photoUrl: row.photoUrl,
      });
      if (!url) continue;
      output.push({
        photoType: row.photoType === "Exterior" ? "Exterior" : "Room",
        photoUrl: url,
        displayOrder: Number(row.displayOrder ?? 1),
      });
    }

    output.sort((a, b) => {
      if (a.photoType !== b.photoType)
        return a.photoType === "Exterior" ? -1 : 1;
      return a.displayOrder - b.displayOrder;
    });

    return output;
  }
  /**
   * Helper to generate a standardized title
   */
  private static generateTitle(
    colony: string,
    furnishingTypeId: number,
  ): string {
    const fnTypeMap: Record<number, string> = {
      1: "Unfurnished",
      2: "Semi-Furnished",
      3: "Fully-Furnished",
    };
    const fnType = fnTypeMap[furnishingTypeId] || "Room";
    return `${fnType} in ${colony}`;
  }

  /**
   * Creates a single Listing
   */
  static async createSingleListing(data: CreateListingDto): Promise<string> {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    const title = this.generateTitle(
      data.location.colony,
      data.roomDetails.furnishingTypeId,
    );
    await transaction.begin();

    try {
      const listingColumns = await getCachedColumns("Listings");

      const req = new sql.Request(transaction);
      const insertColumns: string[] = [
        "LandlordId",
        "Title",
        "FloorLevelId",
        "FurnishingTypeId",
        "MaxOccupants",
        "AllowSmoking",
        "FoodPreferenceId",
        "MonthlyRent",
        "AvailableFrom",
        "AddressLine",
        "Colony",
        "City",
        "State",
        "Pincode",
        "Latitude",
        "Longitude",
      ];
      const insertParams: string[] = [
        "@LandlordId",
        "@Title",
        "@FloorLevelId",
        "@FurnishingTypeId",
        "@MaxOccupants",
        "@AllowSmoking",
        "@FoodPreferenceId",
        "@MonthlyRent",
        "@AvailableFrom",
        "@AddressLine",
        "@Colony",
        "@City",
        "@State",
        "@Pincode",
        "@Latitude",
        "@Longitude",
      ];

      req.input("LandlordId", sql.UniqueIdentifier, data.landlordId);
      req.input("Title", sql.NVarChar(200), title);
      req.input("FloorLevelId", sql.TinyInt, data.roomDetails.floorLevelId);
      req.input(
        "FurnishingTypeId",
        sql.TinyInt,
        data.roomDetails.furnishingTypeId,
      );
      req.input("MaxOccupants", sql.TinyInt, data.roomDetails.maxOccupants);
      req.input("AllowSmoking", sql.Bit, data.roomDetails.allowSmoking);
      req.input(
        "FoodPreferenceId",
        sql.TinyInt,
        data.roomDetails.foodPreferenceId,
      );
      req.input(
        "MonthlyRent",
        sql.Decimal(10, 2),
        data.roomDetails.monthlyRent,
      );
      req.input("AvailableFrom", sql.Date, data.roomDetails.availableFrom);
      req.input("AddressLine", sql.NVarChar(300), data.location.addressLine);
      req.input("Colony", sql.NVarChar(150), data.location.colony);
      req.input("City", sql.NVarChar(100), data.location.city);
      req.input("State", sql.NVarChar(100), data.location.state);
      req.input("Pincode", sql.Char(6), data.location.pincode);
      req.input("Latitude", sql.Decimal(9, 6), data.location.latitude);
      req.input("Longitude", sql.Decimal(9, 6), data.location.longitude);

      if (listingColumns.has("Description")) {
        insertColumns.push("Description");
        insertParams.push("@Description");
        req.input(
          "Description",
          sql.NVarChar(2000),
          data.roomDetails.description ?? null,
        );
      }

      if (listingColumns.has("SecurityDeposit")) {
        insertColumns.push("SecurityDeposit");
        insertParams.push("@SecurityDeposit");
        req.input(
          "SecurityDeposit",
          sql.Decimal(10, 2),
          data.roomDetails.securityDeposit ?? null,
        );
      }

      if (
        listingColumns.has("PropertyTypeId") &&
        data.roomDetails.propertyTypeId
      ) {
        insertColumns.push("PropertyTypeId");
        insertParams.push("@PropertyTypeId");
        req.input(
          "PropertyTypeId",
          sql.TinyInt,
          data.roomDetails.propertyTypeId,
        );
      }

      if (listingColumns.has("FoodLevelId") && data.roomDetails.foodLevelId) {
        insertColumns.push("FoodLevelId");
        insertParams.push("@FoodLevelId");
        req.input("FoodLevelId", sql.TinyInt, data.roomDetails.foodLevelId);
      }

      if (listingColumns.has("BedType") && data.roomDetails.bedType) {
        insertColumns.push("BedType");
        insertParams.push("@BedType");
        req.input("BedType", sql.VarChar(20), data.roomDetails.bedType);
      }

      if (
        listingColumns.has("SingleBedCount") &&
        data.roomDetails.singleBedCount !== undefined
      ) {
        insertColumns.push("SingleBedCount");
        insertParams.push("@SingleBedCount");
        req.input(
          "SingleBedCount",
          sql.TinyInt,
          data.roomDetails.singleBedCount,
        );
      }

      if (
        listingColumns.has("DoubleBedCount") &&
        data.roomDetails.doubleBedCount !== undefined
      ) {
        insertColumns.push("DoubleBedCount");
        insertParams.push("@DoubleBedCount");
        req.input(
          "DoubleBedCount",
          sql.TinyInt,
          data.roomDetails.doubleBedCount,
        );
      }

      const insertSql = `
        INSERT INTO dbo.Listings (${insertColumns.join(", ")})
        OUTPUT INSERTED.ListingId
        VALUES (${insertParams.join(", ")});
      `;

      const result = await req.query(insertSql);
      const listingId = result.recordset[0].ListingId as string;

      if (Array.isArray(data.photos) && data.photos.length > 0) {
        const photoColumns = await getCachedColumns("ListingPhotos");

        const blobIdColumn =
          [
            "BlobId",
            "BlobName",
            "StorageObjectId",
            "PhotoBlobId",
            "ExternalId",
          ].find((name) => photoColumns.has(name)) || null;

        const groupedPhotos: Record<
          "Exterior" | "Room",
          Array<{ blobId?: string; url: string }>
        > = {
          Exterior: [],
          Room: [],
        };

        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i];
          if (!photo) continue;
          let finalBlobId = photo.blobId;
          let finalUrl = photo.photoUrl;

          if (photo.blobId) {
            const moved = await BlobService.moveBlobToListingFolder(
              photo.blobId,
              listingId,
            );
            finalBlobId = moved.blobId;
            finalUrl = moved.blobUrl;
          }

          groupedPhotos[photo.photoType].push({
            ...(finalBlobId ? { blobId: finalBlobId } : {}),
            url: finalUrl,
          });
        }

        const photosJson = JSON.stringify(groupedPhotos);
        const recordType: "Room" | "Exterior" =
          groupedPhotos.Exterior.length > 0 ? "Exterior" : "Room";

        const photoReq = new sql.Request(transaction);
        photoReq.input("ListingId", sql.UniqueIdentifier, listingId);
        photoReq.input("PhotoType", sql.VarChar(10), recordType);
        photoReq.input("PhotoUrl", sql.NVarChar(sql.MAX), photosJson);
        photoReq.input("DisplayOrder", sql.TinyInt, 1);

        const photoInsertColumns = [
          "ListingId",
          "PhotoType",
          "PhotoUrl",
          "DisplayOrder",
        ];
        const photoInsertValues = [
          "@ListingId",
          "@PhotoType",
          "@PhotoUrl",
          "@DisplayOrder",
        ];

        if (blobIdColumn) {
          const folderBlobId = `listings/${listingId}`;
          photoReq.input("BlobId", sql.VarChar(300), folderBlobId);
          photoInsertColumns.push(blobIdColumn);
          photoInsertValues.push("@BlobId");
        }

        await photoReq.query(`
          INSERT INTO dbo.ListingPhotos (${photoInsertColumns.join(", ")})
          VALUES (${photoInsertValues.join(", ")})
        `);
      }

      await transaction.commit();
      return listingId;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Creates multiple Listings in a single transaction
   */
  static async createBulkListings(
    landlordId: string,
    roomsData: CreateListingDto["roomDetails"][],
    location: CreateListingDto["location"],
  ): Promise<string[]> {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
      const listingColumns = await getCachedColumns("Listings");

      const listingIds: string[] = [];

      // We use a parameterized query for each room to ensure safe inserts
      // SQL Server node driver allows loop-based request inputs directly against a transaction
      for (let i = 0; i < roomsData.length; i++) {
        const room = roomsData[i];
        if (!room) continue;
        const title = this.generateTitle(
          location.colony,
          room.furnishingTypeId,
        );

        // We must re-instantiate request per query to clear params OR use dynamically named params.
        // A fresh request object bound to the same transaction is cleaner.
        const iterReq = new sql.Request(transaction);

        iterReq.input("LandlordId", sql.UniqueIdentifier, landlordId);
        iterReq.input("Title", sql.NVarChar(200), title);
        iterReq.input("FloorLevelId", sql.TinyInt, room.floorLevelId);
        iterReq.input("FurnishingTypeId", sql.TinyInt, room.furnishingTypeId);
        iterReq.input("MaxOccupants", sql.TinyInt, room.maxOccupants);
        iterReq.input("AllowSmoking", sql.Bit, room.allowSmoking);
        iterReq.input("FoodPreferenceId", sql.TinyInt, room.foodPreferenceId);
        iterReq.input("MonthlyRent", sql.Decimal(10, 2), room.monthlyRent);
        iterReq.input("AvailableFrom", sql.Date, room.availableFrom);

        iterReq.input("AddressLine", sql.NVarChar(300), location.addressLine);
        iterReq.input("Colony", sql.NVarChar(150), location.colony);
        iterReq.input("City", sql.NVarChar(100), location.city);
        iterReq.input("State", sql.NVarChar(100), location.state);
        iterReq.input("Pincode", sql.Char(6), location.pincode);
        iterReq.input("Latitude", sql.Decimal(9, 6), location.latitude);
        iterReq.input("Longitude", sql.Decimal(9, 6), location.longitude);

        const insertColumns: string[] = [
          "LandlordId",
          "Title",
          "FloorLevelId",
          "FurnishingTypeId",
          "MaxOccupants",
          "AllowSmoking",
          "FoodPreferenceId",
          "MonthlyRent",
          "AvailableFrom",
          "AddressLine",
          "Colony",
          "City",
          "State",
          "Pincode",
          "Latitude",
          "Longitude",
        ];
        const insertParams: string[] = [
          "@LandlordId",
          "@Title",
          "@FloorLevelId",
          "@FurnishingTypeId",
          "@MaxOccupants",
          "@AllowSmoking",
          "@FoodPreferenceId",
          "@MonthlyRent",
          "@AvailableFrom",
          "@AddressLine",
          "@Colony",
          "@City",
          "@State",
          "@Pincode",
          "@Latitude",
          "@Longitude",
        ];

        if (listingColumns.has("PropertyTypeId") && room.propertyTypeId) {
          insertColumns.push("PropertyTypeId");
          insertParams.push("@PropertyTypeId");
          iterReq.input("PropertyTypeId", sql.TinyInt, room.propertyTypeId);
        }

        const result = await iterReq.query(`
          INSERT INTO dbo.Listings (${insertColumns.join(", ")})
          OUTPUT INSERTED.ListingId
          VALUES (${insertParams.join(", ")});
        `);

        listingIds.push(result.recordset[0].ListingId);
      }

      await transaction.commit();
      return listingIds;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Updates an existing listing owned by the landlord
   */
  static async updateListingById(data: UpdateListingDto): Promise<boolean> {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    const title = this.generateTitle(
      data.location.colony,
      data.roomDetails.furnishingTypeId,
    );
    await transaction.begin();

    try {
      const listingColumnsResult = await new sql.Request(transaction).query(`
        SELECT name AS ColumnName
        FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Listings')
      `);
      const listingColumns = new Set(
        listingColumnsResult.recordset.map(
          (c: { ColumnName: string }) => c.ColumnName,
        ),
      );

      const req = new sql.Request(transaction);
      req.input("ListingId", sql.UniqueIdentifier, data.listingId);
      req.input("LandlordId", sql.UniqueIdentifier, data.landlordId);
      req.input("Title", sql.NVarChar(200), title);
      req.input("FloorLevelId", sql.TinyInt, data.roomDetails.floorLevelId);
      req.input(
        "FurnishingTypeId",
        sql.TinyInt,
        data.roomDetails.furnishingTypeId,
      );
      req.input("MaxOccupants", sql.TinyInt, data.roomDetails.maxOccupants);
      req.input("AllowSmoking", sql.Bit, data.roomDetails.allowSmoking);
      req.input(
        "FoodPreferenceId",
        sql.TinyInt,
        data.roomDetails.foodPreferenceId,
      );
      req.input(
        "MonthlyRent",
        sql.Decimal(10, 2),
        data.roomDetails.monthlyRent,
      );
      req.input("AvailableFrom", sql.Date, data.roomDetails.availableFrom);
      req.input("AddressLine", sql.NVarChar(300), data.location.addressLine);
      req.input("Colony", sql.NVarChar(150), data.location.colony);
      req.input("City", sql.NVarChar(100), data.location.city);
      req.input("State", sql.NVarChar(100), data.location.state);
      req.input("Pincode", sql.Char(6), data.location.pincode);
      req.input("Latitude", sql.Decimal(9, 6), data.location.latitude);
      req.input("Longitude", sql.Decimal(9, 6), data.location.longitude);

      const setClauses: string[] = [
        "Title = @Title",
        "FloorLevelId = @FloorLevelId",
        "FurnishingTypeId = @FurnishingTypeId",
        "MaxOccupants = @MaxOccupants",
        "AllowSmoking = @AllowSmoking",
        "FoodPreferenceId = @FoodPreferenceId",
        "MonthlyRent = @MonthlyRent",
        "AvailableFrom = @AvailableFrom",
        "AddressLine = @AddressLine",
        "Colony = @Colony",
        "City = @City",
        "State = @State",
        "Pincode = @Pincode",
        "Latitude = @Latitude",
        "Longitude = @Longitude",
      ];

      if (listingColumns.has("Description")) {
        setClauses.push("Description = @Description");
        req.input(
          "Description",
          sql.NVarChar(2000),
          data.roomDetails.description ?? null,
        );
      }
      if (listingColumns.has("SecurityDeposit")) {
        setClauses.push("SecurityDeposit = @SecurityDeposit");
        req.input(
          "SecurityDeposit",
          sql.Decimal(10, 2),
          data.roomDetails.securityDeposit ?? null,
        );
      }
      if (listingColumns.has("PropertyTypeId")) {
        setClauses.push("PropertyTypeId = @PropertyTypeId");
        req.input(
          "PropertyTypeId",
          sql.TinyInt,
          data.roomDetails.propertyTypeId ?? null,
        );
      }
      if (listingColumns.has("FoodLevelId")) {
        setClauses.push("FoodLevelId = @FoodLevelId");
        req.input(
          "FoodLevelId",
          sql.TinyInt,
          data.roomDetails.foodLevelId ?? null,
        );
      }
      if (listingColumns.has("BedType")) {
        setClauses.push("BedType = @BedType");
        req.input("BedType", sql.VarChar(20), data.roomDetails.bedType ?? null);
      }
      if (listingColumns.has("SingleBedCount")) {
        setClauses.push("SingleBedCount = @SingleBedCount");
        req.input(
          "SingleBedCount",
          sql.TinyInt,
          data.roomDetails.singleBedCount ?? null,
        );
      }
      if (listingColumns.has("DoubleBedCount")) {
        setClauses.push("DoubleBedCount = @DoubleBedCount");
        req.input(
          "DoubleBedCount",
          sql.TinyInt,
          data.roomDetails.doubleBedCount ?? null,
        );
      }
      if (listingColumns.has("UpdatedAt")) {
        setClauses.push("UpdatedAt = SYSUTCDATETIME()");
      }

      const updateSql = `
        UPDATE dbo.Listings
        SET ${setClauses.join(", ")}
        WHERE ListingId = @ListingId AND LandlordId = @LandlordId
      `;

      const result = await req.query(updateSql);
      const updated = (result.rowsAffected?.[0] || 0) > 0;
      if (!updated) {
        await transaction.rollback();
        return false;
      }

      if (Array.isArray(data.photos)) {
        const photoColumnsResult = await new sql.Request(transaction).query(`
          SELECT name AS ColumnName
          FROM sys.columns
          WHERE object_id = OBJECT_ID('dbo.ListingPhotos')
        `);
        const photoColumns = new Set(
          photoColumnsResult.recordset.map(
            (c: { ColumnName: string }) => c.ColumnName,
          ),
        );
        const blobIdColumn =
          [
            "BlobId",
            "BlobName",
            "StorageObjectId",
            "PhotoBlobId",
            "ExternalId",
          ].find((name) => photoColumns.has(name)) || null;

        await new sql.Request(transaction)
          .input("ListingId", sql.UniqueIdentifier, data.listingId)
          .query(`DELETE FROM dbo.ListingPhotos WHERE ListingId = @ListingId`);

        if (data.photos.length > 0) {
          const groupedPhotos: Record<
            "Exterior" | "Room",
            Array<{ blobId?: string; url: string }>
          > = {
            Exterior: [],
            Room: [],
          };

          for (let i = 0; i < data.photos.length; i++) {
            const photo = data.photos[i];
            if (!photo) continue;
            let finalBlobId = photo.blobId;
            let finalUrl = photo.photoUrl;
            if (photo.blobId) {
              const moved = await BlobService.moveBlobToListingFolder(
                photo.blobId,
                data.listingId,
              );
              finalBlobId = moved.blobId;
              finalUrl = moved.blobUrl;
            }
            groupedPhotos[photo.photoType].push({
              ...(finalBlobId ? { blobId: finalBlobId } : {}),
              url: finalUrl,
            });
          }

          const photosJson = JSON.stringify(groupedPhotos);
          const recordType: "Room" | "Exterior" =
            groupedPhotos.Exterior.length > 0 ? "Exterior" : "Room";

          const photoReq = new sql.Request(transaction);
          photoReq.input("ListingId", sql.UniqueIdentifier, data.listingId);
          photoReq.input("PhotoType", sql.VarChar(10), recordType);
          photoReq.input("PhotoUrl", sql.NVarChar(sql.MAX), photosJson);
          photoReq.input("DisplayOrder", sql.TinyInt, 1);

          const photoInsertColumns = [
            "ListingId",
            "PhotoType",
            "PhotoUrl",
            "DisplayOrder",
          ];
          const photoInsertValues = [
            "@ListingId",
            "@PhotoType",
            "@PhotoUrl",
            "@DisplayOrder",
          ];

          if (blobIdColumn) {
            const folderBlobId = `listings/${data.listingId}`;
            photoReq.input("BlobId", sql.VarChar(300), folderBlobId);
            photoInsertColumns.push(blobIdColumn);
            photoInsertValues.push("@BlobId");
          }

          await photoReq.query(`
            INSERT INTO dbo.ListingPhotos (${photoInsertColumns.join(", ")})
            VALUES (${photoInsertValues.join(", ")})
          `);
        }
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Returns all active listings with pagination
   */
  static async getAllListings(
    page: number,
    limit: number,
    filters: ListingFilters = {},
  ): Promise<{ items: ListingItem[]; total: number }> {
    const pool = await getPool();
    const offset = (page - 1) * limit;

    const listingsColumns = await getCachedColumns("Listings");
    const hasPropertyTypeId = listingsColumns.has("PropertyTypeId");

    const usersColumns = await getCachedColumns("Users");
    const hasUserGender = usersColumns.has("Gender");

    const whereClauses: string[] = ["l.StatusId = 1"];
    const sortBy = filters.sortBy ?? "newest";

    const searchKeywords = (filters.search ?? "")
      .trim()
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 8);

    if (searchKeywords.length > 0) {
      const searchTokenClauses = searchKeywords.map(
        (_, idx) => `(
          l.Title LIKE @Search${idx}
          OR ISNULL(l.Description, '') LIKE @Search${idx}
          OR l.AddressLine LIKE @Search${idx}
          OR l.Colony LIKE @Search${idx}
          OR l.City LIKE @Search${idx}
          OR l.State LIKE @Search${idx}
          OR l.Pincode LIKE @Search${idx}
          OR u.FullName LIKE @Search${idx}
          OR fl.FloorName LIKE @Search${idx}
          OR ft.FurnishingName LIKE @Search${idx}
          OR fp.PreferenceName LIKE @Search${idx}
          ${
            hasPropertyTypeId
              ? `OR (
            CASE
              WHEN l.PropertyTypeId = 1 THEN 'PG'
              WHEN l.PropertyTypeId = 2 THEN 'Individual'
              WHEN l.PropertyTypeId = 3 THEN 'Flat'
              ELSE ''
            END
          ) LIKE @Search${idx}`
              : ""
          }
          OR REPLACE(l.Title, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(ISNULL(l.Description, ''), ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(l.AddressLine, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(l.Colony, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(l.City, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(l.State, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(l.Pincode, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(u.FullName, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(fl.FloorName, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(ft.FurnishingName, ' ', '') LIKE @SearchCompact${idx}
          OR REPLACE(fp.PreferenceName, ' ', '') LIKE @SearchCompact${idx}
        )`,
      );

      whereClauses.push(`(${searchTokenClauses.join(" OR ")})`);
    }
    if (filters.city && filters.city.trim()) {
      whereClauses.push("l.City = @City");
    }
    if (
      typeof filters.minRent === "number" &&
      Number.isFinite(filters.minRent)
    ) {
      whereClauses.push("l.MonthlyRent >= @MinRent");
    }
    if (
      typeof filters.maxRent === "number" &&
      Number.isFinite(filters.maxRent)
    ) {
      whereClauses.push("l.MonthlyRent <= @MaxRent");
    }
    const uniqueMaxOccupants = [
      ...new Set((filters.maxOccupants ?? []).filter(Number.isFinite)),
    ];
    const uniqueFloorLevelIds = [
      ...new Set((filters.floorLevelId ?? []).filter(Number.isFinite)),
    ];
    const uniqueFurnishingTypeIds = [
      ...new Set((filters.furnishingTypeId ?? []).filter(Number.isFinite)),
    ];
    const uniqueFoodPreferenceIds = [
      ...new Set((filters.foodPreferenceId ?? []).filter(Number.isFinite)),
    ];
    const uniquePropertyTypeIds = [
      ...new Set((filters.propertyTypeId ?? []).filter(Number.isFinite)),
    ];
    const uniqueGender = [
      ...new Set(
        (filters.gender ?? []).map((item) => item.trim().toLowerCase()),
      ),
    ]
      .filter((item) => item === "male" || item === "female")
      .map((item) => (item === "male" ? "Male" : "Female"));
    const uniqueAllowSmoking = [...new Set(filters.allowSmoking ?? [])];

    if (uniqueMaxOccupants.length > 0) {
      whereClauses.push(
        `l.MaxOccupants IN (${uniqueMaxOccupants.map((_, idx) => `@MaxOccupants${idx}`).join(", ")})`,
      );
    }
    if (uniqueFloorLevelIds.length > 0) {
      whereClauses.push(
        `l.FloorLevelId IN (${uniqueFloorLevelIds.map((_, idx) => `@FloorLevelId${idx}`).join(", ")})`,
      );
    }
    if (uniqueFurnishingTypeIds.length > 0) {
      whereClauses.push(
        `l.FurnishingTypeId IN (${uniqueFurnishingTypeIds
          .map((_, idx) => `@FurnishingTypeId${idx}`)
          .join(", ")})`,
      );
    }
    if (uniqueFoodPreferenceIds.length > 0) {
      whereClauses.push(
        `l.FoodPreferenceId IN (${uniqueFoodPreferenceIds
          .map((_, idx) => `@FoodPreferenceId${idx}`)
          .join(", ")})`,
      );
    }
    if (hasPropertyTypeId && uniquePropertyTypeIds.length > 0) {
      whereClauses.push(
        `l.PropertyTypeId IN (${uniquePropertyTypeIds
          .map((_, idx) => `@PropertyTypeId${idx}`)
          .join(", ")})`,
      );
    }
    if (hasUserGender && uniqueGender.length > 0) {
      whereClauses.push(
        `u.Gender IN (${uniqueGender.map((_, idx) => `@Gender${idx}`).join(", ")})`,
      );
    }
    if (uniqueAllowSmoking.length > 0) {
      whereClauses.push(
        `l.AllowSmoking IN (${uniqueAllowSmoking.map((_, idx) => `@AllowSmoking${idx}`).join(", ")})`,
      );
    }
    if (filters.landlordId) {
      whereClauses.push("l.LandlordId = @LandlordId");
    }

    const applyFilterParams = (request: sql.Request) => {
      searchKeywords.forEach((keyword, idx) => {
        request.input(`Search${idx}`, sql.NVarChar(160), `%${keyword}%`);
        request.input(
          `SearchCompact${idx}`,
          sql.NVarChar(160),
          `%${keyword.replace(/\s+/g, "")}%`,
        );
      });

      if (filters.city && filters.city.trim()) {
        request.input("City", sql.NVarChar(100), filters.city.trim());
      }

      if (
        typeof filters.minRent === "number" &&
        Number.isFinite(filters.minRent)
      ) {
        request.input("MinRent", sql.Decimal(10, 2), filters.minRent);
      }

      if (
        typeof filters.maxRent === "number" &&
        Number.isFinite(filters.maxRent)
      ) {
        request.input("MaxRent", sql.Decimal(10, 2), filters.maxRent);
      }

      uniqueMaxOccupants.forEach((value, idx) => {
        request.input(`MaxOccupants${idx}`, sql.TinyInt, value);
      });
      uniqueFloorLevelIds.forEach((value, idx) => {
        request.input(`FloorLevelId${idx}`, sql.TinyInt, value);
      });
      uniqueFurnishingTypeIds.forEach((value, idx) => {
        request.input(`FurnishingTypeId${idx}`, sql.TinyInt, value);
      });
      uniqueFoodPreferenceIds.forEach((value, idx) => {
        request.input(`FoodPreferenceId${idx}`, sql.TinyInt, value);
      });
      if (hasPropertyTypeId) {
        uniquePropertyTypeIds.forEach((value, idx) => {
          request.input(`PropertyTypeId${idx}`, sql.TinyInt, value);
        });
      }
      if (hasUserGender) {
        uniqueGender.forEach((value, idx) => {
          request.input(`Gender${idx}`, sql.VarChar(10), value);
        });
      }
      uniqueAllowSmoking.forEach((value, idx) => {
        request.input(`AllowSmoking${idx}`, sql.Bit, value);
      });
      if (filters.landlordId) {
        request.input("LandlordId", sql.UniqueIdentifier, filters.landlordId);
      }
    };

    const sortClause =
      sortBy === "rent_asc"
        ? "l.MonthlyRent ASC"
        : sortBy === "rent_desc"
          ? "l.MonthlyRent DESC"
          : "l.CreatedAt DESC";

    const whereSql = whereClauses.join(" AND ");

    const totalReq = pool.request();
    applyFilterParams(totalReq);
    const totalResult = await totalReq.query(`
      SELECT COUNT(1) AS TotalCount
      FROM dbo.Listings l
      JOIN dbo.Users u ON u.UserId = l.LandlordId
      JOIN dbo.FloorLevels fl ON fl.FloorLevelId = l.FloorLevelId
      JOIN dbo.FurnishingTypes ft ON ft.FurnishingTypeId = l.FurnishingTypeId
      JOIN dbo.FoodPreferences fp ON fp.FoodPreferenceId = l.FoodPreferenceId
      WHERE ${whereSql}
    `);

    const listReq = pool.request();
    applyFilterParams(listReq);
    listReq.input("Offset", sql.Int, offset);
    listReq.input("Limit", sql.Int, limit);

    const result = await listReq.query(`
        SELECT
          l.ListingId AS listingId,
          l.LandlordId AS landlordId,
          u.FullName AS landlordName,
          ${hasUserGender ? "u.Gender" : "NULL"} AS landlordGender,
          l.Title AS title,
          l.Description AS description,
          l.FloorLevelId AS floorLevelId,
          fl.FloorName AS floorName,
          l.FurnishingTypeId AS furnishingTypeId,
          ft.FurnishingName AS furnishingName,
          l.MaxOccupants AS maxOccupants,
          l.AllowSmoking AS allowSmoking,
          l.FoodPreferenceId AS foodPreferenceId,
          fp.PreferenceName AS foodPreferenceName,
          ${hasPropertyTypeId ? "l.PropertyTypeId" : "NULL"} AS propertyTypeId,
          l.MonthlyRent AS monthlyRent,
          l.SecurityDeposit AS securityDeposit,
          CONVERT(VARCHAR(10), l.AvailableFrom, 23) AS availableFrom,
          l.AddressLine AS addressLine,
          l.Colony AS colony,
          l.City AS city,
          l.State AS state,
          l.Pincode AS pincode,
          l.Latitude AS latitude,
          l.Longitude AS longitude,
          l.StatusId AS statusId,
          l.CreatedAt AS createdAt,
          l.UpdatedAt AS updatedAt,
          p.PhotoUrl AS coverPhotoUrl
        FROM dbo.Listings l
        JOIN dbo.Users u ON u.UserId = l.LandlordId
        JOIN dbo.FloorLevels fl ON fl.FloorLevelId = l.FloorLevelId
        JOIN dbo.FurnishingTypes ft ON ft.FurnishingTypeId = l.FurnishingTypeId
        JOIN dbo.FoodPreferences fp ON fp.FoodPreferenceId = l.FoodPreferenceId
        OUTER APPLY (
          SELECT TOP 1 lp.PhotoUrl
          FROM dbo.ListingPhotos lp
          WHERE lp.ListingId = l.ListingId
          ORDER BY
            CASE WHEN lp.PhotoType = 'Exterior' THEN 0 ELSE 1 END,
            lp.DisplayOrder ASC,
            lp.UploadedAt DESC
        ) p
        WHERE ${whereSql}
        ORDER BY ${sortClause}
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
      `);

    const total = Number(totalResult.recordset[0]?.TotalCount || 0);
    const items = await Promise.all(
      (result.recordset as ListingItem[]).map(async (item) => ({
        ...item,
        coverPhotoUrl: await this.resolveCoverPhotoUrl(item),
      })),
    );

    return { items, total };
  }

  static async getListingById(
    listingId: string,
  ): Promise<ListingDetailsItem | null> {
    const pool = await getPool();

    const listingColumns = await getCachedColumns("Listings");

    const detailsReq = pool.request();
    detailsReq.input("ListingId", sql.UniqueIdentifier, listingId);

    const detailResult = await detailsReq.query(`
      SELECT TOP 1
        l.ListingId AS listingId,
        l.LandlordId AS landlordId,
        u.FullName AS landlordName,
        l.Title AS title,
        l.Description AS description,
        l.FloorLevelId AS floorLevelId,
        fl.FloorName AS floorName,
        l.FurnishingTypeId AS furnishingTypeId,
        ft.FurnishingName AS furnishingName,
        l.MaxOccupants AS maxOccupants,
        l.AllowSmoking AS allowSmoking,
        l.FoodPreferenceId AS foodPreferenceId,
        fp.PreferenceName AS foodPreferenceName,
        l.MonthlyRent AS monthlyRent,
        l.SecurityDeposit AS securityDeposit,
        CONVERT(VARCHAR(10), l.AvailableFrom, 23) AS availableFrom,
        l.AddressLine AS addressLine,
        l.Colony AS colony,
        l.City AS city,
        l.State AS state,
        l.Pincode AS pincode,
        l.Latitude AS latitude,
        l.Longitude AS longitude,
        l.StatusId AS statusId,
        l.CreatedAt AS createdAt,
        l.UpdatedAt AS updatedAt,
        ${listingColumns.has("PropertyTypeId") ? "l.PropertyTypeId" : "NULL"} AS propertyTypeId,
        ${listingColumns.has("FoodLevelId") ? "l.FoodLevelId" : "NULL"} AS foodLevelId,
        ${listingColumns.has("BedType") ? "l.BedType" : "NULL"} AS bedType,
        ${listingColumns.has("SingleBedCount") ? "l.SingleBedCount" : "NULL"} AS singleBedCount,
        ${listingColumns.has("DoubleBedCount") ? "l.DoubleBedCount" : "NULL"} AS doubleBedCount
      FROM dbo.Listings l
      JOIN dbo.Users u ON u.UserId = l.LandlordId
      JOIN dbo.FloorLevels fl ON fl.FloorLevelId = l.FloorLevelId
      JOIN dbo.FurnishingTypes ft ON ft.FurnishingTypeId = l.FurnishingTypeId
      JOIN dbo.FoodPreferences fp ON fp.FoodPreferenceId = l.FoodPreferenceId
      WHERE l.ListingId = @ListingId AND l.StatusId = 1
    `);

    if (detailResult.recordset.length === 0) return null;

    const listing = detailResult.recordset[0] as Omit<
      ListingDetailsItem,
      "photos" | "coverPhotoUrl"
    > & {
      coverPhotoUrl?: string | null;
    };

    const photosReq = pool.request();
    photosReq.input("ListingId", sql.UniqueIdentifier, listingId);
    const photosResult = await photosReq.query(`
      SELECT
        lp.PhotoType AS photoType,
        lp.PhotoUrl AS photoUrl,
        lp.DisplayOrder AS displayOrder
      FROM dbo.ListingPhotos lp
      WHERE lp.ListingId = @ListingId
      ORDER BY
        CASE WHEN lp.PhotoType = 'Exterior' THEN 0 ELSE 1 END,
        lp.DisplayOrder ASC,
        lp.UploadedAt DESC
    `);

    const photos = await this.parsePhotoRecords(
      listingId,
      photosResult.recordset as Array<{
        photoType: string | null;
        photoUrl: string | null;
        displayOrder: number | null;
      }>,
    );

    return {
      ...listing,
      coverPhotoUrl: photos[0]?.photoUrl || null,
      photos,
    };
  }
}
