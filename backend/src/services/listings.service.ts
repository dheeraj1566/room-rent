import sql from "mssql";
import { getPool } from "../config/db";
import type { ParsedAddress } from "./googleMaps.service";

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
    displayOrder?: number;
  }[];
  location: ParsedAddress & { latitude: number; longitude: number };
}

export interface ListingItem {
  listingId: string;
  landlordId: string;
  landlordName: string;
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
}

export class ListingsService {
  /**
   * Helper to generate a standardized title
   */
  private static generateTitle(colony: string, furnishingTypeId: number): string {
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
    const title = this.generateTitle(data.location.colony, data.roomDetails.furnishingTypeId);
    await transaction.begin();

    try {
      const listingColumnsResult = await new sql.Request(transaction).query(`
        SELECT name AS ColumnName
        FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Listings')
      `);
      const listingColumns = new Set(
        listingColumnsResult.recordset.map((c: { ColumnName: string }) => c.ColumnName)
      );

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
      req.input("FurnishingTypeId", sql.TinyInt, data.roomDetails.furnishingTypeId);
      req.input("MaxOccupants", sql.TinyInt, data.roomDetails.maxOccupants);
      req.input("AllowSmoking", sql.Bit, data.roomDetails.allowSmoking);
      req.input("FoodPreferenceId", sql.TinyInt, data.roomDetails.foodPreferenceId);
      req.input("MonthlyRent", sql.Decimal(10, 2), data.roomDetails.monthlyRent);
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
        req.input("Description", sql.NVarChar(2000), data.roomDetails.description ?? null);
      }

      if (listingColumns.has("SecurityDeposit")) {
        insertColumns.push("SecurityDeposit");
        insertParams.push("@SecurityDeposit");
        req.input(
          "SecurityDeposit",
          sql.Decimal(10, 2),
          data.roomDetails.securityDeposit ?? null
        );
      }

      if (listingColumns.has("PropertyTypeId") && data.roomDetails.propertyTypeId) {
        insertColumns.push("PropertyTypeId");
        insertParams.push("@PropertyTypeId");
        req.input("PropertyTypeId", sql.TinyInt, data.roomDetails.propertyTypeId);
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

      if (listingColumns.has("SingleBedCount") && data.roomDetails.singleBedCount !== undefined) {
        insertColumns.push("SingleBedCount");
        insertParams.push("@SingleBedCount");
        req.input("SingleBedCount", sql.TinyInt, data.roomDetails.singleBedCount);
      }

      if (listingColumns.has("DoubleBedCount") && data.roomDetails.doubleBedCount !== undefined) {
        insertColumns.push("DoubleBedCount");
        insertParams.push("@DoubleBedCount");
        req.input("DoubleBedCount", sql.TinyInt, data.roomDetails.doubleBedCount);
      }

      const insertSql = `
        INSERT INTO dbo.Listings (${insertColumns.join(", ")})
        OUTPUT INSERTED.ListingId
        VALUES (${insertParams.join(", ")});
      `;

      const result = await req.query(insertSql);
      const listingId = result.recordset[0].ListingId as string;

      if (Array.isArray(data.photos) && data.photos.length > 0) {
        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i];
          if (!photo) continue;

          const photoReq = new sql.Request(transaction);
          photoReq.input("ListingId", sql.UniqueIdentifier, listingId);
          photoReq.input("PhotoType", sql.VarChar(10), photo.photoType);
          photoReq.input("PhotoUrl", sql.VarChar(500), photo.photoUrl);
          photoReq.input("DisplayOrder", sql.TinyInt, photo.displayOrder ?? i + 1);

          await photoReq.query(`
            INSERT INTO dbo.ListingPhotos (ListingId, PhotoType, PhotoUrl, DisplayOrder)
            VALUES (@ListingId, @PhotoType, @PhotoUrl, @DisplayOrder)
          `);
        }
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
    location: CreateListingDto["location"]
  ): Promise<string[]> {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();

    try {
      const listingIds: string[] = [];
      const request = new sql.Request(transaction);

      // We use a parameterized query for each room to ensure safe inserts
      // SQL Server node driver allows loop-based request inputs directly against a transaction
      for (let i = 0; i < roomsData.length; i++) {
        const room = roomsData[i];
        if (!room) continue;
        const title = this.generateTitle(location.colony, room.furnishingTypeId);

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

        const result = await iterReq.query(`
          INSERT INTO dbo.Listings (
            LandlordId, Title, FloorLevelId, FurnishingTypeId, MaxOccupants, AllowSmoking,
            FoodPreferenceId, MonthlyRent, AvailableFrom,
            AddressLine, Colony, City, State, Pincode, Latitude, Longitude
          )
          OUTPUT INSERTED.ListingId
          VALUES (
            @LandlordId, @Title, @FloorLevelId, @FurnishingTypeId, @MaxOccupants, @AllowSmoking,
            @FoodPreferenceId, @MonthlyRent, @AvailableFrom,
            @AddressLine, @Colony, @City, @State, @Pincode, @Latitude, @Longitude
          );
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
<<<<<<< Updated upstream
   * Returns all active listings with pagination
   */
  static async getAllListings(
    page: number,
    limit: number
  ): Promise<{ items: ListingItem[]; total: number }> {
    const pool = await getPool();
    const offset = (page - 1) * limit;

    const totalResult = await pool.request().query(`
      SELECT COUNT(1) AS TotalCount
      FROM dbo.Listings
      WHERE StatusId = 1
    `);

    const result = await pool
      .request()
      .input("Offset", sql.Int, offset)
      .input("Limit", sql.Int, limit)
      .query(`
        SELECT
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
          l.UpdatedAt AS updatedAt
        FROM dbo.Listings l
        JOIN dbo.Users u ON u.UserId = l.LandlordId
        JOIN dbo.FloorLevels fl ON fl.FloorLevelId = l.FloorLevelId
        JOIN dbo.FurnishingTypes ft ON ft.FurnishingTypeId = l.FurnishingTypeId
        JOIN dbo.FoodPreferences fp ON fp.FoodPreferenceId = l.FoodPreferenceId
        WHERE l.StatusId = 1
        ORDER BY l.CreatedAt DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
      `);

    const total = Number(totalResult.recordset[0]?.TotalCount || 0);
    const items = result.recordset as ListingItem[];

    return { items, total };
=======
   * Fetch all listings by landlord Id
   */
  static async getMyListings(landlordId: string) {
    const pool = await getPool();
    const result = await pool.request()
      .input("LandlordId", sql.UniqueIdentifier, landlordId)
      .query(`
        SELECT ListingId, Title, MonthlyRent, StatusId, CreatedAt, AvailableFrom, Colony
        FROM dbo.Listings
        WHERE LandlordId = @LandlordId
        ORDER BY CreatedAt DESC
      `);
    return result.recordset;
>>>>>>> Stashed changes
  }
}
