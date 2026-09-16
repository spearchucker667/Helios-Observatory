import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatDiameter,
  formatDistance,
  formatGravity,
  formatDayLength,
  formatYearLength,
  formatMass,
  formatTemperature,
  formatTemperatureF,
  formatEccentricity,
} from "./format.ts";

describe("astronomical formatting", () => {
  it("formats diameters in metric and Earth-relative units", () => {
    assert.equal(formatDiameter(12742, "metric"), "12,742 km");
    assert.equal(formatDiameter(12742, "earth"), "1.00 Earth diameters");
    assert.equal(formatDiameter(4879, "earth"), "0.38 Earth diameters");
  });

  it("formats distances with AU and km variants", () => {
    assert.equal(formatDistance(5.2, undefined, "astronomical"), "5.20 AU");
    assert.equal(formatDistance(1, undefined, "metric"), "149.6M km");
    assert.equal(formatDistance(undefined, 384_400, "metric"), "384,400 km");
    assert.equal(formatDistance(undefined, 384_400, "astronomical"), "384,400 km");
  });

  it("formats gravity in g and m/s²", () => {
    assert.equal(formatGravity(1, "earth"), "1.00 g");
    assert.equal(formatGravity(0.38, "metric"), "3.7 m/s²");
  });

  it("formats day lengths including retrograde", () => {
    assert.equal(formatDayLength(23.93), "23 h 56 m");
    assert.equal(formatDayLength(-5832.5), "−243.0 days");
    assert.equal(formatDayLength(9.93), "9 h 56 m");
  });

  it("formats year lengths", () => {
    assert.equal(formatYearLength(87.97), "88.0 days");
    assert.equal(formatYearLength(4332.6), "11.9 years");
  });

  it("formats mass with Earth-relative default", () => {
    assert.equal(formatMass(317.8, 1898, "earth"), "317.80 × Earth");
    assert.equal(formatMass(317.8, 1898, "metric"), "1,898.00 × 10²⁴ kg");
  });

  it("formats temperatures with conversion", () => {
    assert.equal(formatTemperature(5500), "5,500 °C");
    assert.equal(formatTemperatureF(15), "59 °F");
  });

  it("formats eccentricity", () => {
    assert.equal(formatEccentricity(0.206), "0.206");
    assert.equal(formatEccentricity(undefined), "—");
  });
});
