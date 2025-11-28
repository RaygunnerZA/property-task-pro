import { propertyCompliance } from '../propertyCompliance';

export async function runPropertyAssigner(orgId: string, versionId: string) {
  return propertyCompliance.assignVersionToAllProperties(orgId, versionId);
}
