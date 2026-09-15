const env = require("../../config/env");

const MAX_NODES = parseInt(env.MAX_GRAPH_NODES) || 300;
const MAX_EDGES = parseInt(env.MAX_GRAPH_EDGES) || 500;

/**
 * investigationGraph.js
 * Transforms an EmailInvestigation and its populated Indicators into deterministic nodes and edges.
 * Handles deduplication by using standard ID formats (e.g., ip_x.x.x.x, domain_example.com).
 */
exports.generateInvestigationGraph = (investigation, indicators = []) => {
  const nodesMap = new Map();
  const edgesMap = new Map();
  let truncated = false;

  const addNode = (id, type, label, metadata = {}) => {
    if (nodesMap.size >= MAX_NODES) {
      truncated = true;
      return false;
    }
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, type, label, metadata });
    }
    return true;
  };

  const addEdge = (source, target, relation) => {
    if (!nodesMap.has(source) || !nodesMap.has(target)) return false;
    if (edgesMap.size >= MAX_EDGES) {
      truncated = true;
      return false;
    }
    const edgeId = `${source}-${relation}-${target}`;
    if (!edgesMap.has(edgeId)) {
      edgesMap.set(edgeId, { id: edgeId, source, target, relation });
    }
    return true;
  };

  // 1. Investigation Node
  const invId = `inv_${investigation._id.toString()}`;
  addNode(invId, "investigation", "Investigation", { 
    id: investigation._id, 
    riskLevel: investigation.scanId?.riskLevel || 'unknown'
  });

  // 2. Email Node
  const emailNodeId = `email_doc_${investigation._id.toString()}`;
  addNode(emailNodeId, "email", investigation.headers?.subject || "Email Evidence", {
    date: investigation.headers?.date
  });
  addEdge(invId, emailNodeId, "contains");

  // 3. Sender / Recipient
  if (investigation.headers?.from) {
    // Extract actual email address roughly
    const fromMatch = investigation.headers.from.match(/<([^>]+)>/) || [null, investigation.headers.from];
    const fromAddr = fromMatch[1].trim().toLowerCase();
    const senderId = `person_${fromAddr}`;
    addNode(senderId, "person", fromAddr, { raw: investigation.headers.from });
    addEdge(emailNodeId, senderId, "sender");
  }

  if (investigation.headers?.to) {
    const toStr = investigation.headers.to;
    // basic split if multiple (just taking first for simplicity, or all)
    toStr.split(',').slice(0, 3).forEach(to => { // Limit to first 3 to prevent explosion
      const toMatch = to.match(/<([^>]+)>/) || [null, to];
      const toAddr = toMatch[1].trim().toLowerCase();
      const recipientId = `person_${toAddr}`;
      addNode(recipientId, "person", toAddr, { raw: to });
      addEdge(emailNodeId, recipientId, "recipient");
    });
  }
  
  if (investigation.headers?.replyTo) {
    const replyStr = investigation.headers.replyTo;
    const replyMatch = replyStr.match(/<([^>]+)>/) || [null, replyStr];
    const replyAddr = replyMatch[1].trim().toLowerCase();
    const replyId = `person_${replyAddr}`;
    addNode(replyId, "person", replyAddr, { raw: replyStr });
    addEdge(emailNodeId, replyId, "reply_to");
  }

  // 4. Extracted Indicators (Fallback if indicators array isn't populated, but Phase 2 populates them)
  // We prefer using the normalized `indicators` array for graph nodes if provided.
  const processedUrls = new Set();
  const processedDomains = new Set();

  indicators.forEach(ind => {
    const indVal = ind.normalizedValue || ind.value;
    const nodeId = `${ind.type}_${indVal}`;
    
    let label = indVal;
    if (ind.type === 'hash') label = `${indVal.substring(0, 8)}...`;
    
    // Node — include DB _id so the frontend can link to the Indicator detail page
    addNode(nodeId, ind.type, label, { 
      threat: ind.threatStatus, 
      severity: ind.severity,
      provider: ind.sourceProviders?.[0],
      indicatorDbId: ind._id ? ind._id.toString() : undefined
    });
    
    // Relation to Email
    addEdge(emailNodeId, nodeId, `contains_${ind.type}`);

    // If it's an IP, check if it has geolocation
    if (ind.type === 'ip' && ind.geolocation && ind.geolocation.status === 'success') {
      const geo = ind.geolocation;
      if (geo.country) {
        const locId = `location_${geo.countryCode || geo.country}`;
        addNode(locId, "location", geo.country, { city: geo.city });
        addEdge(nodeId, locId, "located_in");
      }
      if (geo.asn) {
        const asnId = `asn_${geo.asn}`;
        addNode(asnId, "asn", geo.asn, { org: geo.organization || geo.isp });
        addEdge(nodeId, asnId, "routed_by");
      }
    }
  });

  // 5. Attachments -> Hashes
  if (investigation.attachments && Array.isArray(investigation.attachments)) {
    investigation.attachments.forEach(att => {
      if (!att.sha256) return;
      const attNodeId = `attachment_${att.filename || att.sha256.substring(0,8)}`;
      addNode(attNodeId, "attachment", att.filename || "Attachment", { size: att.sizeBytes });
      addEdge(emailNodeId, attNodeId, "contains_attachment");

      const hashNodeId = `hash_${att.sha256}`;
      addNode(hashNodeId, "hash", `${att.sha256.substring(0, 8)}...`, {});
      addEdge(attNodeId, hashNodeId, "has_hash");
    });
  }

  // 6. Received Hops (IPs)
  if (investigation.headers?.received && Array.isArray(investigation.headers.received)) {
    investigation.headers.received.forEach(hop => {
      if (hop.ipAddresses && Array.isArray(hop.ipAddresses)) {
        hop.ipAddresses.forEach(ip => {
          const ipNodeId = `ip_${ip}`;
          // If the IP node exists from indicators, we link to it. If not, we add it.
          addNode(ipNodeId, "ip", ip, {});
          addEdge(emailNodeId, ipNodeId, "received_via");
        });
      }
      if (hop.from) { // Often a domain
        const domainMatch = hop.from.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (domainMatch) {
          const dom = domainMatch[1].toLowerCase();
          const domId = `domain_${dom}`;
          addNode(domId, "domain", dom, {});
          addEdge(emailNodeId, domId, "received_from");
        }
      }
    });
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
    meta: {
      truncated,
      nodeLimit: MAX_NODES,
      edgeLimit: MAX_EDGES,
      totalNodes: nodesMap.size,
      totalEdges: edgesMap.size
    }
  };
};
