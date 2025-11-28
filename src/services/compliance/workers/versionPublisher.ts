import { ruleBuilder } from '../ruleBuilder';

export async function runVersionPublisher(ruleId: string, orgId: string) {
  return ruleBuilder.publishVersion(ruleId, orgId);
}
