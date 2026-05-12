import type { Request, Response } from "express";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import EmailService from "../services/email.service.js";

// GET /admin/users?city=...&place=...
export const getAllUsers = async (req: Request, res: Response) => {
  const { city, place, page = 1, limit = 20 } = req.query;
  const filter: any = {};
  if (city) filter.city = city;
  if (place) filter.permanentAddress = { $regex: place, $options: "i" };
  try {
    const users = await User.find(filter)
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .lean();
    const total = await User.countDocuments(filter);
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// GET /admin/properties?city=...&colony=...&area=...
export const getAllProperties = async (req: Request, res: Response) => {
  const { city, colony, area, page = 1, limit = 20 } = req.query;
  const filter: any = {};
  if (city) filter.city = city;
  if (colony) filter.colony = { $regex: colony, $options: "i" };
  if (area) filter.addressLine = { $regex: area, $options: "i" };
  try {
    const properties = await Listing.find(filter)
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .lean();
    const total = await Listing.countDocuments(filter);
    res.json({ properties, total });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
};

export const getEmailLogSummary = async (_req: Request, res: Response) => {
  try {
    const summary = await EmailService.getSummary();
    res.json(summary);
  } catch {
    res.status(500).json({ error: "Failed to fetch email log summary" });
  }
};

export const getEmailLogs = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  try {
    const { items, total } = await EmailService.getRecent(page, limit);
    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch email logs" });
  }
};
