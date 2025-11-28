import { tryCatch } from '../../lib/async';
import { versioningService } from './versioning';
import { propertyCompliance } from './propertyCompliance';

export const ruleBuilder = {
  async publishVersion(ruleId: string, orgId: string) {
    return tryCatch(async () => {
      const { data: version } = await versioningService.createVersion(ruleId, orgId);
      if (!version) throw new Error('Failed to create version.');

      await propertyCompliance.assignVersionToAllProperties(orgId, version.id);

      return version;
    });
  }
};
