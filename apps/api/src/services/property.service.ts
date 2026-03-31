<<<<<<< HEAD
import { createProperty, editProperty, getPropertyById, getPropertyMeta, listProperties, softDeleteProperty } from "@rent/db";
=======
import { createProperty, editProperty, getPropertyById, listProperties, softDeleteProperty } from "@rent/db";
>>>>>>> 690f2eb6a173916d79eb7352294287178a80d61e
import type { PropertyInput } from "@rent/shared";

export async function createPropertyRecord(property: PropertyInput) {
  await createProperty(property);
}

<<<<<<< HEAD
export async function getPropertyMetadataRecord() {
  return getPropertyMeta();
}

=======
>>>>>>> 690f2eb6a173916d79eb7352294287178a80d61e
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
