'use strict';

const assert = require('assert');
const axios = require('axios');
const { checkRdapDomain } = require('../services/threatIntel/rdapService');

jest.mock('axios');

describe('RDAP Service Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. successful RDAP lookup', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        entities: [
          {
            roles: ['registrar'],
            vcardArray: ['vcard', [['fn', {}, 'text', 'Example Registrar']]]
          }
        ],
        events: [
          { eventAction: 'registration', eventDate: '2026-08-10T12:00:00Z' },
          { eventAction: 'expiration', eventDate: '2027-08-10T12:00:00Z' }
        ],
        status: ['clientTransferProhibited'],
        nameservers: [{ ldhName: 'ns1.example.com' }],
        links: [{ rel: 'self', href: 'https://rdap.verisign.com/com/v1/domain/example.com' }]
      }
    });

    const result = await checkRdapDomain('example.com');
    assert.strictEqual(result.state, 'success');
    assert.strictEqual(result.registrar, 'Example Registrar');
    assert.strictEqual(result.statuses[0], 'clientTransferProhibited');
    assert.strictEqual(result.nameservers[0], 'ns1.example.com');
    assert.strictEqual(result.rdapServer, 'rdap.verisign.com');
    assert.strictEqual(typeof result.registrationAgeDays, 'number');
  });

  it('2. valid normalized domain', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: {} });
    const result = await checkRdapDomain('  EXaMPLE.com  ');
    assert.strictEqual(result.domain, 'example.com');
  });

  it('3. trailing-dot normalization', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: {} });
    const result = await checkRdapDomain('example.com.');
    assert.strictEqual(result.domain, 'example.com');
  });

  it('4. missing registrar', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: {} });
    const result = await checkRdapDomain('example.com');
    assert.strictEqual(result.registrar, null);
  });

  it('5. missing creation date', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: {} });
    const result = await checkRdapDomain('example.com');
    assert.strictEqual(result.createdAt, null);
    assert.strictEqual(result.registrationAgeDays, null);
  });

  it('6. multiple nameservers', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        nameservers: [{ ldhName: 'ns1' }, { ldhName: 'ns2' }]
      }
    });
    const result = await checkRdapDomain('example.com');
    assert.deepStrictEqual(result.nameservers, ['ns1', 'ns2']);
  });

  it('7. multiple statuses', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        status: ['active', 'clientTransferProhibited']
      }
    });
    const result = await checkRdapDomain('example.com');
    assert.deepStrictEqual(result.statuses, ['active', 'clientTransferProhibited']);
  });

  it('8. registration age calculation', async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        events: [{ eventAction: 'registration', eventDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }]
      }
    });
    const result = await checkRdapDomain('example.com');
    assert.ok(result.registrationAgeDays === 4 || result.registrationAgeDays === 5); // Depends on exact time
  });

  it('9. domain not found / 404', async () => {
    axios.get.mockResolvedValueOnce({ status: 404 });
    const result = await checkRdapDomain('notfound.com');
    assert.strictEqual(result.state, 'not_observed');
  });

  it('10. unsupported TLD', async () => {
    // Unsupported often gives 404 or fails network
    axios.get.mockRejectedValueOnce({ response: { status: 404 } });
    const result = await checkRdapDomain('example.unsupported');
    assert.strictEqual(result.state, 'not_observed');
  });

  it('11. timeout', async () => {
    axios.get.mockRejectedValueOnce({ code: 'ECONNABORTED' });
    const result = await checkRdapDomain('example.com');
    assert.strictEqual(result.state, 'error');
  });

  it('12. HTTP 429', async () => {
    axios.get.mockResolvedValueOnce({ status: 429 });
    const result = await checkRdapDomain('example.com');
    assert.strictEqual(result.state, 'unavailable');
  });

  it('13. generic HTTP error', async () => {
    axios.get.mockResolvedValueOnce({ status: 500 });
    const result = await checkRdapDomain('example.com');
    assert.strictEqual(result.state, 'error');
  });

  it('14. malformed RDAP response', async () => {
    axios.get.mockResolvedValueOnce({ status: 200, data: 'not json' });
    const result = await checkRdapDomain('example.com');
    assert.strictEqual(result.state, 'error');
  });

  it('18. empty/invalid domain input', async () => {
    const result = await checkRdapDomain('');
    assert.strictEqual(result.state, 'error');
    
    const result2 = await checkRdapDomain('https://example.com');
    assert.strictEqual(result2.state, 'error');
  });
});
