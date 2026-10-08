import { describe, it, expect } from 'vitest';
import { indicatorToGeoPoint, normalizeVTState } from './intelligenceMapping';

describe('intelligenceMapping utils', () => {
  describe('indicatorToGeoPoint', () => {
    it('should map a synthetic indicator with full valid data', () => {
      const indicator = {
        type: "ip",
        value: "54.39.40.4",
        geolocation: {
          status: "success",
          country: "Canada",
          city: "Beauharnois",
          isp: "OVH SAS",
          asn: "AS16276",
          lat: 45.3168,
          lon: -73.8779
        }
      };

      const geoPoint = indicatorToGeoPoint(indicator);
      expect(geoPoint).toMatchObject({
        ip: "54.39.40.4",
        latitude: 45.3168,
        longitude: -73.8779,
        country: "Canada",
        city: "Beauharnois",
        asn: "AS16276",
        isp: "OVH SAS",
        threat: "unknown"
      });
    });

    it('should handle undefined coordinates', () => {
      const indicator = {
        type: "ip",
        value: "1.1.1.1",
        geolocation: { status: "success", lat: undefined, lon: undefined }
      };
      expect(indicatorToGeoPoint(indicator)).toBeNull();
    });

    it('should normalize valid numeric strings', () => {
      const indicator = {
        type: "ip",
        value: "1.1.1.1",
        geolocation: { status: "success", lat: "45.3", lon: "-73.8" }
      };
      const geoPoint = indicatorToGeoPoint(indicator);
      expect(geoPoint.latitude).toBe(45.3);
      expect(geoPoint.longitude).toBe(-73.8);
    });

    it('should reject invalid numeric strings', () => {
      const indicator = {
        type: "ip",
        value: "1.1.1.1",
        geolocation: { status: "success", lat: "invalid", lon: -73 }
      };
      expect(indicatorToGeoPoint(indicator)).toBeNull();
    });

    it('should reject out-of-range coordinates', () => {
      expect(indicatorToGeoPoint({ type: "ip", value: "x", geolocation: { lat: 91, lon: 0 } })).toBeNull();
      expect(indicatorToGeoPoint({ type: "ip", value: "x", geolocation: { lat: 0, lon: 181 } })).toBeNull();
      expect(indicatorToGeoPoint({ type: "ip", value: "x", geolocation: { lat: -91, lon: 0 } })).toBeNull();
      expect(indicatorToGeoPoint({ type: "ip", value: "x", geolocation: { lat: 0, lon: -181 } })).toBeNull();
    });

    it('should exclude private IPs from map', () => {
      expect(indicatorToGeoPoint({ type: "ip", isPublicIP: false, value: "10.0.0.5", geolocation: { lat: 0, lon: 0 } })).toBeNull();
      expect(indicatorToGeoPoint({ type: "private", value: "192.168.1.10", geolocation: { lat: 0, lon: 0 } })).toBeNull();
    });

    it('should handle investigation geoPoints structure natively', () => {
      const indicator = {
        type: "ip",
        value: "8.8.8.8",
        geolocation: {
          status: "success",
          latitude: 10,
          longitude: 20
        }
      };
      const result = indicatorToGeoPoint(indicator);
      expect(result.latitude).toBe(10);
      expect(result.longitude).toBe(20);
    });
  });

  describe('normalizeVTState', () => {
    it('maps clean threat to Clean state', () => {
      const vt = { provider: "virustotal", status: "available", threat: "clean" };
      expect(normalizeVTState(vt)).toEqual({ state: 'clean', label: 'Clean' });
    });

    it('maps malicious threat to Malicious state', () => {
      const vt = { provider: "virustotal", status: "available", threat: "malicious" };
      expect(normalizeVTState(vt)).toEqual({ state: 'malicious', label: 'Malicious' });
    });

    it('maps suspicious threat to Suspicious state', () => {
      const vt = { provider: "virustotal", status: "available", threat: "suspicious" };
      expect(normalizeVTState(vt)).toEqual({ state: 'suspicious', label: 'Suspicious' });
    });

    it('maps not_found state correctly', () => {
      const vt = { provider: "virustotal", status: "not_found" };
      expect(normalizeVTState(vt)).toEqual({ state: 'not_found', label: 'Not observed by provider' });
    });

    it('maps unavailable states correctly', () => {
      expect(normalizeVTState({ status: "error" })).toEqual({ state: 'unavailable', label: 'Threat intelligence unavailable' });
      expect(normalizeVTState({ status: "timeout" })).toEqual({ state: 'unavailable', label: 'Threat intelligence unavailable' });
      expect(normalizeVTState({ status: "rate_limited" })).toEqual({ state: 'unavailable', label: 'Threat intelligence unavailable' });
    });

    it('returns unconfigured if missing', () => {
      expect(normalizeVTState(null)).toEqual({ state: 'unconfigured', label: 'Not configured' });
    });
  });

  describe('buildMapGeoJSON', () => {
    const { buildMapGeoJSON } = require('./intelligenceMapping');

    it('handles empty geoPoints', () => {
      const geojson = buildMapGeoJSON([]);
      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toEqual([]);
    });

    it('handles single geoPoint with valid coordinates', () => {
      const geoPoints = [{ ip: '8.8.8.8', latitude: 37.386, longitude: -122.0838, threat: 'clean' }];
      const geojson = buildMapGeoJSON(geoPoints);
      
      expect(geojson.features).toHaveLength(1);
      expect(geojson.features[0].geometry.coordinates).toEqual([-122.0838, 37.386]);
      expect(geojson.features[0].properties.ip).toBe('8.8.8.8');
      expect(geojson.features[0].properties.threat).toBe('clean');
    });

    it('handles multiple geoPoints and forms cluster input', () => {
      const geoPoints = [
        { ip: '8.8.8.8', latitude: 37, longitude: -122 },
        { ip: '1.1.1.1', latitude: -30, longitude: 150, threat: 'malicious' }
      ];
      const geojson = buildMapGeoJSON(geoPoints);
      
      expect(geojson.features).toHaveLength(2);
      expect(geojson.features[0].properties.threat).toBe('unknown'); // default
      expect(geojson.features[1].properties.threat).toBe('malicious');
    });

    it('filters out invalid and out-of-range coordinates', () => {
      const geoPoints = [
        { ip: '1.1.1.1', latitude: 'invalid', longitude: 150 },
        { ip: '2.2.2.2', latitude: 91, longitude: 0 },
        { ip: '3.3.3.3', latitude: 0, longitude: 181 },
        { ip: '4.4.4.4', latitude: 37, longitude: -122 } // valid
      ];
      const geojson = buildMapGeoJSON(geoPoints);
      
      expect(geojson.features).toHaveLength(1);
      expect(geojson.features[0].properties.ip).toBe('4.4.4.4');
    });
  });
});
