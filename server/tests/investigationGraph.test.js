'use strict';

const assert = require('assert');
const { generateInvestigationGraph } = require("../services/intelligence/investigationGraph");

describe('Test Suite: Investigation Graph generation', () => {

  const generateMockMap = (obj) => ({
    get: (key) => obj[key],
    has: (key) => key in obj,
    keys: () => Object.keys(obj)
  });

  const getGraph = (investigationOverrides = {}, indicatorsOverrides = []) => {
    const inv = {
      _id: "inv12345",
      headers: {
        subject: "Test",
        ...investigationOverrides.headers
      },
      ...investigationOverrides
    };
    return generateInvestigationGraph(inv, indicatorsOverrides);
  };

  const getEdge = (graph, source, target, relation) => {
    return graph.edges.find(e => e.source === source && e.target === target && e.relation === relation);
  };

  const getNode = (graph, id) => graph.nodes.find(n => n.id === id);

  it('1. Email → Sender Domain', () => {
    const graph = getGraph({ headers: { from: "Sender <sender@example.com>" } });
    assert.ok(getNode(graph, "email_doc_inv12345"));
    assert.ok(getNode(graph, "domain_example.com"));
    assert.ok(getEdge(graph, "email_doc_inv12345", "domain_example.com", "sent from"));
  });

  it('2. Email → URL', () => {
    const graph = getGraph({}, [{ type: "url", normalizedValue: "http://bad.com/path" }]);
    assert.ok(getEdge(graph, "email_doc_inv12345", "url_http://bad.com/path", "contains url"));
  });

  it('3. URL → Domain (when hostname matches existing domain indicator)', () => {
    const graph = getGraph({}, [
      { type: "url", normalizedValue: "http://bad.com/path" },
      { type: "domain", normalizedValue: "bad.com" }
    ]);
    assert.ok(getEdge(graph, "url_http://bad.com/path", "domain_bad.com", "hostname"));
  });

  it('4. Domain → Resolved IP', () => {
    const graph = getGraph({}, [
      { type: "domain", normalizedValue: "bad.com" },
      { type: "ip", normalizedValue: "8.8.8.8", geolocations: [{ sourceType: "resolved_ip", sourceValue: "bad.com" }] }
    ]);
    assert.ok(getEdge(graph, "domain_bad.com", "ip_8.8.8.8", "resolves to"));
  });

  it('5. IP → Geolocation', () => {
    const graph = getGraph({}, [
      { type: "ip", normalizedValue: "8.8.8.8", geolocation: { status: "success", country: "US", city: "New York", latitude: 40, longitude: -70 } }
    ]);
    assert.ok(getNode(graph, "location_US"));
    assert.ok(getEdge(graph, "ip_8.8.8.8", "location_US", "located in"));
  });

  it('6. Indicator → Threat Intelligence', () => {
    const graph = getGraph({}, [
      { type: "ip", normalizedValue: "8.8.8.8", intelligence: generateMockMap({ virustotal: { status: "found" } }) }
    ]);
    assert.ok(getNode(graph, "threatintel_virustotal"));
    assert.ok(getEdge(graph, "ip_8.8.8.8", "threatintel_virustotal", "reported by"));
  });

  it('7. Email → Attachment', () => {
    const graph = getGraph({ attachments: [{ filename: "test.exe", sha256: "abc", sizeBytes: 100 }] });
    assert.ok(getNode(graph, "attachment_test.exe"));
    assert.ok(getEdge(graph, "email_doc_inv12345", "attachment_test.exe", "contains attachment"));
  });

  it('8. Attachment → Hash', () => {
    const graph = getGraph({ attachments: [{ filename: "test.exe", sha256: "abc", sizeBytes: 100 }] });
    assert.ok(getNode(graph, "hash_abc"));
    assert.ok(getEdge(graph, "attachment_test.exe", "hash_abc", "hash of"));
  });

  it('9. Hash → Threat Intelligence', () => {
    const graph = getGraph({ attachments: [{ filename: "test.exe", sha256: "abc" }] }, [
      { type: "hash", normalizedValue: "abc", intelligence: generateMockMap({ otx: { status: "success" } }) }
    ]);
    assert.ok(getEdge(graph, "hash_abc", "threatintel_otx", "reported by"));
  });

  it('10. missing sender domain safely handled', () => {
    const graph = getGraph({ headers: { from: "InvalidSenderFormat" } });
    const domNodes = graph.nodes.filter(n => n.type === 'domain');
    assert.strictEqual(domNodes.length, 0); // No domain node created since no @ found
  });

  it('11. missing DNS result does not break graph', () => {
    const graph = getGraph({}, [{ type: "domain", normalizedValue: "bad.com" }]);
    assert.ok(getNode(graph, "domain_bad.com"));
    const resolvesToEdge = graph.edges.find(e => e.relation === 'resolves to');
    assert.strictEqual(resolvesToEdge, undefined);
  });

  it('12. missing geolocation safely handled', () => {
    const graph = getGraph({}, [{ type: "ip", normalizedValue: "10.0.0.1" }]);
    const locNodes = graph.nodes.filter(n => n.type === 'location');
    assert.strictEqual(locNodes.length, 0);
  });

  it('13. country-only geolocation without coordinates is allowed but hasCoordinates flag is false', () => {
    const graph = getGraph({}, [
      { type: "ip", normalizedValue: "8.8.8.8", geolocation: { status: "success", country: "US" } }
    ]);
    const locNode = getNode(graph, "location_US");
    assert.ok(locNode);
    assert.strictEqual(locNode.metadata.hasCoordinates, false);
  });

  it('14. no fake country-centroid coordinates (explicit lat/lon test)', () => {
    const graph = getGraph({}, [
      { type: "ip", normalizedValue: "8.8.8.8", geolocation: { status: "success", country: "US", latitude: 10, longitude: 20 } }
    ]);
    const locNode = getNode(graph, "location_US");
    assert.strictEqual(locNode.metadata.hasCoordinates, true);
  });

  it('15. unsupported provider does not appear', () => {
    const graph = getGraph({}, [
      { type: "ip", normalizedValue: "8.8.8.8", intelligence: generateMockMap({ fake_provider: { status: "found" } }) }
    ]);
    assert.strictEqual(getNode(graph, "threatintel_fake_provider"), undefined);
  });

  it('16. not_observed/not_configured provider does not become clean/visible', () => {
    const graph = getGraph({}, [
      { type: "ip", normalizedValue: "8.8.8.8", intelligence: generateMockMap({ 
          virustotal: { status: "not_observed" },
          abuseipdb: { status: "not_configured" },
          urlhaus: { status: "error" },
          otx: { status: "skipped" },
          phishdestroy: { status: "unavailable" }
      }) }
    ]);
    assert.strictEqual(getNode(graph, "threatintel_virustotal"), undefined);
    assert.strictEqual(getNode(graph, "threatintel_abuseipdb"), undefined);
    assert.strictEqual(getNode(graph, "threatintel_urlhaus"), undefined);
    assert.strictEqual(getNode(graph, "threatintel_otx"), undefined);
    assert.strictEqual(getNode(graph, "threatintel_phishdestroy"), undefined);
  });

  // Note: 17 to 24 (frontend filter behaviors) are tested via frontend component structure, 
  // but we can assert that the graph logic creates nodes of correct types.
  
  it('25. no fake relationships', () => {
    const graph = getGraph({}, [
      { type: "url", normalizedValue: "http://bad.com" },
      { type: "domain", normalizedValue: "other.com" }
    ]);
    // URL hostname does not match other.com
    assert.strictEqual(getEdge(graph, "url_http://bad.com", "domain_other.com", "hostname"), undefined);
  });

  it('26. handles truncation limits safely (existing graph behavior remains compatible)', () => {
    const massiveReceived = [];
    for (let i = 0; i < 600; i++) {
      massiveReceived.push({ ipAddresses: [`10.0.0.${i}`] });
    }
    const mockInvestigation = { _id: "inv_massive", headers: { received: massiveReceived } };
    const graph = generateInvestigationGraph(mockInvestigation, []);
    assert.strictEqual(graph.meta.truncated, true);
    assert.ok(graph.nodes.length <= graph.meta.nodeLimit);
    assert.ok(graph.edges.length <= graph.meta.edgeLimit);
  });
});
