const { enrichIndicatorGeolocation, isPublicIP, resolveHostnameToPublicIPs } = require('../services/intelligence/indicatorGeolocationService');
const dns = require('dns').promises;
const { activeProvider: geoProvider } = require('../services/intelligence/geolocationProvider');

jest.mock('dns', () => ({
  promises: {
    resolve4: jest.fn(),
    resolve6: jest.fn(),
  }
}));

jest.mock('../services/intelligence/geolocationProvider', () => ({
  activeProvider: {
    geolocateIP: jest.fn()
  }
}));

describe('Indicator Geolocation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isPublicIP', () => {
    it('returns false for private IPs', () => {
      expect(isPublicIP('127.0.0.1')).toBe(false);
      expect(isPublicIP('10.0.0.1')).toBe(false);
      expect(isPublicIP('192.168.1.1')).toBe(false);
      expect(isPublicIP('::1')).toBe(false);
    });

    it('returns true for public IPs', () => {
      expect(isPublicIP('8.8.8.8')).toBe(true);
      expect(isPublicIP('2001:4860:4860::8888')).toBe(true);
    });
  });

  describe('enrichIndicatorGeolocation', () => {
    it('handles direct IP successfully', async () => {
      geoProvider.geolocateIP.mockResolvedValue({
        status: 'success', country: 'US', city: 'Ashburn', latitude: 39.03, longitude: -77.5
      });
      
      const indicator = { type: 'ip', normalizedValue: '8.8.8.8', isPublicIP: true };
      const result = await enrichIndicatorGeolocation(indicator, null);
      
      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe('direct_ip');
      expect(result[0].country).toBe('US');
    });

    it('skips private IPs', async () => {
      const indicator = { type: 'ip', normalizedValue: '10.0.0.1', isPublicIP: false };
      const result = await enrichIndicatorGeolocation(indicator, null);
      
      expect(result).toHaveLength(0);
      expect(geoProvider.geolocateIP).not.toHaveBeenCalled();
    });

    it('handles domain resolution safely', async () => {
      dns.resolve4.mockResolvedValue(['8.8.8.8', '192.168.1.1']); // one public, one private
      dns.resolve6.mockResolvedValue([]);
      
      geoProvider.geolocateIP.mockResolvedValue({
        status: 'success', country: 'US', city: 'Ashburn', latitude: 39.03, longitude: -77.5
      });
      
      const indicator = { type: 'domain', normalizedValue: 'example.com' };
      const result = await enrichIndicatorGeolocation(indicator, null);
      
      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe('resolved_ip');
      expect(result[0].sourceValue).toBe('8.8.8.8');
    });

    it('handles URL resolution safely', async () => {
      dns.resolve4.mockResolvedValue(['8.8.8.8']);
      dns.resolve6.mockResolvedValue([]);
      
      geoProvider.geolocateIP.mockResolvedValue({
        status: 'success', country: 'US'
      });
      
      const indicator = { type: 'url', value: 'https://example.com/path' };
      const result = await enrichIndicatorGeolocation(indicator, null);
      
      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe('resolved_ip');
    });

    it('handles email investigation headers', async () => {
      geoProvider.geolocateIP.mockResolvedValue({
        status: 'success', country: 'US'
      });
      
      const indicator = { type: 'email', normalizedValue: 'test@example.com' };
      const investigation = {
        headers: {
          received: [
            { ipAddresses: ['192.168.1.1'] }, // private
            { ipAddresses: ['8.8.8.8'] }      // public
          ]
        }
      };
      
      const result = await enrichIndicatorGeolocation(indicator, investigation);
      
      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe('received_header_ip');
      expect(result[0].sourceValue).toBe('8.8.8.8');
    });

    it('skips hash', async () => {
      const indicator = { type: 'hash', normalizedValue: 'abcdef' };
      const result = await enrichIndicatorGeolocation(indicator, null);
      
      expect(result).toHaveLength(0);
    });

    it('handles DNS failure gracefully without crashing', async () => {
      dns.resolve4.mockRejectedValue(new Error('DNS failed'));
      dns.resolve6.mockRejectedValue(new Error('DNS failed'));
      
      const indicator = { type: 'domain', normalizedValue: 'fail.com' };
      const result = await enrichIndicatorGeolocation(indicator, null);
      
      expect(result).toHaveLength(0);
    });
  });
});
