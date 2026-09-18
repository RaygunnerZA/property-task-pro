import { describe, expect, it } from "vitest";
import {
  extractCountryAndPostcode,
  extractCountryCode,
  extractPostalCode,
} from "../../../../supabase/functions/_shared/enrichment/addressComponents";
import {
  isEnglandWalesPostcode,
  isWithinCooldown,
  mapDomesticSearchRow,
  postcodeArea,
  shouldLookupUkEpc,
} from "../../../../supabase/functions/_shared/enrichment/ukEpc";

describe("postcodeArea", () => {
  it("reads one- and two-letter outward areas", () => {
    expect(postcodeArea("SW1A 1AA")).toBe("SW");
    expect(postcodeArea("G1 1AA")).toBe("G");
    expect(postcodeArea("gl1 2ab")).toBe("GL");
  });
});

describe("isEnglandWalesPostcode", () => {
  it("accepts England and Wales postcodes", () => {
    expect(isEnglandWalesPostcode("SW1A 1AA")).toBe(true);
    expect(isEnglandWalesPostcode("CF10 1EP")).toBe(true);
    expect(isEnglandWalesPostcode("M1 1AE")).toBe(true);
    expect(isEnglandWalesPostcode("GL1 2AB")).toBe(true);
  });

  it("rejects Scotland and Northern Ireland", () => {
    expect(isEnglandWalesPostcode("EH1 1YZ")).toBe(false);
    expect(isEnglandWalesPostcode("G1 1AA")).toBe(false);
    expect(isEnglandWalesPostcode("BT1 5GS")).toBe(false);
  });
});

describe("shouldLookupUkEpc", () => {
  it("looks up GB England/Wales only", () => {
    expect(shouldLookupUkEpc({ countryCode: "GB", postalCode: "SW1A 1AA" })).toBe(true);
    expect(shouldLookupUkEpc({ countryCode: "UK", postalCode: "SW1A 1AA" })).toBe(true);
  });

  it("skips France, Scotland, and missing postcode", () => {
    expect(shouldLookupUkEpc({ countryCode: "FR", postalCode: "75001" })).toBe(false);
    expect(shouldLookupUkEpc({ countryCode: "GB", postalCode: "EH8 8DX" })).toBe(false);
    expect(shouldLookupUkEpc({ countryCode: "GB", postalCode: null })).toBe(false);
  });
});

describe("mapDomesticSearchRow", () => {
  it("normalises known fields and ignores extras", () => {
    const mapped = mapDomesticSearchRow({
      "lmk-key": "123-abc",
      "current-energy-rating": "C",
      "current-energy-efficiency": "69",
      "potential-energy-rating": "B",
      "potential-energy-efficiency": 81,
      "total-floor-area": 142.4,
      "property-type": "House",
      "built-form": "Detached",
      "construction-age-band": "1967-1975",
      "lodgement-date": "2024-03-01",
      address: "1 Example Street",
      "local-authority": "E09000001",
    });

    expect(mapped.sourceId).toBe("123-abc");
    expect(mapped.facts).toEqual({
      current_rating: "C",
      current_efficiency: 69,
      potential_rating: "B",
      potential_efficiency: 81,
      floor_area: 142.4,
      property_type: "House",
      built_form: "Detached",
      construction_age_band: "1967-1975",
      lodgement_date: "2024-03-01",
    });
    expect(mapped.facts).not.toHaveProperty("address");
    expect(mapped.facts).not.toHaveProperty("local-authority");
  });

  it("maps the MHCLG Bearer API search/detail fields", () => {
    const mapped = mapDomesticSearchRow({
      certificateNumber: "1111-2222-3333-4444-5555",
      currentEnergyEfficiencyBand: "C",
      registrationDate: "2024-03-01",
      postTown: "London",
    });
    expect(mapped.sourceId).toBe("1111-2222-3333-4444-5555");
    expect(mapped.facts).toEqual({
      current_rating: "C",
      lodgement_date: "2024-03-01",
    });
  });

  it("does not treat integer SAP codes as labels", () => {
    const mapped = mapDomesticSearchRow({
      certificate_number: "1111-2222-3333-4444-5555",
      current_energy_efficiency_band: "D",
      property_type: "2",
      built_form: 4,
    });
    expect(mapped.facts.current_rating).toBe("D");
    expect(mapped.facts.property_type).toBeUndefined();
    expect(mapped.facts.built_form).toBeUndefined();
  });

  it("handles empty rows", () => {
    expect(mapDomesticSearchRow(null)).toEqual({ sourceId: null, facts: {} });
    expect(mapDomesticSearchRow({})).toEqual({ sourceId: null, facts: {} });
  });
});

describe("extractCountryAndPostcode", () => {
  it("reads Geocoder address components", () => {
    expect(
      extractCountryCode([
        { long_name: "United Kingdom", short_name: "GB", types: ["country", "political"] },
      ])
    ).toBe("GB");
    expect(
      extractPostalCode([{ long_name: "SW1A 1AA", short_name: "SW1A 1AA", types: ["postal_code"] }])
    ).toBe("SW1A 1AA");
  });

  it("reads Places New shortText/longText and maps UK to GB", () => {
    const parsed = extractCountryAndPostcode([
      { longText: "United Kingdom", shortText: "UK", types: ["country"] },
      { longText: "EH1 1YZ", shortText: "EH1 1YZ", types: ["postal_code"] },
    ]);
    expect(parsed).toEqual({ countryCode: "GB", postalCode: "EH1 1YZ" });
  });
});

describe("isWithinCooldown", () => {
  it("skips a recent found lookup", () => {
    const now = Date.parse("2026-09-17T12:00:00.000Z");
    expect(isWithinCooldown("2026-09-17T01:00:00.000Z", now)).toBe(true);
    expect(isWithinCooldown("2026-09-16T11:00:00.000Z", now)).toBe(false);
  });
});
