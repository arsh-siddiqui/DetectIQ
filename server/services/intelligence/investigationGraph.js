const env = require("../../config/env");

const MAX_NODES = parseInt(env.MAX_GRAPH_NODES) || 300;
const MAX_EDGES = parseInt(env.MAX_GRAPH_EDGES) || 500;

/**
 * investigationGraph.js
 * Transforms an EmailInvestigation and its populated Indicators into deterministic nodes and edges.
 * Handles deduplication by using standard ID formats.
 * Evidence-based edge building.
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

  // Helper: extract domain from email string
  const extractDomain = (emailStr) => {
    if (!emailStr) return null;
    const match = emailStr.match(/@([^>]+)>?/);
    if (match) return match[1].toLowerCase().trim();
    // fallback
    if (emailStr.includes('@')) {
      return emailStr.split('@')[1].trim().toLowerCase();
    }
    return null;
  };

  // 1. Email Node
  const emailNodeId = `email_doc_${investigation._id.toString()}`;
  addNode(emailNodeId, "email", investigation.headers?.subject || "Email Evidence", {
    date: investigation.headers?.date,
    id: investigation._id
  });

  // 2. Sender Domain / Reply-To Domain
  let senderDomainId = null;
  if (investigation.headers?.from) {
    const fromDomain = extractDomain(investigation.headers.from);
    if (fromDomain) {
      senderDomainId = `domain_${fromDomain}`;
      addNode(senderDomainId, "domain", fromDomain, {});
      addEdge(emailNodeId, senderDomainId, "sent from");
    }
    // Still keep the person node for full string if needed, but the prompt says 
    // "Extract the sender domain from the actual forensic sender data. Create: EMAIL -> DOMAIN".
    // We can add person as well.
    const fromMatch = investigation.headers.from.match(/<([^>]+)>/) || [null, investigation.headers.from];
    const fromAddr = fromMatch[1].trim().toLowerCase();
    const senderId = `person_${fromAddr}`;
    addNode(senderId, "person", fromAddr, { raw: investigation.headers.from });
    addEdge(emailNodeId, senderId, "sender");
  }

  if (investigation.headers?.replyTo) {
    const replyDomain = extractDomain(investigation.headers.replyTo);
    if (replyDomain && replyDomain !== extractDomain(investigation.headers?.from)) {
      const replyDomainId = `domain_${replyDomain}`;
      addNode(replyDomainId, "domain", replyDomain, {});
      addEdge(emailNodeId, replyDomainId, "reply_to domain");
    }
    const replyStr = investigation.headers.replyTo;
    const replyMatch = replyStr.match(/<([^>]+)>/) || [null, replyStr];
    const replyAddr = replyMatch[1].trim().toLowerCase();
    const replyId = `person_${replyAddr}`;
    addNode(replyId, "person", replyAddr, { raw: replyStr });
    addEdge(emailNodeId, replyId, "reply_to");
  }

  // 3. Extracted Indicators
  const domainNodeIds = new Set();
  
  // First pass: add all indicator nodes so edges resolve
  indicators.forEach(ind => {
    const indVal = ind.normalizedValue || ind.value;
    const nodeId = `${ind.type}_${indVal}`;
    
    let label = indVal;
    if (ind.type === 'hash') label = `${indVal.substring(0, 8)}...`;
    
    addNode(nodeId, ind.type, label, { 
      threat: ind.threatStatus, 
      severity: ind.severity,
      indicatorDbId: ind._id ? ind._id.toString() : undefined
    });

    if (ind.type === 'domain') {
      domainNodeIds.add(indVal);
    }
  });

  // Second pass: build edges
  indicators.forEach(ind => {
    const indVal = ind.normalizedValue || ind.value;
    const nodeId = `${ind.type}_${indVal}`;

    // Link to email
    if (ind.type === 'url') {
      addEdge(emailNodeId, nodeId, "contains url");
      // Extract hostname for URL -> DOMAIN
      try {
        let urlObj;
        if (!indVal.startsWith('http')) {
          urlObj = new URL(`http://${indVal}`);
        } else {
          urlObj = new URL(indVal);
        }
        const hostname = urlObj.hostname;
        if (hostname && domainNodeIds.has(hostname)) {
          addEdge(nodeId, `domain_${hostname}`, "hostname");
        }
      } catch (e) {
        // ignore parse errors
      }
    } else if (ind.type === 'domain') {
      // Don't add 'contains domain' if it was already 'sent from' to avoid clutter, 
      // but actually it's fine.
      if (nodeId !== senderDomainId) {
        addEdge(emailNodeId, nodeId, "contains domain");
      }
    } else if (ind.type === 'ip') {
      addEdge(emailNodeId, nodeId, "contains ip");
    }

    // IP -> Geolocation
    if (ind.type === 'ip' && ind.geolocation && ind.geolocation.status === 'success') {
      const geo = ind.geolocation;
      if (geo.country) {
        // Only use coords if valid explicit lat/lon from provider (usually not 0,0)
        let hasCoords = geo.latitude !== undefined && geo.longitude !== undefined && (geo.latitude !== 0 || geo.longitude !== 0);
        const locId = `location_${geo.countryCode || geo.country}`;
        addNode(locId, "location", geo.country, { 
          city: geo.city,
          country: geo.country,
          hasCoordinates: hasCoords
        });
        addEdge(nodeId, locId, "located in");
      }
    }

    // DOMAIN -> RESOLVED IP (from geolocations array)
    if (ind.type === 'ip' && Array.isArray(ind.geolocations)) {
      ind.geolocations.forEach(g => {
        if (g.sourceType === 'resolved_ip' && g.sourceValue) {
          const domId = `domain_${g.sourceValue.toLowerCase()}`;
          // Make sure domain node exists
          if (nodesMap.has(domId)) {
            addEdge(domId, nodeId, "resolves to");
          }
        }
      });
    }

    // Threat Intelligence Nodes
    if (ind.intelligence && typeof ind.intelligence.get === 'function') {
      const providers = ['virustotal', 'abuseipdb', 'urlhaus', 'otx', 'phishdestroy'];
      providers.forEach(provider => {
        const intel = ind.intelligence.get(provider);
        if (intel) {
          // Check if actual evidence
          const status = intel.status || 'unknown';
          if (!['skipped', 'not_observed', 'not_configured', 'error', 'unavailable'].includes(status)) {
            const providerNodeId = `threatintel_${provider}`;
            addNode(providerNodeId, "threat_intel", provider, { provider });
            addEdge(nodeId, providerNodeId, "reported by");
          }
        }
      });
    }
  });

  // 4. Attachments -> Hashes
  if (investigation.attachments && Array.isArray(investigation.attachments)) {
    investigation.attachments.forEach(att => {
      if (!att.sha256) return;
      const attNodeId = `attachment_${att.filename || att.sha256.substring(0,8)}`;
      addNode(attNodeId, "attachment", att.filename || "Attachment", { size: att.sizeBytes });
      addEdge(emailNodeId, attNodeId, "contains attachment");

      const hashNodeId = `hash_${att.sha256}`;
      // Hash node might already be created by indicators, if not create it
      if (!nodesMap.has(hashNodeId)) {
        addNode(hashNodeId, "hash", `${att.sha256.substring(0, 8)}...`, {});
      }
      addEdge(attNodeId, hashNodeId, "hash of");
    });
  }

  // 5. Received Hops (IPs)
  if (investigation.headers?.received && Array.isArray(investigation.headers.received)) {
    investigation.headers.received.forEach(hop => {
      if (hop.ipAddresses && Array.isArray(hop.ipAddresses)) {
        hop.ipAddresses.forEach(ip => {
          const ipNodeId = `ip_${ip}`;
          addNode(ipNodeId, "ip", ip, {});
          addEdge(emailNodeId, ipNodeId, "received via");
        });
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
