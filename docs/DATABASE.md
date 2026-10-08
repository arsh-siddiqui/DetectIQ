# DetectIQ — Database Design & Data Modeling Specification

**Primary Storage**: MongoDB Atlas (Replica Set Cluster)  
**ODM**: Mongoose 8.5.0  
**Vector Storage**: In-Memory FAISS (Dense Vector Memory per User)

---

## 1. Database Connection & Pool Management

Connection is established via `server/config/db.js`:
- Uses automated connection pooling (`maxPoolSize: 10`, `minPoolSize: 2`).
- Graceful degradation: The Node API answers health checks even if MongoDB is momentarily disconnected (`isDbConnected()`).
- Auto-reconnect enabled with retry write concerns (`retryWrites=true&w=majority`).

---

## 2. MongoDB Schema Definitions

### 2.1 `User` Collection (`users`)
Stores user identities, credentials, security roles, and aggregate posture statistics.

```javascript
{
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true, select: false }, // Excluded from queries by default
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  googleId: { type: String, default: null, index: true },
  avatar: { type: String, default: null },
  stats: {
    scansCount: { type: Number, default: 0 },
    threatsBlocked: { type: Number, default: 0 },
    securityScore: { type: Number, default: 100 }
  },
  lastLogin: { type: Date, default: null },
  lastPasswordChange: { type: Date, default: null }
}
```
- **Indexes**:
  - `{ email: 1 }` (Unique)
  - `{ googleId: 1 }` (Sparse)
  - `{ role: 1 }`

---

### 2.2 `Scan` Collection (`scans`)
Records threat scans performed by users and anonymous guests.

```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  scanType: { 
    type: String, 
    required: true, 
    enum: ['url', 'email', 'sms', 'whatsapp', 'qr', 'message', 'screenshot'] 
  },
  content: { type: String, required: true, maxlength: 10000 },
  score: { type: Number, required: true, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['safe', 'low', 'suspicious', 'medium', 'high', 'critical'], required: true },
  verdict: { type: String, enum: ['LEGITIMATE', 'SUSPICIOUS', 'PHISHING'], required: true },
  category: { type: String, default: 'General' },
  confidence: { type: Number, default: 0.90 },
  reasons: [{
    title: String,
    detail: String,
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    source: String
  }],
  evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  recommendation: { type: String, default: '' },
  ml: { type: mongoose.Schema.Types.Mixed, default: null },
  rag: { type: mongoose.Schema.Types.Mixed, default: null },
  intelligence: { type: mongoose.Schema.Types.Mixed, default: null }
}
```
- **Compound Indexes**:
  - `{ userId: 1, createdAt: -1 }` (Optimized for user scan history pagination)
  - `{ scanType: 1, createdAt: -1 }`

---

### 2.3 `ThreatIntelCache` Collection (`threatintelcaches`) — Automated TTL
Caches external threat intelligence lookups (VirusTotal, PhishDestroy, URLhaus) to prevent duplicate API billing.

```javascript
{
  urlHash: { type: String, required: true, unique: true, index: true, maxlength: 64 },
  normalizedUrl: { type: String, required: true, maxlength: 2048, select: false },
  providers: {
    phishdestroy: mongoose.Schema.Types.Mixed,
    virustotal: mongoose.Schema.Types.Mixed,
    geolocation: mongoose.Schema.Types.Mixed,
    threatintel: mongoose.Schema.Types.Mixed
  },
  indicatorType: { type: String, enum: ['ip', 'domain', 'url', 'hash', 'email', null], default: null },
  checkedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}
```
- **TTL Index Strategy**:
  - `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`
  - MongoDB background daemon automatically purges documents when `expiresAt <= current_time`.

---

### 2.4 `EmailHistory` Collection (`emailhistories`)
Stores legitimate baseline email communications used to build personalized RAG vector memory.

```javascript
{
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sender: { type: String, required: true, maxlength: 254 },
  subject: { type: String, required: true, maxlength: 500 },
  body: { type: String, required: true, maxlength: 20000 },
  isLegitimate: { type: Boolean, default: true },
  vectorIndexed: { type: Boolean, default: false }
}
```
- **Compound Indexes**:
  - `{ user: 1, createdAt: -1 }`

---

### 2.5 `LearningProgress` & `Vulnerability` Collections
Powers the cybersecurity education system and adaptive assessments.

- **`Vulnerability` (`vulnerabilities`)**:
  - `slug`: String, unique identifier (e.g. `'phish-spear-01'`).
  - `title`: String.
  - `category`: String (`'Phishing'`, `'Social Engineering'`, etc.).
  - `content`: Markdown text, prevention tactics, code samples.
  - `questions`: Array of evaluation assessment questions.
- **`LearningProgress` (`learningprogresses`)**:
  - `userId`: ObjectId ref User (unique compound key with `vulnerabilityId`).
  - `vulnerabilityId`: String.
  - `completed`: Boolean.
  - `score`: Number (`0 - 100`).
  - `attempts`: Number.

---

### 2.6 `AdminLog` Collection (`adminlogs`)
Immutable audit trail for security operations.

```javascript
{
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  target: { type: String, default: null },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}
```
- **Compound Index**: `{ adminId: 1, createdAt: -1 }`

---

## 3. Vector Memory Architecture (FAISS)

For dense vector storage and semantic retrieval:
- **Embedding Model**: FastEmbed `all-MiniLM-L6-v2` (384-dimensional dense vectors).
- **Index Topology**: `IndexFlatIP` (Inner Product / Cosine Similarity) partitioned per `userId`.
- **In-Memory Cache**: Python service keeps active vector matrices in RAM for sub-5ms vector search.
- **Auto-Rebuild on Boot**: If the Python container restarts on Render, the Node backend automatically re-syncs all users' historical emails from MongoDB into FAISS via `startRagRebuild()` ([ragStartupService.js](file:///d:/detectiq-fullstack/DETECTIQ/server/services/ragStartupService.js)).

---

## 4. Privacy & Data Protection Safeguards

1. **Password Encryption**: All passwords hashed using `bcryptjs` with work factor 10 before saving.
2. **Selective Projection (`select: false`)**: Fields containing passwords, raw credentials, and normalized target URLs are hidden from default Mongoose queries.
3. **Tenant Data Isolation**: All queries on scans, email history, and progress enforce `{ userId: req.user._id }`.
