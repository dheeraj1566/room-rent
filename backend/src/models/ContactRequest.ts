import mongoose, { Schema, type Document } from "mongoose";

export interface IContactRequest extends Document {
  tenantId: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;
  message?: string;
  occupants?: number;
  rentPayments: {
    month: string;
    paymentStatus: "OnTime" | "Late";
    markedAt: Date;
    updateCount: number;
    paymentSlipUrl?: string;
    paymentSlipBlobId?: string;
  }[];
  status: "Pending" | "Accepted" | "Rejected";
  isConnected: boolean;
  createdAt: Date;
  respondedAt?: Date;
}

const rentPaymentSchema = new Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    paymentStatus: { type: String, enum: ["OnTime", "Late"], required: true },
    markedAt: { type: Date, default: Date.now },
    updateCount: { type: Number, default: 0, min: 0, max: 1 },
    paymentSlipUrl: { type: String, trim: true },
    paymentSlipBlobId: { type: String, trim: true },
  },
  { _id: false }
);

const contactRequestSchema = new Schema<IContactRequest>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    landlordId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, trim: true },
    occupants: { type: Number, min: 1 },
    rentPayments: { type: [rentPaymentSchema], default: [] },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },
    isConnected: { type: Boolean, default: false },
    respondedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

contactRequestSchema.index({ landlordId: 1, status: 1 });
contactRequestSchema.index({ tenantId: 1, createdAt: -1 });

export const ContactRequest = mongoose.model<IContactRequest>(
  "ContactRequest",
  contactRequestSchema
);
export default ContactRequest;
