import { tryCatch } from '../../lib/async';
import { complianceRules } from './rules';
import { versioningService } from './versioning';
import { complianceClauses } from './clauses';

export const ruleBuilder = {
  async publishVersion(ruleId: string, orgId: string) {
    return tryCatch(async () => {
      const { data: version } = await versioningService.createVersion(ruleId, orgId);
      if (!version) throw new Error('Failed to create version.');

      await complianceClauses.bindClausesToVersion(ruleId, version.id);

      await complianceRules.updateRuleStatus(ruleId, 'approved');

      return version;
    });
  }
};
