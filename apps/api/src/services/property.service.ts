import { createProperty, editProperty, getPropertyById, getPropertyMeta, listProperties, softDeleteProperty } from "@rent/db";
import type { PropertyInput } from "@rent/shared";

export async function createPropertyRecord(property: PropertyInput) {
  await createProperty(property);
}

export async function getPropertyMetadataRecord() {
  return getPropertyMeta();
}

export async function listPropertyRecords(userId?: string) {
  return listProperties(userId);
}

export async function getPropertyRecord(propertyId: string) {
  return getPropertyById(propertyId);
}

export async function updatePropertyRecord(propertyId: string, property: PropertyInput) {
  await editProperty(propertyId, property);
}

export async function deletePropertyRecord(propertyId: string) {
  await softDeleteProperty(propertyId);
}
