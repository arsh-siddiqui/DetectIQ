'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseEmail } = require('../services/forensics/emailParser');
const { extractIocs, isPrivateIPv4, isPrivateIPv6 } = require('../services/forensics/iocExtractor');
const { analyzeAttachments } = require('../services/forensics/attachmentAnalyzer');

// Helpers


describe('Test Suite', () => {
  console.log('\n=== SECTION A: IOC Extraction ===');

  it('A1 — extract URLs, domains, and IP addresses', async () => {
    const result = extractIocs('Check out https://evil.com/login and http://192.168.1.5/admin, also contact admin@hacker.net');
    assert.ok(result.urls.has('https://evil.com/login'), 'Missing URL');
    assert.ok(result.domains.has('evil.com'), 'Missing domain');
    assert.ok(result.domains.has('hacker.net'), 'Missing domain from email');
    assert.ok(result.emailAddresses.has('admin@hacker.net'), 'Missing email');
    assert.ok(result.ipAddresses.has('192.168.1.5'), 'Missing IP');
    assert.strictEqual(result.ipAddresses.get('192.168.1.5'), 'private', 'IP should be private');
  });

  it('A2 — public vs private IP classification', async () => {
    assert.strictEqual(isPrivateIPv4('192.168.0.1'), true);
    assert.strictEqual(isPrivateIPv4('10.0.0.1'), true);
    assert.strictEqual(isPrivateIPv4('172.16.0.1'), true);
    assert.strictEqual(isPrivateIPv4('127.0.0.1'), true);
    assert.strictEqual(isPrivateIPv4('8.8.8.8'), false);
    assert.strictEqual(isPrivateIPv4('198.51.100.2'), false);
    assert.strictEqual(isPrivateIPv6('::1'), true);
    assert.strictEqual(isPrivateIPv6('fe80::1'), true);
    assert.strictEqual(isPrivateIPv6('2001:db8::1'), true); // Documentation address is special-use
  });

  console.log('\n=== SECTION B: Email Parser ===');

  const simpleEmlPath = path.join(__dirname, 'fixtures', 'simple.eml');
  const multipartEmlPath = path.join(__dirname, 'fixtures', 'multipart.eml');
  const malformedEmlPath = path.join(__dirname, 'fixtures', 'malformed.eml');

  it('B1 — Parse simple.eml (Headers, Received, Auth, Body, IOCs)', async () => {
    const buffer = fs.readFileSync(simpleEmlPath);
    const parsed = await parseEmail(buffer);
    
    assert.strictEqual(parsed.headers.from, 'attacker@evil.com');
    assert.strictEqual(parsed.headers.to, 'victim@example.com');
    assert.strictEqual(parsed.headers.subject, 'URGENT: Verify your account');
    
    // Auth
    assert.strictEqual(parsed.authentication.spf.status, 'fail');
    assert.strictEqual(parsed.authentication.dmarc.status, 'fail');

    // Received
    assert.ok(parsed.headers.received.length > 0);
    assert.strictEqual(parsed.headers.received[0].from, 'mail.evil.com (mail.evil.com [198.51.100.2])');

    // Body
    assert.ok(parsed.body.plainText.includes('verify your account immediately'));
    assert.strictEqual(parsed.body.htmlPresent, false);

    // IOCs
    assert.ok(parsed.extracted.urls.includes('http://evil.com/login'));
    assert.ok(parsed.extracted.emailAddresses.includes('attacker@evil.com'));
    
    const ips = parsed.extracted.ipAddresses.map(i => i.ip);
    assert.ok(ips.includes('198.51.100.2'));
    
    // Hash check empty
    assert.strictEqual(parsed.attachments.length, 0);
  });

  it('B2 — Parse multipart.eml (HTML and Plaintext extraction)', async () => {
    const buffer = fs.readFileSync(multipartEmlPath);
    const parsed = await parseEmail(buffer);
    
    assert.strictEqual(parsed.headers.from, 'sender@example.com');
    assert.strictEqual(parsed.headers.subject, 'Test Multipart');
    assert.strictEqual(parsed.body.htmlPresent, true);
    
    // Does not execute script
    assert.ok(parsed.body.plainText.includes('This is plain text.'));
    assert.ok(parsed.body.normalizedText.includes('this is plain text.'));
  });

  it('B3 — Parse malformed.eml gracefully', async () => {
    const buffer = fs.readFileSync(malformedEmlPath);
    const parsed = await parseEmail(buffer);
    
    assert.strictEqual(parsed.headers.from, '');
    assert.ok(parsed.body.plainText.includes('random text'));
  });

  console.log('\n=== SECTION C: Attachment Analyzer ===');

  it('C1 — Safely analyze attachments and calculate SHA-256', async () => {
    const mockAttachments = [
      {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
        content: Buffer.from('fake executable bytes')
      }
    ];

    const { attachments, hashes } = analyzeAttachments(mockAttachments);
    assert.strictEqual(attachments.length, 1);
    assert.strictEqual(attachments[0].filename, 'malware.exe');
    assert.strictEqual(attachments[0].extension, 'exe');
    assert.strictEqual(attachments[0].sizeBytes, 21);
    
    // Hash of 'fake executable bytes'
    assert.strictEqual(hashes.length, 1);
    assert.strictEqual(attachments[0].sha256, hashes[0]);
    assert.ok(hashes[0].length === 64);
  });

  });


