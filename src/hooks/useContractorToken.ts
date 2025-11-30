export function useContractorToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("contractor_token");
}
