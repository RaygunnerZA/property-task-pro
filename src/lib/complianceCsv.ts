export function generateComplianceCsv(data: any[]) {
  const header = 'property,rule,version,status,updated_at';
  const rows = data.map(d => [
    d.property_name,
    d.rule_name,
    d.version,
    d.status,
    d.updated_at,
  ].join(','));
  return [header, ...rows].join('\n');
}
