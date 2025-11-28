import { propertyCompliance } from '../propertyCompliance';

export async function runComplianceRecalculator(orgId: string, ruleId: string, latestVersionId: string) {
  return propertyCompliance.markOutdatedVersions(orgId, ruleId, latestVersionId);
}
