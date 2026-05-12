import mongoose, { Schema, type Document } from "mongoose";

export interface IEmailLog extends Document {
  provider: string;
  purpose: string;
  from: string;
  to: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string;
  acceptedRecipients: string[];
  rejectedRecipients: string[];
  errorMessage?: string;
  relatedUserId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const emailLogSchema = new Schema<IEmailLog>(
  {
    provider: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true, index: true },
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true, index: true },
    subject: { type: String, required: true, trim: true },
    status: { type: String, enum: ["sent", "failed", "skipped"], required: true, index: true },
    providerMessageId: { type: String, trim: true },
    acceptedRecipients: { type: [String], default: [] },
    rejectedRecipients: { type: [String], default: [] },
    errorMessage: { type: String, trim: true },
    relatedUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

emailLogSchema.index({ createdAt: -1, status: 1 });

export const EmailLog = mongoose.model<IEmailLog>("EmailLog", emailLogSchema);
export default EmailLog;
