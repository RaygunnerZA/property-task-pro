// Frontend placeholder for generating a PDF Blob (UI only, non-functional)
export async function exportAuditPdf(html: string) {
  return new Blob([html], { type: 'application/pdf' });
}
